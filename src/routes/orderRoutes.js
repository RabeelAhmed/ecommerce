const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const cartService = require('../services/cartService');
const { csrfProtection } = require('../middleware/csrf');

const { orderQueue } = require('../queues/orderQueue');

// POST /api/orders - Create pending order (queued)
router.post('/api/orders', auth, csrfProtection, asyncHandler(async (req, res) => {
    const { name, address, city, zip, country } = req.body;

    // Validate shipping address fields
    if (!name || !address || !city || !zip || !country) {
        throw new AppError('All shipping address fields are required (name, address, city, zip, country)', 400);
    }

    const shippingAddress = { name, address, city, zip, country };

    // Validate cart
    const cart = await cartService.getCart(req.user.id);
    if (!cart || !cart.items || cart.items.length === 0) {
        throw new AppError('Your cart is empty', 400);
    }

    // Enqueue order processing job
    await orderQueue.add('process-order', {
        userId: req.user.id,
        shippingAddress,
        cart
    });

    // Return 202 Accepted immediately
    res.status(202).json({ message: "Order received", estimatedCompletion: "soon" });
}));

// GET /checkout - Render checkout page
router.get('/checkout', auth, asyncHandler(async (req, res) => {
    const cart = await cartService.getCart(req.user.id);
    
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
