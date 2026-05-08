const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const cartModel = require('../models/cartModel');
const { csrfProtection } = require('../middleware/csrf');

// POST /api/orders - Create pending order + Stripe Checkout session
router.post('/api/orders', auth, csrfProtection, asyncHandler(async (req, res) => {
    const { name, address, city, zip, country } = req.body;

    // Validate shipping address fields
    if (!name || !address || !city || !zip || !country) {
        throw new AppError('All shipping address fields are required (name, address, city, zip, country)', 400);
    }

    const shippingAddress = { name, address, city, zip, country };

    // Create a pending order (no stock deduction yet)
    const { orderId, items } = await orderService.createPendingOrder(req.user.id, shippingAddress);

    // Create a Stripe Checkout session
    const session = await paymentService.createCheckoutSession({
        lineItems:      items,
        userId:         req.user.id,
        pendingOrderId: orderId,
    });

    // Return the Stripe-hosted checkout URL to the frontend
    res.status(200).json({ url: session.url });
}));

// GET /checkout - Render checkout page
router.get('/checkout', auth, asyncHandler(async (req, res) => {
    const cart = await cartModel.getCartWithItems(req.user.id);
    
    if (!cart.items || cart.items.length === 0) {
        return res.redirect('/cart');
    }

    res.render('pages/checkout', {
        title: 'Checkout',
        description: 'Complete your NOMADICA order. Enter shipping information and confirm your purchase.',
        cart
    });
}));

// GET /order/confirmation?session_id=cs_test_... — post-Stripe redirect
// Must be declared BEFORE /order/:id/confirmation so Express doesn't treat
// "confirmation" as an :id param.
router.get('/order/confirmation', auth, asyncHandler(async (req, res) => {
    const sessionId = req.query.session_id;

    let order = null;

    if (sessionId) {
        // Retry up to 5 times with 1 s gaps.
        // Stripe typically fires the webhook within 1–2 s, but the browser
        // redirect can arrive first. We wait here server-side so the user
        // almost always sees the full order details on first load.
        const MAX_ATTEMPTS = 5;
        const DELAY_MS     = 1000;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            order = await orderService.getOrderBySessionId(sessionId, req.user.id);
            if (order) break;
            if (attempt < MAX_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
            }
        }
    }

    // Webhook still hasn't fired after ~5 s — render a friendly "processing"
    // page that auto-refreshes. The template reads isPolling to show a spinner.
    if (!order) {
        return res.render('pages/order-confirmation', {
            title: 'Processing Payment…',
            description: 'Your payment was received. We are confirming your order.',
            order:      null,
            isPolling:  true,
            sessionId:  sessionId || null,
        });
    }

    res.render('pages/order-confirmation', {
        title:       'Order Confirmed',
        description: 'Your NOMADICA order has been confirmed. Thank you for shopping with us!',
        order,
        isPolling:  false,
        sessionId:  null,
    });
}));

// GET /order/:id/confirmation — legacy UUID-based confirmation (kept for backwards compatibility)
router.get('/order/:id/confirmation', auth, asyncHandler(async (req, res) => {
    const orderId = req.params.id;

    // Guard: reject malformed UUIDs before hitting the DB (avoids PostgreSQL cast error -> 500)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(orderId)) {
        throw new AppError('Invalid order ID', 400);
    }

    const order = await orderService.getOrderById(orderId, req.user.id);

    res.render('pages/order-confirmation', {
        title:       'Order Confirmation',
        description: 'Your NOMADICA order has been placed. Thank you for shopping with us!',
        order,
        isPolling:  false,
        sessionId:  null,
    });
}));

module.exports = router;
