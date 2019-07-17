const config = require('./config');
const stripe = config.stripe.client;
const aquarium = require('@stripe/aquarium');

const tracer = new aquarium.Aquarium({
  subjectName: 'stripeAPI',
  applicationName: 'stripe-payments-demo',
});
tracer.setCollector(new aquarium.PusherServerCollector());

const applyTracerMiddleware = (app, webhookPath) => {
  // Setup Routes to use Aquarium Session ID from aquarium-id url param
  app.use(aquarium.ServerUtilities.AquariumSessionMiddleware);
  app.use(
    webhookPath,
    aquarium.ServerUtilities.StripeWebhookSessionMiddleware(tracer)
  );
  app.use(
    webhookPath,
    tracer.watchAction({
      actionFunction: (req, res, next) => {
        next();
      },
      type: 'webhook',
      options: {
        nameTransformer: ({args}) => {
          const req = args[0];
          const body = req.body;
          return body.type;
        },
        argsTransformer: ({args}) => {
          const req = args[0];
          return [
            {
              body: req.body,
              headers: req.headers,
            },
          ];
        },
        metadataTransformer: ({args}) => {
          const req = args[0];
          const eventName = req.body.type;
          return {
            description: `A ${eventName} webhook event from Stripe.`,
            docUrl: `https://stripe.com/docs/api/events/types#event_types-${eventName}`,
          };
        },
      },
    })
  );
};

const traceStripeClient = () => {
  stripe.charges.create = tracer.watchAction({
    actionFunction: stripe.charges.create,
    name: 'charges.create',
    metadata: {
      description: 'Creates a new Charge Object.',
      docUrl: 'https://stripe.com/docs/api/charges/create',
    },
    options: {
      injectAquariumIdMetadata: true,
    },
  });
  stripe.paymentIntents.create = tracer.watchAction({
    actionFunction: stripe.paymentIntents.create,
    name: 'paymentIntents.create',
    metadata: {
      description:
        'Creates a new Payment Intent object to be used by Stripe.js. Payment intents encapsulate the state machine of multi-step payment processes.',
      docUrl: 'https://stripe.com/docs/api/payment_intents/create',
    },
    options: {
      injectAquariumIdMetadata: true,
    },
  });
  stripe.paymentIntents.update = tracer.watchAction({
    actionFunction: stripe.paymentIntents.update,
    name: 'paymentIntents.update',
    metadata: {
      description:
        'Updates a Payment Intent object to be used by Stripe.js. Payment intents encapsulate the state machine of multi-step payment processes.',
      docUrl: 'https://stripe.com/docs/api/payment_intents/update',
    },
  });
  stripe.paymentIntents.confirm = tracer.watchAction({
    actionFunction: stripe.paymentIntents.confirm,
    name: 'paymentIntents.confirm',
    metadata: {
      description:
        'Confirm a Payment Intent object to be used by Stripe.js. Payment intents encapsulate the state machine of multi-step payment processes.',
      docUrl: 'https://stripe.com/docs/api/payment_intents/confirm',
    },
  });
  stripe.paymentIntents.cancel = tracer.watchAction({
    actionFunction: stripe.paymentIntents.cancel,
    name: 'paymentIntents.cancel',
    metadata: {
      description:
        'Cancels a Payment Intent object to be used by Stripe.js. Payment intents encapsulate the state machine of multi-step payment processes.',
      docUrl: 'https://stripe.com/docs/api/payment_intents/confirm',
    },
  });
  stripe.setupIntents.create = tracer.watchAction({
    actionFunction: stripe.setupIntents.create,
    name: 'setupIntents.create',
    metadata: {
      description:
        'Creates a SetupIntent object that can be used to setup a Payment Method for off-session use without an initial payment.',
      docUrl: 'https://stripe.com/docs/api/setup_intents/create',
    },
  });
  stripe.setupIntents.confirm = tracer.watchAction({
    actionFunction: stripe.setupIntents.confirm,
    name: 'setupIntents.confirm',
    metadata: {
      description:
        'Confirms a SetupIntent object. Inspect this object to see if authentication was required. If so, you will need to handle this on the client with stripejs.handleCardSetup.',
      docUrl: 'https://stripe.com/docs/api/setup_intents/confirm',
    },
  });
  stripe.customers.create = tracer.watchAction({
    actionFunction: stripe.customers.create,
    name: 'customers.create',
    metadata: {
      description:
        'Creates a Customer object which can be used to attach a Payment Method.',
      docUrl: 'https://stripe.com/docs/api/customers/create',
    },
  });
  stripe.transfers.create = tracer.watchAction({
    actionFunction: stripe.transfers.create,
    name: 'transfers.create',
    metadata: {
      description:
        'Creates a separate Transfer to a connected account from your Stripe account balance. This is useful when the intended funds for a payment are split between parties',
      docUrl: 'https://stripe.com/docs/api/transfers/create',
    },
    options: {
      injectAquariumIdMetadata: true,
    },
  });
};
module.exports = {
  traceApp: ({application, webhookPath}) => {
    // observe webhooks that come in
    applyTracerMiddleware(application, webhookPath);
    traceStripeClient();
  },
};
