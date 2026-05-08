const stripe = require('../config/stripe');

/**
 * Creates a Stripe Checkout session for the given line items.
 *
 * @param {Object}   opts
 * @param {Array}    opts.lineItems      - Cart items from cartModel.getCartWithItems
 * @param {string}   opts.userId         - The authenticated user's ID
 * @param {string}   opts.pendingOrderId - The pending order UUID from createPendingOrder
 * @returns {Promise<Stripe.Checkout.Session>}
 */
const createCheckoutSession = async ({ lineItems, userId, pendingOrderId }) => {
    const stripeLineItems = lineItems.map((item) => ({
        price_data: {
            currency: 'usd',
            unit_amount: Math.round(parseFloat(item.price) * 100), // cents
            product_data: {
                name: item.name,
            },
        },
        quantity: item.quantity,
    }));

    const port = process.env.PORT || 3000;
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: stripeLineItems,
        success_url: `http://localhost:${port}/order/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `http://localhost:${port}/checkout`,
        client_reference_id: pendingOrderId.toString(),
        metadata: {
            userId: userId.toString(),
        },
    });

    return session;
};

module.exports = { createCheckoutSession };
