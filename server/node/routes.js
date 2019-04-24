/**
 * routes.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * This file defines all the endpoints for this demo app. The two most interesting
 * endpoints for a Stripe integration are marked as such at the beginning of the file.
 * It's all you need in your app to accept all payments in your app.
 */

'use strict';

const config = require('./config');
const setup = require('./setup');
const {orders, products} = require('./inventory');
const express = require('express');
const router = express.Router();
const stripe = config.stripe.client;
stripe.setApiVersion(config.stripe.apiVersion);

// Render the main app HTML.
router.get('/', (req, res) => {
  res.render('index.html');
});

/**
 * Stripe integration to accept all types of payments with 3 POST endpoints.
 *
 * 1. POST endpoint to create orders with all user information.
 * 2. POST endpoint to complete a payment immediately when a card is used.
 * For payments using Elements, Payment Request, Apple Pay, Google Pay, Microsoft Pay.
 * 3. POST endpoint to be set as a webhook endpoint on your Stripe account.
 * It creates a charge as soon as a non-card payment source becomes chargeable.
 */

// Create an order on the backend.
router.post('/orders', async (req, res, next) => {
  let {
    demoConfig,
    currency,
    items,
    email,
    shipping,
    createIntent,
    source,
    customer,
  } = req.body;
  try {
    console.log(req.body);
    let order = await orders.create(
      demoConfig,
      currency,
      items,
      email,
      shipping,
      createIntent,
      source,
      customer
    );
    return res.status(200).json({order});
  } catch (err) {
    return res.status(500).json({error: err.message});
  }
});

// Complete payment for an order using a source.
router.post('/orders/:id/pay', async (req, res, next) => {
  let {source, payment_intent: paymentIntentId} = req.body;
  try {
    // Retrieve the order associated to the ID.
    let order = await orders.retrieve(req.params.id);
    // Verify that this order actually needs to be paid.
    if (
      order.metadata.status === 'pending' ||
      order.metadata.status === 'paid' ||
      order.metadata.status === 'requires_confirmation'
    ) {
      return res.status(403).json({order, source});
    }
    let charge, status, paymentIntent;
    // Pay the order using the Stripe source.
    if (source && source.status === 'chargeable') {
      try {
        charge = await stripe.charges.create(
          {
            source: source.id,
            amount: order.amount,
            currency: order.currency,
            receipt_email: order.email,
          },
          {
            // Set a unique idempotency key based on the order ID.
            // This is to avoid any race conditions with your webhook handler.
            idempotency_key: order.id,
          }
        );
      } catch (err) {
        // This is where you handle declines and errors.
        // For the demo we simply set to failed.
        status = 'failed';
      }
      if (charge && charge.status === 'succeeded') {
        status = 'paid';
      } else if (charge) {
        status = charge.status;
      } else {
        status = 'failed';
      }
      // Update the order with the charge status.
      order = await orders.update({order, properties: {metadata: {status}}});
    } else {
      // Update the order with the charge status and possibly
      // confirm the payment intent
      let result = await orders.update({
        order,
        properties: {metadata: {status}},
        paymentIntentId,
      });
      order = result.order;
      paymentIntent = result.paymentIntent;
    }
    return res.status(200).json({order, source, paymentIntent});
  } catch (err) {
    return res.status(500).json({error: err.message});
  }
});

