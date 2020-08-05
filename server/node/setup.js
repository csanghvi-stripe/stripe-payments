/**
 * `setup.js`
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * This is a one-time setup script for your server. It creates a set of fixtures,
 * namely products and SKUs, that can then used to create orders when completing the
 * checkout flow in the web interface.
 */

'use strict';

const config = require('./config');
const stripe = require('stripe')(config.stripe.secretKey);


module.exports = {
  running: false,
  run: async () => {
    if (this.running) {
      console.log('⚠️  Setup already in progress.');
    } else {
      this.running = true;
      this.promise = new Promise(async resolve => {
        // Create a few products and SKUs assuming they don't already exist.
        try {
          // Increment Magazine.
          const table = await stripe.products.create({
            id: 'table',
            name: 'Dining Table',
            description:'The Gray Barn 72-inch Solid Wood Trestle Dining Table',
            images:['https://ak1.ostkcdn.com/images/products/is/images/direct/3d158c9f4385593d9d313e9860903a2680295720/The-Gray-Barn-72-inch-Solid-Wood-Trestle-Dining-Table.jpg','https://ak1.ostkcdn.com/images/products/is/images/direct/20c6629c406cd64ae15f88dc0ad029090a5a0c8e/The-Gray-Barn-72-inch-Solid-Wood-Trestle-Dining-Table.jpg','https://ak1.ostkcdn.com/images/products/is/images/direct/b7c9e87bc2d2b2df2b92dc3274ec141cd39f913e/The-Gray-Barn-72-inch-Solid-Wood-Trestle-Dining-Table.jpg']
          });
          await stripe.prices.create({
            product: 'table',
            unit_amount: 39900,
            currency: config.currency,
          });
          // Increment Magazine.
          const sofa = await stripe.products.create({
            id: 'sofa',
            name: '3 Seater Sofa',
            description:'3 Seater Sofa',
            images:['https://ak1.ostkcdn.com/images/products/28571305/Bowie-Modern-Glam-Velvet-3-Seater-Sofa-by-Christopher-Knight-Home-4f989d08-4782-462e-8c6c-818aff934903_1000.jpg','https://ak1.ostkcdn.com/images/products/28571305/Bowie-Modern-Glam-Velvet-3-Seater-Sofa-by-Christopher-Knight-Home-49cd0099-5b6e-41a9-9ed1-2e00c7e92dfb_1000.jpg', 'https://ak1.ostkcdn.com/images/products/28571305/Bowie-Modern-Glam-Velvet-3-Seater-Sofa-by-Christopher-Knight-Home-2dc1d355-6f8f-47bb-afce-05d1af260e56_1000.jpg']
          });
          await stripe.prices.create({
            product: 'sofa',
            unit_amount: 49900,
            currency: config.currency,
          });

          const barstool = await stripe.products.create({
            id: 'barstool',
            name: 'Bar Stool',
            description:'Round Seat Bar/ Counter Height Adjustable Metal Bar Stool',
            images:['https://ak1.ostkcdn.com/images/products/10868035/Antique-Brown-Round-Adjustable-Counter-height-Stool-b7d0d440-f754-4855-b491-eea6df791b85_1000.jpg','https://ak1.ostkcdn.com/images/products/10868035/Antique-Brown-Round-Adjustable-Counter-height-Stool-ce795070-d08c-4fc6-af64-abfcdee88c88_1000.jpg', 'https://ak1.ostkcdn.com/images/products/10868035/Antique-Brown-Round-Adjustable-Counter-height-Stool-262fe12c-3ac5-4f23-bf89-6ae28b1e17f6_1000.jpg']
          });
          await stripe.prices.create({
            product: 'barstool',
            unit_amount: 9900,
            currency: config.currency,
          });
          console.log('Setup complete.');
          resolve();
          this.running = false;
        } catch (err) {
          if (err.message === 'Product already exists.') {
            console.log('⚠️  Products have already been registered.');
            console.log('Delete them from your Dashboard to run this setup.');
          } else {
            console.log('⚠️  An error occurred.', err);
          }
        }
      });
    }
    return this.promise;
  },
};
