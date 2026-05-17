const express = require('express');
const router = express.Router();
const cartService = require('../services/cartService');
const { authenticate } = require('../middleware/auth');
const attachCart = require('../middleware/attachCart');
const asyncHandler = require('../middleware/asyncHandler');
const { csrfProtection } = require('../middleware/csrf');

// ─── API ROUTES ──────────────────────────────────────────────────────────────

router.get('/api/cart', authenticate, asyncHandler(async (req, res) => {
    const cartData = await cartService.getCart(req.user.userId || req.user.id);
    res.json(cartData);
}));

router.post('/api/cart/items', authenticate, csrfProtection, asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ status: 'error', message: 'Valid productId and quantity are required' });
    }
    const updatedCart = await cartService.addItemToCart(req.user.userId || req.user.id, productId, parseInt(quantity, 10));
    res.json({ status: 'success', data: updatedCart });
}));

router.put('/api/cart/items/:productId', authenticate, csrfProtection, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ status: 'error', message: 'Valid quantity is required' });
    }
    const updatedCart = await cartService.updateCartItem(req.user.userId || req.user.id, productId, parseInt(quantity, 10));
    res.json({ status: 'success', data: updatedCart });
}));

router.delete('/api/cart/items/:productId', authenticate, csrfProtection, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const updatedCart = await cartService.removeItemFromCart(req.user.userId || req.user.id, productId);
    res.json({ status: 'success', data: updatedCart });
}));

// ─── VIEW ROUTES ─────────────────────────────────────────────────────────────

router.get('/cart', authenticate, attachCart, asyncHandler(async (req, res) => {
    // res.locals.cart is already populated by attachCart
    res.render('pages/cart', {
        title: 'Your Cart',
        description: 'Review the items in your NOMADICA cart and proceed to checkout.'
    });
}));

module.exports = router;
