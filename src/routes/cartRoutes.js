const express = require('express');
const router = express.Router();
const cartModel = require('../models/cartModel');
const { authenticate } = require('../middleware/auth');
const attachCart = require('../middleware/attachCart');
const asyncHandler = require('../middleware/asyncHandler');

// ─── API ROUTES ──────────────────────────────────────────────────────────────

router.get('/api/cart', authenticate, asyncHandler(async (req, res) => {
    const cartData = await cartModel.getCartWithItems(req.user.userId);
    res.json(cartData);
}));

router.post('/api/cart/items', authenticate, asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ status: 'error', message: 'Valid productId and quantity are required' });
    }
    const updatedCart = await cartModel.addItemToCart(req.user.userId, productId, parseInt(quantity, 10));
    res.json({ status: 'success', data: updatedCart });
}));

router.put('/api/cart/items/:productId', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ status: 'error', message: 'Valid quantity is required' });
    }
    const updatedCart = await cartModel.updateCartItem(req.user.userId, productId, parseInt(quantity, 10));
    res.json({ status: 'success', data: updatedCart });
}));

router.delete('/api/cart/items/:productId', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const updatedCart = await cartModel.removeItemFromCart(req.user.userId, productId);
    res.json({ status: 'success', data: updatedCart });
}));

// ─── VIEW ROUTES ─────────────────────────────────────────────────────────────

router.get('/cart', authenticate, attachCart, asyncHandler(async (req, res) => {
    // res.locals.cart is already populated by attachCart
    res.render('pages/cart', {
        title: 'Your Cart'
    });
}));

module.exports = router;
