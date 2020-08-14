/**
 * inventory.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * Simple library to store and interact with orders and products.
 * These methods are using the Stripe Orders API, but we tried to abstract them
 * from the main code if you'd like to use your own order management system instead.
 */

'use strict';

const config = require('./config');
const stripe = config.stripe.client;
const { v4: uuidv4 } = require('uuid');

const stripeOrders = config.stripe.ordersClient;
/*
// We use the older orders API since it removed embedding product SKUs
// And we haven't made that change yet
stripeOrders.setApiVersion(config.stripe.ordersApiVersion);
stripe.setApiVersion(config.stripe.apiVersion);
*/

// Create an order.
const createOrder = async (
  demoConfig,
  amount,
  currency,
  items,
  email,
  shipping,
  createIntent,
  payment_method,
  customer,
  usesSetupIntent
) => {
  // Create order
  /*
  let order = await stripeOrders.orders.create({
    currency,
    items,
    email,
    shipping,
    metadata: {
      status: 'created',
    },
  });
  */
 if (demoConfig.vaultCard === 'vault' && customer === undefined){
   //Create a customer object
  const customerObj = await stripe.customers.create({
     email: email, 
     name: shipping.name,
     shipping:shipping
   })
   customer = customerObj.id;
 }
  let order = {
    id:uuidv4(),
    amount,
    currency,
    items,
    email,
    shipping,
    metadata: {
      status: 'created',
    },
    customer,
    payment_method
    }
    console.log('Created an order with id %o', order.id)
  if (usesSetupIntent) {
    const setupIntent = await stripe.setupIntents.create();
    order.setupIntent = setupIntent.client_secret;
  } else if (createIntent) {
    // Create PaymentIntent to represent your customer's intent to pay this order.
    // Note: PaymentIntents currently only support card sources to enable dynamic authentication:
    // // https://stripe.com/docs/payments/dynamic-3ds
    const paymentIntentCreateOptions = {
      amount: order.amount,
      currency: order.currency,
      metadata: {
        order: order.id,
      },
      payment_method_types: ['card'],
      payment_method,
      customer,
      // Only attempt to confirm manual confirmation on creation if thats the
      // selected flow
      confirmation_method:
        demoConfig.piConfirmation === 'serverconfirmation'
          ? 'manual'
          : undefined,
      confirm: demoConfig.piConfirmation === 'serverconfirmation',
      capture_method: demoConfig.captureType === 'onlyauth' ? 'manual' : undefined,
      use_stripe_sdk: true,
      setup_future_usage : demoConfig.vaultCard === 'vault' ? 'on_session' : undefined
    };

    let paymentIntent;
    let appFee = Math.floor(order.amount * 0.1);
    // Handle connect payment scenarios
    if (demoConfig.workflow === 'destination') {
      paymentIntentCreateOptions.application_fee_amount = appFee;
      paymentIntentCreateOptions.transfer_data = {
        destination: config.stripe.destinationAccount,
      };
    } else if (demoConfig.workflow === 'chargetransfer') {
      paymentIntentCreateOptions.metadata = {
        workflowType: 'chargetransfer',
        transferAmount: (order.amount - appFee) / 2,
        order: order.id,
      };
    }
    /**
     * TODO: This flag doesn't work with the 3ds optional test card
     */
    // if (demoConfig.request3DSecure === 'true') {
    //   paymentIntentCreateOptions.requested_credentials = ['three_d_secure'];
    // }
    paymentIntent = await stripe.paymentIntents.create(
      paymentIntentCreateOptions
    );
    // Add PaymentIntent to order object so our frontend can access the client_secret.
    // The client_secret is used on the frontend to confirm the PaymentIntent and create a payment.
    // Therefore, do not log, store, or append the client_secret to a URL.
    order.paymentIntent = paymentIntent;
  }
  return order;
};

// Retrieve an order by ID.
const retrieveOrder = async orderId => {
  return await stripeOrders.orders.retrieve(orderId);
};

// Update an order.
const updateOrder = async ({
  order,
  properties = {},
  demoConfig,
  paymentIntentId,
  offSessionPaymentMethod,
}) => {
  let paymentIntent;
  if (paymentIntentId) {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'requires_confirmation') {
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    }
    if (paymentIntent.status === 'success') {
      properties.metadata.status = 'paid';
    }
  }
  if (offSessionPaymentMethod) {
    const customer = await stripe.customers.create({
      payment_method: offSessionPaymentMethod,
    });
    paymentIntent = await stripe.paymentIntents.create({
      amount: order.amount,
      currency: order.currency,
      customer: customer.id,
      payment_method: offSessionPaymentMethod,
      off_session: true,
      confirm: demoConfig.piConfirmation === 'serverconfirmation',
    });
    if (paymentIntent.status === 'success') {
      properties.metadata.status = 'paid';
    }
  }
  let updatedOrder = order;
  //updatedOrder = await stripeOrders.orders.update(order.id, properties);
  return {
    paymentIntent,
    order: updatedOrder,
  };
};

// List all products.
const listProducts = async () => {
  const plist = await stripeOrders.products.list({limit: 1});
  const productPriceList = plist.data.map(async item => {
    let priceItem =  await stripeOrders.prices.list({product:item.id, limit: 1})
    item.price = priceItem.data[0].unit_amount
    item.currency = priceItem.data[0].currency
    return item
  })
  const priceList = await Promise.all(productPriceList)
  .then((values) => {
    return (values)
  })
  return priceList;
  
};

// Retrieve a product by ID.
const retrieveProduct = async productId => {
  return await stripeOrders.products.retrieve(productId);
};

// Validate that products exist.
const productsExist = productList => {
  const validProducts = ['indeed'];
  console.log('Product list is %o', productList)
  return productList.reduce((accumulator, currentValue) => {
    return (
      accumulator &&
      productList.length === 1 &&
      validProducts.includes(currentValue.id)
    );
  }, !!productList.length);
};

/**
 * Creates transfers for separate charge & transfer workflow
 */
const createTransfers = async (order, paymentIntent) => {
  if (
    paymentIntent.metadata.workflowType === 'chargetransfer' &&
    !paymentIntent.metadata.transferGroup
  ) {
    // create 2 transfers for an order
    await stripe.transfers.create({
      amount: parseInt(paymentIntent.metadata.transferAmount),
      destination: config.stripe.destinationAccount,
      transfer_group: paymentIntent.id,
      currency: 'usd',
    });
    await stripe.transfers.create({
      amount: parseInt(paymentIntent.metadata.transferAmount),
      destination: config.stripe.alternateDestinationAccount,
      transfer_group: `group-${paymentIntent.id}`,
      currency: 'usd',
    });
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        transferGroup: `group-${order.paymentIntent.id}`,
      },
    });
  }
};

exports.orders = {
  create: createOrder,
  retrieve: retrieveOrder,
  update: updateOrder,
  createTransfers,
};

exports.products = {
  list: listProducts,
  retrieve: retrieveProduct,
  exist: productsExist,
};
