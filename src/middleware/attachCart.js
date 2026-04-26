const jwt = require('jsonwebtoken');
const cartModel = require('../models/cartModel');

const attachCart = async (req, res, next) => {
    try {
        let userId = null;

        // Check if req.user is already set by authenticate middleware
        if (req.user && req.user.userId) {
            userId = req.user.userId;
        } else {
            // Attempt to decode token if available to support public routes
            const token = req.cookies.access_token;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                    userId = decoded.userId;
                    
                    // Attach user info to locals for views, optional but helpful
                    if (!res.locals.user) {
                        res.locals.user = { userId: decoded.userId, role: decoded.role };
                    }
                } catch (err) {
                    // Ignore expired or invalid tokens for cart attachment on public routes
                }
            }
        }

        if (userId) {
            const cartData = await cartModel.getCartWithItems(userId);
            res.locals.cart = cartData;
            res.locals.cartItemCount = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
        } else {
            res.locals.cart = { items: [], total: '0.00' };
            res.locals.cartItemCount = 0;
        }
        next();
    } catch (err) {
        // If DB fails or something else, default to empty cart
        console.error('Error attaching cart:', err.message);
        res.locals.cart = { items: [], total: '0.00' };
        res.locals.cartItemCount = 0;
        next();
    }
};

module.exports = attachCart;
