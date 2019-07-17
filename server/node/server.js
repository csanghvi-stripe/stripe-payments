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
