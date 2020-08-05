/**
 * payments.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * This modern JavaScript file handles the checkout process using Stripe.
 *
 * 1. It shows how to accept card payments with the `card` Element, and
 * the `paymentRequestButton` Element for Payment Request and Apple Pay.
 * 2. It shows how to use the Stripe Sources API to accept non-card payments,
 * such as iDEAL, SOFORT, SEPA Direct Debit, and more.
 */

(async () => {
  'use strict';

  // Retrieve the configuration for the store.
  const config = await store.getConfig();

  // Create references to the main form and its submit button.
  const form = document.getElementById('payment-form');
  const randomize = document.getElementById('randomize')
  randomize.onclick = () => {
        // Retrieve the user information from the form.
    form.querySelector('input[name=name]').value = 'Ron Burgandy';
    const country = form.querySelector('select[name=country] option:checked').value;
    form.querySelector('input[name=email]').value = 'ron@demo.com';
    form.querySelector('input[name=address]').value = '510 Townsend St',
    form.querySelector('input[name=city]').value = 'San Francisco',
    form.querySelector('input[name=postal_code]').value = '94103',
    form.querySelector('input[name=state]').value = 'CA'
  }
  const submitButton = form.querySelector('button[type=submit]');

  // Create a Stripe client.
  const stripe = Stripe(config.stripePublishableKey);

  // Hook up payment intent workflow selector
  const vaultDropDown = document.getElementById('vault-selection');
  const workflowDropDown = document.getElementById('workflow-selection');
  const piConfirmationDropDown = document.getElementById(
    'pi-confirmation-selection'
  );
  const captureTypeDropDown = document.getElementById(
    'auth-n-capture'
  );
  const futureUsageDropdown = document.getElementById('future-usage-selection');
  // const request3DSecureCheckbox = document.getElementById('request-3d-secure');
  const query = window.location.search;
  const queryParsed = Qs.parse(query.replace('?', ''));
  let aquariumId = queryParsed['aquarium-id'];
  if (!aquariumId) {
    // create simple random tracer id
    let text = '';
    let possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < 5; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    aquariumId = text;
    store.updateConfig({'aquarium-id': aquariumId});
  }
  document.getElementById(
    'tracer-link'
  ).href = `https://stripe-tracer.com?aquarium-id=${aquariumId}`;
  vaultDropDown.value = store.demoConfig.vaultCard; 
  piConfirmationDropDown.value = store.demoConfig.piConfirmation;
  workflowDropDown.value = store.demoConfig.workflow;
  futureUsageDropdown.value = store.demoConfig.usage;
  captureTypeDropDown.value = store.demoConfig.captureType;
  // request3DSecureCheckbox.checked = store.demoConfig.request3DSecure === 'true';
  vaultDropDown.addEventListener('change', () =>{
    store.updateConfig({
      vaultCard:vaultDropDown.value
    })
  })
  workflowDropDown.addEventListener('change', () =>
    store.updateConfig({
      workflow: workflowDropDown.value,
    })
  );
  piConfirmationDropDown.addEventListener('change', () => {
    store.updateConfig({
      piConfirmation: piConfirmationDropDown.value,
    });
  });
  captureTypeDropDown.addEventListener('change', ()=> {
    store.updateConfig({
      captureType: captureTypeDropDown.value,
    })
  })
  futureUsageDropdown.addEventListener('change', () => {
    // off-session payments must use server-side confirmation
    store.updateConfig({
      usage: futureUsageDropdown.value,
    });
    if ('offSession' === futureUsageDropdown.value) {
      store.updateConfig({
        piConfirmation: 'serverconfirmation',
      });
      piConfirmationDropDown.value = 'serverconfirmation';
    }
  });
  // request3DSecureCheckbox.addEventListener('change', event => {
  //   if (event.target.checked) {
  //     store.updateConfig({
  //       request3DSecure: 'true',
  //     });
  //   } else {
  //     store.updateConfig({
  //       request3DSecure: 'false',
  //     });
  //   }
  // });

  // setup Tracing
  //Tracer.SetupTracingConfig(store);
  //Tracer.TraceStripe(stripe);

  /**
   * Setup Stripe Elements.
   */

  // Create an instance of Elements.
  const elements = stripe.elements();

  // Prepare the styles for Elements.
  const style = {
    base: {
      iconColor: '#666ee8',
      color: '#31325f',
      fontWeight: 400,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '15px',
      '::placeholder': {
        color: '#aab7c4',
      },
      ':-webkit-autofill': {
        color: '#666ee8',
      },
    },
  };

  /**
   * Implement a Stripe Card Element that matches the look-and-feel of the app.
   *
   * This makes it easy to collect debit and credit card payments information.
   */

  // Create a Card Element and pass some custom styles to it.
  const card = elements.create('card', {style});

  // Mount the Card Element on the page.
  card.mount('#card-element');

  // Monitor change events on the Card Element to display any errors.
  card.on('change', ({error}) => {
    const cardErrors = document.getElementById('card-errors');
    if (error) {
      cardErrors.textContent = error.message;
      cardErrors.classList.add('visible');
    } else {
      cardErrors.classList.remove('visible');
    }
    // Re-enable the Pay button.
    submitButton.disabled = false;
  });

  /**
   * Implement a Stripe IBAN Element that matches the look-and-feel of the app.
   *
   * This makes it easy to collect bank account information.
   */

  // Create a IBAN Element and pass the right options for styles and supported countries.
  const ibanOptions = {
    style,
    supportedCountries: ['SEPA'],
  };
  const iban = elements.create('iban', ibanOptions);

  // Mount the IBAN Element on the page.
  iban.mount('#iban-element');

  // Monitor change events on the IBAN Element to display any errors.
  iban.on('change', ({error, bankName}) => {
    const ibanErrors = document.getElementById('iban-errors');
    if (error) {
      ibanErrors.textContent = error.message;
      ibanErrors.classList.add('visible');
    } else {
      ibanErrors.classList.remove('visible');
      if (bankName) {
        updateButtonLabel('sepa_debit', bankName);
      }
    }
    // Re-enable the Pay button.
    submitButton.disabled = false;
  });

  /**
   * Add an iDEAL Bank selection Element that matches the look-and-feel of the app.
   *
   * This allows you to send the customer directly to their iDEAL enabled bank.
   */

  // Create a iDEAL Bank Element and pass the style options, along with an extra `padding` property.
  const idealBank = elements.create('idealBank', {
    style: {base: Object.assign({padding: '10px 15px'}, style.base)},
  });

  // Mount the iDEAL Bank Element on the page.
  idealBank.mount('#ideal-bank-element');

  /**
   * Implement a Stripe Payment Request Button Element.
   *
   * This automatically supports the Payment Request API (already live on Chrome),
   * as well as Apple Pay on the Web on Safari, Google Pay, and Microsoft Pay.
   * When of these two options is available, this element adds a “Pay” button on top
   * of the page to let users pay in just a click (or a tap on mobile).
   */

  // Make sure all data is loaded from the store to compute the order amount.
  await store.loadProducts();

  // Create the payment request.
  const paymentRequest = stripe.paymentRequest({
    country: config.stripeCountry,
    currency: config.currency,
    total: {
      label: 'Total',
      amount: store.getOrderTotal(),
    },
    requestShipping: true,
    requestPayerEmail: true,
    shippingOptions: [
      {
        id: 'free',
        label: 'Free Shipping',
        detail: 'Delivery within 5 days',
        amount: 0,
      },
    ],
  });

  // Callback when a source is created.
  paymentRequest.on('source', async event => {
    try {
      // Create the order using the email and shipping information from the Payment Request callback.
      const order = await store.createOrder(
        store.getOrderTotal(),
        config.currency,
        store.getOrderItems(),
        event.payerEmail,
        {
          name: event.shippingAddress.recipient,
          address: {
            line1: event.shippingAddress.addressLine[0],
            city: event.shippingAddress.city,
            country: event.shippingAddress.country,
            postal_code: event.shippingAddress.postalCode,
            state: event.shippingAddress.region,
          },
        },
        true
      );
      // Confirm the PaymentIntent with the source returned on the event.
      const {paymentIntent, error} = await stripe.confirmPaymentIntent(
        order.paymentIntent.client_secret,
        {
          source: event.source.id,
          use_stripe_sdk: true,
        }
      );
      if (error) {
        event.complete('fail');
        await handleOrder({metadata: {status: 'failed'}}, null, error);
      } else {
        event.complete('success');
        if (paymentIntent.status === 'succeeded') {
          // No authentication required, show success message.
          await handleOrder({metadata: {status: 'paid'}}, null, null);
        } else if (paymentIntent.status === 'requires_action') {
          // We need to perform authentication.
          const {error: handleError} = await stripe.handleCardAction(
            order.paymentIntent.client_secret
          );
          if (handleError) {
            // 3D Secure authentication failed.
            await handleOrder({metadata: {status: 'failed'}}, null, error);
          } else {
            // 3D Secure authentication successful.
            await handleOrder({metadata: {status: 'paid'}}, null, null);
          }
        }
      }
    } catch (error) {
      event.complete('fail');
    }
  });

  // Callback when the shipping address is updated.
  paymentRequest.on('shippingaddresschange', event => {
    event.updateWith({status: 'success'});
  });

  // Create the Payment Request Button.
  const paymentRequestButton = elements.create('paymentRequestButton', {
    paymentRequest,
  });

  // Check if the Payment Request is available (or Apple Pay on the Web).
  const paymentRequestSupport = await paymentRequest.canMakePayment();
  console.log('Adding infor on payment re2uest support %o', paymentRequestSupport)
  if (paymentRequestSupport) {
    // Display the Pay button by mounting the Element in the DOM.
    paymentRequestButton.mount('#payment-request-button');
    // Replace the instruction.
    document.querySelector('.instruction').innerText =
      'Or enter your shipping and payment details below';
    // Show the payment request section.
    document.getElementById('payment-request').classList.add('visible');
  }



  /**
   * Handle the form submission.
   *
   * This creates an order and either sends the card information from the Element
   * alongside it, or creates a Source and start a redirect to complete the purchase.
   *
   * Please note this form is not submitted when the user chooses the "Pay" button
   * or Apple Pay, Google Pay, and Microsoft Pay since they provide name and
   * shipping information directly.
   */

  // Listen to changes to the user-selected country.
  form
    .querySelector('select[name=country]')
    .addEventListener('change', event => {
      event.preventDefault();
      selectCountry(event.target.value);
    });

  // Submit handler for our payment form.
  form.addEventListener('submit', async event => {
    event.preventDefault();

    // Retrieve the user information from the form.
    const payment = form.querySelector('input[name=payment]:checked').value;
    const name = form.querySelector('input[name=name]').value;
    const country = form.querySelector('select[name=country] option:checked').value;
    const email = form.querySelector('input[name=email]').value;
    const shipping = {
      name,
      address: {
        line1: form.querySelector('input[name=address]').value,
        city: form.querySelector('input[name=city]').value,
        postal_code: form.querySelector('input[name=postal_code]').value,
        state: form.querySelector('input[name=state]').value,
        country,
      },
    };
    // Disable the Pay button to prevent multiple click events.
    submitButton.disabled = true;
    submitButton.textContent = 'Processing Payment…';

    // Create the order using the email and shipping information from the form.
    // For Demo purposes we only create an order / a PaymentIntent on form submit.
    // In a real application you should create this before entering the checkout, see
    // https://stripe.com/docs/payments/payment-intents
    const usesPaymentIntent =
      payment === 'card' ||
      payment === 'stored_card' ||
      payment === 'stored_card_3ds';

    // Use a SetupIntent when the user will be charged off-sesion
    const usesSetupIntent = store.demoConfig.usage === 'offSession';

    let cardSource, customer;
    // Note: PaymentIntents Beta currently only support card sources to enable dynamic authentication:
    // https://stripe.com/docs/payments/dynamic-3ds
    if (
      store.demoConfig.piConfirmation === 'serverconfirmation' &&
      payment === 'card' &&
      !usesSetupIntent
    ) {
      // Useful if we want to inspect the newly entered card information
      // prior to initiating payment
      let result = await stripe.createPaymentMethod({
                                type:'card', 
                                card,    
                                billing_details: {
                                address:shipping.address,
                                email:email,
                                name:name
                              },
                            });
      cardSource = result.paymentMethod;
    } else if (payment === 'stored_card') {
      cardSource = {id: config.stripeStoredCardSource};
      customer = config.stripeStoredCustomer;
    } else if (payment === 'stored_card_3ds') {
      cardSource = {id: config.stripeStored3dsCardSource};
      customer = config.stripeStoredCustomer;
    }
    let order = await store.createOrder(
      store.getOrderTotal(),
      config.currency,
      store.getOrderItems(),
      email,
      shipping,
      usesPaymentIntent,
      cardSource ? cardSource.id : undefined,
      customer,
      usesSetupIntent
    );
    let error;
    if (usesSetupIntent) {
      submitButton.textContent = 'Setting up Payment Method...';
      let setupIntent = order.setupIntent;

      const cardSetupResult = await stripe.confirmCardSetup(
        setupIntent,
        {
          payment_method: {
            card,
            billing_details: {
              name: name.value,
            },
          },
        })
      error = cardSetupResult.error;
      cardSource = cardSetupResult.setupIntent.payment_method;

      // Yes probably should be a loop but this was way quicker to write!
      submitButton.textContent =
        'Processing off-session Payment in 5 seconds...';
      await new Promise(resolve => setTimeout(resolve, 1000));
      submitButton.textContent =
        'Processing off-session Payment in 4 seconds...';
      await new Promise(resolve => setTimeout(resolve, 1000));
      submitButton.textContent =
        'Processing off-session Payment in 3 seconds...';
      await new Promise(resolve => setTimeout(resolve, 1000));
      submitButton.textContent =
        'Processing off-session Payment in 2 seconds...';
      await new Promise(resolve => setTimeout(resolve, 1000));
      submitButton.textContent =
        'Processing off-session Payment in 1 seconds...';
      await new Promise(resolve => setTimeout(resolve, 1000));
      submitButton.textContent = 'Processing off-session payment...';
      const result = await store.payOrder({
        order,
        setupIntentPaymentMethod: cardSource,
      });
      order.paymentIntent = result.paymentIntent;
      //usesPaymentIntent = true;
      error = result.error;
      if (error) {
        return await handleOrder({metadata: {status: 'failed'}}, null, error);
      } else if (order.paymentIntent.status === 'succeeded') {
        await handleOrder({metadata: {status: 'paid'}}, null, null);
      }
    }

    if (usesPaymentIntent && order.paymentIntent) {
      let paymentIntent = order.paymentIntent;
      let error;
      // Let Stripe handle source activation
      if (
        order.paymentIntent.status === 'requires_payment_method' &&
        payment === 'card'
      ) {
        // collect card info
        const result = await stripe.confirmCardPayment(
          order.paymentIntent.client_secret, {
                    payment_method: {
                      card,    
                      billing_details: {
                      address:shipping.address,
                      email:email,
                      name:name
                    },
                  }
                }
          );
        paymentIntent = result.paymentIntent;
        error = result.error;
        if (error) {
          return await handleOrder({metadata: {status: 'failed'}}, null, error);
        }
      }

      if (
        // If the Payment Intent has a source, requires confirmation or
        // requires a source action (3d secure authentication)
        paymentIntent.status === 'requires_action' &&
        paymentIntent.confirmation_method === 'manual' &&
        ['card', 'stored_card', 'stored_card_3ds'].includes(payment)
      ) {
        // card information was already attached to payment intent
        const result = await stripe.handleCardAction(
          paymentIntent.client_secret
        );
        paymentIntent = result.paymentIntent;
        error = result.error;
        if (error) {
          return await handleOrder({metadata: {status: 'failed'}}, null, error);
        }
      }
      if (
        paymentIntent.status === 'requires_confirmation' &&
        paymentIntent.confirmation_method === 'manual' &&
        ['card', 'stored_card', 'stored_card_3ds'].includes(payment)
      ) {
        const result = await store.payOrder({
          order,
          paymentIntentId: paymentIntent.id,
        });
        paymentIntent = result.paymentIntent;
        error = result.error;
        if (error) {
          return await handleOrder({metadata: {status: 'failed'}}, null, error);
        }
      }
      // handleCardPayment confirms under the covers
      if (
        paymentIntent.status === 'requires_confirmation' ||
        (paymentIntent.status === 'requires_action' &&
          paymentIntent.confirmation_method === 'automatic' &&
          ['card', 'stored_card', 'stored_card_3ds'].includes(payment))
      ) {
        const result = await stripe.confirmCardPayment(
          paymentIntent.client_secret
        );
        paymentIntent = result.paymentIntent;
        error = result.error;
        if (error) {
          return await handleOrder({metadata: {status: 'failed'}}, null, error);
        }
      }

      if (error) {
        await handleOrder({metadata: {status: 'failed'}}, null, error);
      } else if (paymentIntent.status === 'succeeded') {
        await handleOrder({metadata: {status: 'paid'}}, null, null);
      } else if (        
        paymentIntent.status === 'requires_capture' &&
        ['card', 'stored_card', 'stored_card_3ds'].includes(payment)
        ){
          await handleOrder({id: order.id,metadata: {status: 'authorized'}}, null, null, paymentIntent.id);
      }
    } else if (payment === 'sepa_debit') {
      // Create a SEPA Debit source from the IBAN information.
      const sourceData = {
        type: payment,
        currency: order.currency,
        owner: {
          name,
          email,
        },
        mandate: {
          // Automatically send a mandate notification email to your customer
          // once the source is charged.
          notification_method: 'email',
        },
        metadata: {
          order: order.id,
        },
      };
      const {source} = await stripe.createSource(iban, sourceData);
      await handleOrder(order, source);
    } else {
      // Prepare all the Stripe source common data.
      const sourceData = {
        type: payment,
        amount: order.amount,
        currency: order.currency,
        owner: {
          name,
          email,
        },
        redirect: {
          return_url: window.location.href,
        },
        statement_descriptor: 'Stripe Payments Demo',
        metadata: {
          order: order.id,
        },
      };

      // Add extra source information which are specific to a payment method.
      switch (payment) {
        case 'ideal':
          // iDEAL: Add the selected Bank from the iDEAL Bank Element.
          const {source, error} = await stripe.createSource(
            idealBank,
            sourceData
          );
          await handleOrder(order, source, error);
          return;
          break;
        case 'sofort':
          // SOFORT: The country is required before redirecting to the bank.
          sourceData.sofort = {
            country,
          };
          break;
        case 'ach_credit_transfer':
          // ACH Bank Transfer: Only supports USD payments, edit the default config to try it.
          // In test mode, we can set the funds to be received via the owner email.
          sourceData.owner.email = `amount_${order.amount}@example.com`;
          break;
      }

      // Create a Stripe source with the common data and extra information.
      const {source, error} = await stripe.createSource(sourceData);
      await handleOrder(order, source, error);
    }
  });

  // Handle the order and source activation if required
  const handleOrder = async (order, source, error = null, pi) => {
    const mainElement = document.getElementById('main');
    const confirmationElement = document.getElementById('confirmation');
    if (error) {
      mainElement.classList.remove('processing');
      mainElement.classList.remove('receiver');
      confirmationElement.querySelector('.error-message').innerText =
        error.message;
      mainElement.classList.add('error');
    }
    switch (order.metadata.status) {
      case 'created':
        switch (source.status) {
          case 'chargeable':
            submitButton.textContent = 'Processing Payment…';
            const response = await store.payOrder({order, source});
            await handleOrder(response.order, response.source);
            break;
          case 'pending':
            switch (source.flow) {
              case 'none':
                // Normally, sources with a `flow` value of `none` are chargeable right away,
                // but there are exceptions, for instance for WeChat QR codes just below.
                if (source.type === 'wechat') {
                  // Display the QR code.
                  const qrCode = new QRCode('wechat-qrcode', {
                    text: source.wechat.qr_code_url,
                    width: 128,
                    height: 128,
                    colorDark: '#424770',
                    colorLight: '#f8fbfd',
                    correctLevel: QRCode.CorrectLevel.H,
                  });
                  // Hide the previous text and update the call to action.
                  form.querySelector('.payment-info.wechat p').style.display =
                    'none';
                  let amount = store.formatPrice(
                    store.getOrderTotal(),
                    config.currency
                  );
                  submitButton.textContent = `Scan this QR code on WeChat to pay ${amount}`;
                  // Start polling the order status.
                  pollOrderStatus(order.id, 300000);
                } else {
                  console.log('Unhandled none flow.', source);
                }
                break;
              case 'redirect':
                // Immediately redirect the customer.
                submitButton.textContent = 'Redirecting…';
                window.location.replace(source.redirect.url);
                break;
              case 'code_verification':
                // Display a code verification input to verify the source.
                break;
              case 'receiver':
                // Display the receiver address to send the funds to.
                mainElement.classList.add('success', 'receiver');
                const receiverInfo = confirmationElement.querySelector(
                  '.receiver .info'
                );
                let amount = store.formatPrice(source.amount, config.currency);
                switch (source.type) {
                  case 'ach_credit_transfer':
                    // Display the ACH Bank Transfer information to the user.
                    const ach = source.ach_credit_transfer;
                    receiverInfo.innerHTML = `
                      <ul>
                        <li>
                          Amount:
                          <strong>${amount}</strong>
                        </li>
                        <li>
                          Bank Name:
                          <strong>${ach.bank_name}</strong>
                        </li>
                        <li>
                          Account Number:
                          <strong>${ach.account_number}</strong>
                        </li>
                        <li>
                          Routing Number:
                          <strong>${ach.routing_number}</strong>
                        </li>
                      </ul>`;
                    break;
                  case 'multibanco':
                    // Display the Multibanco payment information to the user.
                    const multibanco = source.multibanco;
                    receiverInfo.innerHTML = `
                      <ul>
                        <li>
                          Amount (Montante):
                          <strong>${amount}</strong>
                        </li>
                        <li>
                          Entity (Entidade):
                          <strong>${multibanco.entity}</strong>
                        </li>
                        <li>
                          Reference (Referencia):
                          <strong>${multibanco.reference}</strong>
                        </li>
                      </ul>`;
                    break;
                  default:
                    console.log('Unhandled receiver flow.', source);
                }
                // Poll the backend and check for an order status.
                // The backend updates the status upon receiving webhooks,
                // specifically the `source.chargeable` and `charge.succeeded` events.
                pollOrderStatus(order.id);
                break;
              default:
                // Order is received, pending payment confirmation.
                break;
            }
            break;
          case 'failed':
          case 'canceled':
            // Authentication failed, offer to select another payment method.
            break;
          default:
            // Order is received, pending payment confirmation.
            break;
        }
        break;

      case 'pending':
        // Success! Now waiting for payment confirmation. Update the interface to display the confirmation screen.
        mainElement.classList.remove('processing');
        // Update the note about receipt and shipping (the payment is not yet confirmed by the bank).
        confirmationElement.querySelector('.note').innerText =
          'We’ll send your receipt and ship your items as soon as your payment is confirmed.';
        mainElement.classList.add('success');
        break;

      case 'failed':
        // Payment for the order has failed.
        mainElement.classList.remove('success');
        mainElement.classList.remove('processing');
        mainElement.classList.remove('receiver');
        mainElement.classList.add('error');
        break;

      case 'paid':
        // Success! Payment is confirmed. Update the interface to display the confirmation screen.
        mainElement.classList.remove('checkout')
        mainElement.classList.remove('processing');
        mainElement.classList.remove('receiver');
        // Update the note about receipt and shipping (the payment has been fully confirmed by the bank).
        confirmationElement.querySelector('.note').innerText =
          'We just sent your receipt to your email address, and your items will be on their way shortly.';
        mainElement.classList.add('success');
        break;
      
      case 'authorized':
        // Success! Payment is confirmed. Update the interface to display the confirmation screen.
        mainElement.classList.remove('checkout')
        mainElement.classList.remove('processing');
        mainElement.classList.remove('receiver');
        // Update the note about receipt and shipping (the payment has been fully confirmed by the bank).
        confirmationElement.querySelector('.note').innerText =
          'We just sent your receipt to your email address, and your items will be on their way shortly.';
        confirmationElement.querySelector('.note').innerHTML = "<button id='capture'>Capture</button><br>"
        mainElement.classList.add('success');
        /**
         * Support for capturing payments after authorization
         */
        const captureElement = document.getElementById('capture');
        captureElement.onclick = async () => {
          const result = await store.captureOrder(order.id, pi)
          let paymentIntent = result.paymentIntent;
          if (paymentIntent.status === 'succeeded'){
            await handleOrder({metadata:{status:'paid'}}, null, null);
          }
        }
        break;        
    }
  };

  /**
   * Monitor the status of a source after a redirect flow.
   *
   * This means there is a `source` parameter in the URL, and an active order.
   * When this happens, we'll monitor the status of the order and present real-time
   * information to the user.
   */

  const pollOrderStatus = async (
    orderId,
    timeout = 30000,
    interval = 500,
    start = null
  ) => {
    start = start ? start : Date.now();
    const endStates = ['paid', 'failed'];
    // Retrieve the latest order status.
    const order = await store.getOrderStatus(orderId);
    await handleOrder(order, {status: null});
    if (
      !endStates.includes(order.metadata.status) &&
      Date.now() < start + timeout
    ) {
      // Not done yet. Let's wait and check again.
      setTimeout(pollOrderStatus, interval, orderId, timeout, interval, start);
    } else {
      if (!endStates.includes(order.metadata.status)) {
        // Status has not changed yet. Let's time out.
        console.warn(new Error('Polling timed out.'));
      }
    }
  };

  const orderId = store.getActiveOrderId();
  const mainElement = document.getElementById('main');
  if (orderId && window.location.search.includes('source')) {
    // Update the interface to display the processing screen.
    mainElement.classList.add('success', 'processing');

    // Poll the backend and check for an order status.
    // The backend updates the status upon receiving webhooks,
    // specifically the `source.chargeable` and `charge.succeeded` events.
    pollOrderStatus(orderId);
  } else {
    // Update the interface to display the checkout form.
    mainElement.classList.add('checkout');
  }

  /**
   * Display the relevant payment methods for a selected country.
   */

  // List of relevant countries for the payment methods supported in this demo.
  // Read the Stripe guide: https://stripe.com/payments/payment-methods-guide
  const paymentMethods = {
    ach_credit_transfer: {
      name: 'Bank Transfer',
      flow: 'receiver',
      countries: ['US'],
      currencies: ['usd'],
    },
    stored_card: {
      name: 'Stored Card',
      flow: 'none',
    },
    stored_card_3ds: {
      name: 'Stored 3DS Card',
      flow: 'none',
    },
    alipay: {
      name: 'Alipay',
      flow: 'redirect',
      countries: ['CN', 'HK', 'SG', 'JP'],
      currencies: [
        'aud',
        'cad',
        'eur',
        'gbp',
        'hkd',
        'jpy',
        'nzd',
        'sgd',
        'usd',
      ],
    },
    bancontact: {
      name: 'Bancontact',
      flow: 'redirect',
      countries: ['BE'],
      currencies: ['eur'],
    },
    card: {
      name: 'Card',
      flow: 'none',
    },
    eps: {
      name: 'EPS',
      flow: 'redirect',
      countries: ['AT'],
      currencies: ['eur'],
    },
    ideal: {
      name: 'iDEAL',
      flow: 'redirect',
      countries: ['NL'],
      currencies: ['eur'],
    },
    giropay: {
      name: 'Giropay',
      flow: 'redirect',
      countries: ['DE'],
      currencies: ['eur'],
    },
    multibanco: {
      name: 'Multibanco',
      flow: 'receiver',
      countries: ['PT'],
      currencies: ['eur'],
    },
    sepa_debit: {
      name: 'SEPA Direct Debit',
      flow: 'none',
      countries: [
        'FR',
        'DE',
        'ES',
        'BE',
        'NL',
        'LU',
        'IT',
        'PT',
        'AT',
        'IE',
        'FI',
      ],
      currencies: ['eur'],
    },
    sofort: {
      name: 'SOFORT',
      flow: 'redirect',
      countries: ['DE', 'AT'],
      currencies: ['eur'],
    },
    wechat: {
      name: 'WeChat',
      flow: 'none',
      countries: ['CN', 'HK', 'SG', 'JP'],
      currencies: [
        'aud',
        'cad',
        'eur',
        'gbp',
        'hkd',
        'jpy',
        'nzd',
        'sgd',
        'usd',
      ],
    },
  };

  // Update the main button to reflect the payment method being selected.
  const updateButtonLabel = (paymentMethod, bankName) => {
    let amount = store.formatPrice(store.getOrderTotal(), config.currency);
    let name = paymentMethods[paymentMethod].name;
    let label = `Pay ${amount}`;
    if (paymentMethod !== 'card') {
      label = `Pay ${amount} with ${name}`;
    }
    if (paymentMethod === 'wechat') {
      label = `Generate QR code to pay ${amount} with ${name}`;
    }
    if (paymentMethod === 'sepa_debit' && bankName) {
      label = `Debit ${amount} from ${bankName}`;
    }
    submitButton.innerText = label;
  };

  const selectCountry = country => {
    const selector = document.getElementById('country');
    selector.querySelector(`option[value=${country}]`).selected = 'selected';
    selector.className = `field ${country}`;

    // Trigger the methods to show relevant fields and payment methods on page load.
    showRelevantFormFields();
    showRelevantPaymentMethods();
  };

  // Show only form fields that are relevant to the selected country.
  const showRelevantFormFields = country => {
    if (!country) {
      country = form.querySelector('select[name=country] option:checked').value;
    }
    const zipLabel = form.querySelector('label.zip');
    // Only show the state input for the United States.
    zipLabel.parentElement.classList.toggle('with-state', country === 'US');
    // Update the ZIP label to make it more relevant for each country.
    form.querySelector('label.zip span').innerText =
      country === 'US' ? 'ZIP' : country === 'GB' ? 'Postcode' : 'Postal Code';
  };

  // Show only the payment methods that are relevant to the selected country.
  const showRelevantPaymentMethods = country => {
    if (!country) {
      country = form.querySelector('select[name=country] option:checked').value;
    }
    const paymentInputs = form.querySelectorAll('input[name=payment]');
    for (let i = 0; i < paymentInputs.length; i++) {
      let input = paymentInputs[i];
      input.parentElement.classList.toggle(
        'visible',
        input.value === 'card' ||
          input.value === 'stored_card' ||
          input.value === 'stored_card_3ds' ||
          (paymentMethods[input.value].countries.includes(country) &&
            paymentMethods[input.value].currencies.includes(config.currency))
      );
    }

    // Hide the tabs if card is the only available option.
    const paymentMethodsTabs = document.getElementById('payment-methods');
    paymentMethodsTabs.classList.toggle(
      'visible',
      paymentMethodsTabs.querySelectorAll('li.visible').length > 1
    );

    // Check the first payment option again.
    paymentInputs[0].checked = 'checked';
    form.querySelector('.payment-info.card').classList.add('visible');
    form.querySelector('.payment-info.ideal').classList.remove('visible');
    form.querySelector('.payment-info.sepa_debit').classList.remove('visible');
    form.querySelector('.payment-info.wechat').classList.remove('visible');
    form.querySelector('.payment-info.redirect').classList.remove('visible');
    updateButtonLabel(paymentInputs[0].value);
  };

  // Listen to changes to the payment method selector.
  for (let input of document.querySelectorAll('input[name=payment]')) {
    input.addEventListener('change', event => {
      event.preventDefault();
      const payment = form.querySelector('input[name=payment]:checked').value;
      const flow = paymentMethods[payment].flow;

      // Update button label.
      updateButtonLabel(event.target.value);

      // Show the relevant details, whether it's an extra element or extra information for the user.
      form
        .querySelector('.payment-info.card')
        .classList.toggle('visible', payment === 'card');
      form
        .querySelector('.payment-info.ideal')
        .classList.toggle('visible', payment === 'ideal');
      form
        .querySelector('.payment-info.sepa_debit')
        .classList.toggle('visible', payment === 'sepa_debit');
      form
        .querySelector('.payment-info.wechat')
        .classList.toggle('visible', payment === 'wechat');
      form
        .querySelector('.payment-info.redirect')
        .classList.toggle('visible', flow === 'redirect');
      form
        .querySelector('.payment-info.receiver')
        .classList.toggle('visible', flow === 'receiver');
      document
        .getElementById('card-errors')
        .classList.remove('visible', payment !== 'card');
    });
  }

  // Select the default country from the config on page load.
  let country = config.country;
  // Override it if a valid country is passed as a URL parameter.
  var urlParams = new URLSearchParams(window.location.search);
  let countryParam = urlParams.get('country')
    ? urlParams.get('country').toUpperCase()
    : config.country;
  if (form.querySelector(`option[value="${countryParam}"]`)) {
    country = countryParam;
  }
  selectCountry(country);
})();
