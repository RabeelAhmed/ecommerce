const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const orderService = require('../services/orderService');
const cartModel = require('../models/cartModel');
const { csrfProtection } = require('../middleware/csrf');

// POST /api/orders - Process checkout
router.post('/api/orders', auth, csrfProtection, asyncHandler(async (req, res) => {
    const { name, address, city, zip, country } = req.body;

    // Validate shipping address
    if (!name || !address || !city || !zip || !country) {
        throw new AppError('All shipping address fields are required (name, address, city, zip, country)', 400);
    }

    const shippingAddress = { name, address, city, zip, country };

    const order = await orderService.createOrder(req.user.id, shippingAddress);

    res.status(201).json({
        status: 'success',
        orderId: order.id
    });
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

// GET /order/:id/confirmation - Render order confirmation page
router.get('/order/:id/confirmation', auth, asyncHandler(async (req, res) => {
    const orderId = req.params.id;
    const order = await orderService.getOrderById(orderId, req.user.id);

    res.render('pages/order-confirmation', {
        title: 'Order Confirmation',
        description: 'Your NOMADICA order has been placed. Thank you for shopping with us!',
        order
    });
}));

module.exports = router;
