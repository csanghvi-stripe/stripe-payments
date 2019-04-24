/**
 * config.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 */

'use strict';

// Load environment variables from the `.env` file.
require('dotenv').config();
const stripe = require('stripe');
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
const ordersStripeClient = stripe(process.env.STRIPE_SECRET_KEY);

module.exports = {
  // Default country for the checkout form.
  country: 'US',

  // Store currency.
  // Note: A few payment methods like iDEAL or SOFORT only work with euros,
  // so it's a good common denominator to test both Elements and Sources.
  currency: 'eur',

  // Configuration for Stripe.
  // API Keys: https://dashboard.stripe.com/account/apikeys
  // Webhooks: https://dashboard.stripe.com/account/webhooks
  // Storing these keys and secrets as environment variables is a good practice.
  // You can fill them in your own `.env` file.
  stripe: {
    // The two-letter country code of your Stripe account (required for Payment Request).
    country: process.env.STRIPE_ACCOUNT_COUNTRY || 'US',
    // API version to set for this app (Stripe otherwise uses your default account version).
    ordersApiVersion: '2018-02-06',
    apiVersion: '2019-03-14',
    // Use your test keys for development and live keys for real charges in production.
    // For non-card payments like iDEAL, live keys will redirect to real banking sites.
    stripeStoredCustomer: process.env.STRIPE_CUSTOMER_ID,
    stripeStoredCardSource: process.env.STRIPE_CARD_SOURCE_ID,
    stripeStored3dsCardSource: process.env.STRIPE_3DS_CARD_SOURCE_ID,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    destinationAccount: process.env.DESTINATION_ACCOUNT,
    alternateDestinationAccount: process.env.ALT_DESTINATION_ACCOUNT,
    // Setting the webhook secret is good practice in order to verify signatures.
    // After creating a webhook, click to reveal details and find your signing secret.
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    client: stripeClient,
    ordersClient: ordersStripeClient,
  },

  // Server port.
  port: process.env.PORT || 8000,

  // Tunnel to serve the app over HTTPS and be able to receive webhooks locally.
  // Optionally, if you have a paid ngrok account, you can specify your `subdomain`
  // and `authtoken` in your `.env` file to use it.
  ngrok: {
    enabled: process.env.NODE_ENV !== 'production',
    port: process.env.PORT || 8000,
    subdomain: process.env.NGROK_SUBDOMAIN,
    authtoken: process.env.NGROK_AUTHTOKEN,
  },
};