// Webhook handler to process payments for sources asynchronously.
router.post('/webhook', async (req, res) => {
  let data;
  let eventType;
  console.log('calling webhook');
  // Check if webhook signing is configured.
  if (config.stripe.webhookSecret) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        config.stripe.webhookSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }
  const object = data.object;

  console.log('object:');
  console.dir(object);
  // PaymentIntent Beta, see https://stripe.com/docs/payments/payment-intents
  // Monitor payment_intent.succeeded & payment_intent.payment_failed events.
  if (object.object === 'payment_intent' && object.metadata.order) {
    const paymentIntent = object;
    // Find the corresponding order this source is for by looking in its metadata.
    const order = await orders.retrieve(paymentIntent.metadata.order);
    if (eventType === 'payment_intent.succeeded') {
      console.log(
        `🔔  Webhook received! Payment for PaymentIntent ${
          paymentIntent.id
        } succeeded.`
      );
      await orders.createTransfers(order, paymentIntent);
      // Update the order status to mark it as paid.
      await orders.update({order, properties: {metadata: {status: 'paid'}}});
    } else if (eventType === 'payment_intent.payment_failed') {
      console.log(
        `🔔  Webhook received! Payment on source for PaymentIntent ${
          paymentIntent.id
        } failed.`
      );
      // Note: you can use the existing PaymentIntent to prompt your customer to try again by attaching a newly created source:
      // https://stripe.com/docs/payments/payment-intents#lifecycle
    }
  }

  // Monitor `source.chargeable` events.
  if (
    object.object === 'source' &&
    object.status === 'chargeable' &&
    object.metadata.order
  ) {
    const source = object;
    console.log(`🔔  Webhook received! The source ${source.id} is chargeable.`);
    // Find the corresponding order this source is for by looking in its metadata.
    const order = await orders.retrieve(source.metadata.order);
    // Verify that this order actually needs to be paid.
    if (
      order.metadata.status === 'pending' ||
      order.metadata.status === 'paid' ||
      order.metadata.status === 'failed'
    ) {
      return res.sendStatus(403);
    }

    // Note: We're setting an idempotency key below on the charge creation to
    // prevent any race conditions. It's set to the order ID, which protects us from
    // 2 different sources becoming `chargeable` simultaneously for the same order ID.
    // Depending on your use cases and your idempotency keys, you might need an extra
    // lock surrounding your webhook code to prevent other race conditions.
    // Read more on Stripe's best practices here for asynchronous charge creation:
    // https://stripe.com/docs/sources/best-practices#charge-creation

    // Pay the order using the source we just received.
    let charge, status;
    try {
      charge = await stripe.charges.create(
        {
          source: source.id,
          amount: order.amount,
          currency: order.currency,
          receipt_email: order.email,
        },
        {
          // Set a unique idempotency key based on the order ID.
          // This is to avoid any race conditions with your webhook handler.
          idempotency_key: order.id,
        }
      );
    } catch (err) {
      // This is where you handle declines and errors.
      // For the demo, we simply set the status to mark the order as failed.
      status = 'failed';
    }
    if (charge && charge.status === 'succeeded') {
      status = 'paid';
    } else if (charge) {
      status = charge.status;
    } else {
      status = 'failed';
    }
    // Update the order status based on the charge status.
    await orders.update(order.id, {metadata: {status}});
  }

  // Monitor `charge.succeeded` events.
  if (
    object.object === 'charge' &&
    object.status === 'succeeded' &&
    object.source.metadata.order
  ) {
    const charge = object;
    console.log(`🔔  Webhook received! The charge ${charge.id} succeeded.`);
    // Find the corresponding order this source is for by looking in its metadata.
    const order = await orders.retrieve(charge.source.metadata.order);
    // Update the order status to mark it as paid.
    await orders.update(order.id, {metadata: {status: 'paid'}});
  }

  // Monitor `source.failed`, `source.canceled`, and `charge.failed` events.
  if (
    (object.object === 'source' || object.object === 'charge') &&
    (object.status === 'failed' || object.status === 'canceled')
  ) {
    const source = object.source ? object.source : object;
    console.log(`🔔  Webhook received! Failure for ${object.id}.`);
    if (source.metadata.order) {
      // Find the corresponding order this source is for by looking in its metadata.
      const order = await orders.retrieve(source.metadata.order);
      // Update the order status to mark it as failed.
      await orders.update(order.id, {metadata: {status: 'failed'}});
    }
  }

  // Return a 200 success code to Stripe.
  res.sendStatus(200);
});

/**
 * Routes exposing the config as well as the ability to retrieve products and orders.
 */

// Expose the Stripe publishable key and other pieces of config via an endpoint.
router.get('/config', (req, res) => {
  res.json({
    stripePublishableKey: config.stripe.publishableKey,
    stripeStoredCustomer: config.stripe.stripeStoredCustomer,
    stripeStored3dsCardSource: config.stripe.stripeStored3dsCardSource,
    stripeStoredCardSource: config.stripe.stripeStoredCardSource,
    stripeCountry: config.stripe.country,
    country: config.country,
    currency: config.currency,
  });
});

// Retrieve an order.
router.get('/orders/:id', async (req, res) => {
  try {
    return res.status(200).json(await orders.retrieve(req.params.id));
  } catch (err) {
    return res.sendStatus(404);
  }
});

// Retrieve all products.
router.get('/products', async (req, res) => {
  const productList = await products.list();
  // Check if products exist on Stripe Account.
  if (products.exist(productList)) {
    res.json(productList);
  } else {
    // We need to set up the products.
    await setup.run();
    res.json(await products.list());
  }
});

// Retrieve a product by ID.
router.get('/products/:id', async (req, res) => {
  res.json(await products.retrieve(req.params.id));
});

module.exports = router;
