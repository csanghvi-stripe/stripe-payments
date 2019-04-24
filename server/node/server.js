/**
 * server.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * This is the main file starting the Express server for the demo and enabling ngrok.
 */

'use strict';

const config = require('./config');
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const ngrok = config.ngrok.enabled ? require('ngrok') : null;
const app = express();
const aquariumModule = require('@stripe/aquarium');
const aquarium = new aquariumModule.Aquarium({
  subjectName: 'stripeAPI',
  applicationName: 'stripe-payments-demo',
});
const stripe = config.stripe.client;

// Setup useful middleware.
// Define routes.

app.use(
  bodyParser.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function(req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(bodyParser.urlencoded({extended: true}));

app.use(express.static(path.join(__dirname, '../../public')));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

const tracer = require('./tracer');
tracer.traceApp({application: app, webhookPath: '/webhook'});

// Setup Routes to use Aquarium Session ID from aquarium-id url param

app.use('/', require('./routes'));

// Start the server on the correct port.
const server = app.listen(config.port, () => {
  console.log(`🚀  Server listening on port ${server.address().port}`);
});

// Turn on the ngrok tunnel in development, which provides both the mandatory HTTPS
// support for all card payments, and the ability to consume webhooks locally.
let webhook;
if (ngrok) {
  ngrok.connect(
    {
      addr: config.ngrok.port,
      subdomain: config.ngrok.subdomain,
      authtoken: config.ngrok.authtoken,
    },
    async (err, url) => {
      if (err) {
        if (err.code === 'ECONNREFUSED') {
          console.log(`⚠️  Connection refused at ${err.address}:${err.port}`);
        } else {
          console.log(`⚠️  ${err}`);
        }
        process.exit(1);
      } else {
        console.log(`👩🏻‍💻  Webhook URL for Stripe: ${url}/webhook`);
        console.log(`💳  App URL to see the demo in your browser: ${url}`);
        // REMOVE BEFORE DEPLOYING
        try {
          webhook = await stripe.webhookEndpoints.create({
            url: `${url}/webhook`,
            enabled_events: [
              'payment_intent.succeeded',
              'source.chargeable',
              'payment_intent.payment_failed',
            ],
          });
        } catch (e) {
          if (e.type === 'StripeInvalidRequestError') {
            let webhooks = await stripe.webhookEndpoints.list({limit: 16});
            for (let i = 0; i < webhooks.data.length; i += 1) {
              if (
                webhooks.data[i].url.indexOf('ngrok') >= 0 &&
                webhooks.data[i].url.indexOf('/webhook') >= 0
              ) {
                await stripe.webhookEndpoints.del(webhooks.data[i].id);
              }
            }
          }
          webhook = await stripe.webhookEndpoints.create({
            url: `${url}/webhook`,
            enabled_events: [
              'payment_intent.succeeded',
              'source.chargeable',
              'charge.succeeded',
              'payment_intent.payment_failed',
            ],
          });
        }

        process.env.STRIPE_WEBHOOK_SECRET = webhook.secret;
      }
    }
  );
  // doesn't actually work
  process.on('exit', async () => await stripe.webhookEndpoints.del(webhook.id));
}
