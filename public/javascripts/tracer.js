class Tracer {
    static SetupTracingConfig(store) {
      this.store = store;
      const demoConfig = store.getDemoConfig();
      if (!demoConfig['aquarium-id']) {
        // create simple random tracer id
        let aquariumId = '';
        let possible =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
        for (var i = 0; i < 5; i++)
          aquariumId += possible.charAt(
            Math.floor(Math.random() * possible.length)
          );
  
        store.updateConfig({'aquarium-id': aquariumId});
      }
    }
    static async TraceStripe(stripe) {
      const demoConfig = store.getDemoConfig();
      const tracer = new aquarium.Aquarium({
        subjectName: 'stripejs',
        applicationName: 'stripe-payments-demo',
      });
      let collector = new aquarium.PusherClientCollector(
        demoConfig['aquarium-id']
      );
      await tracer.setCollector(collector);
      stripe.confirmPaymentIntent = tracer.watchAction({
        actionFunction: stripe.confirmPaymentIntent,
        name: 'confirmPaymentIntent',
        metadata: {
          description:
            'Confirms the payment intent from the client-side using the payment intent public secret',
          docUrl: 'https://stripe.com/docs/api/payment_intents/confirm',
        },
      });
      stripe.handleCardPayment = tracer.watchAction({
        actionFunction: stripe.handleCardPayment,
        name: 'handleCardPayment',
        metadata: {
          description:
            'Stripe.js handles the card payment. If 3dsv2 is required Stripe.js automatically handles the authentication within an IFrame on your page. This results in a card authorization or charge.',
          docUrl:
            'https://stripe.com/docs/stripe-js/reference#stripe-handle-card-payment',
        },
        options: {
          argsTransformer: ({args}) => {
            const paymentIntentId = args[0];
            return [paymentIntentId, '[cardElement] object'];
          },
        },
      });
      stripe.handleCardAction = tracer.watchAction({
        actionFunction: stripe.handleCardAction,
        name: 'handleCardAction',
        metadata: {
          description:
            'Stripe.js handles next action for a PaymentIntent with a card payment method. If 3dsv2 is required Stripe.js automatically handles the authentication within an IFrame on your page.',
          docUrl:
            'https://stripe.com/docs/stripe-js/reference#stripe-handle-card-action',
        },
        options: {
          argsTransformer: ({args}) => {
            const paymentIntentSecret = args[0];
            return [paymentIntentSecret];
          },
        },
      });
      stripe.createPaymentMethod = tracer.watchAction({
        actionFunction: stripe.createPaymentMethod,
        name: 'createPaymentMethod',
        metadata: {
          description:
            'Stripe.js creates a new PaymentMethod that can be used with PaymentIntents.',
          docUrl:
            'https://stripe.com/docs/stripe-js/reference#stripe-create-payment-method',
        },
        options: {
          argsTransformer: ({name, args}) => {
            // hide the card element implementation from being rendered
            let transformed = [args[0], '[cardElement] object'];
            if (args[2]) {
              transformed.push(args[2]);
            }
            return transformed;
          },
        },
      });
    }
  }
  
  window.Tracer = Tracer;
  