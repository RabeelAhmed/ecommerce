const jwt = require('jsonwebtoken');
const { client: redis, isConnected } = require('../config/redis');

const CART_KEY_PREFIX = 'cart:';

/**
 * Attach cart count/data to res.locals for navbar rendering.
 * This middleware is called on EVERY request — it must NEVER hit PostgreSQL.
 * If Redis is unavailable, we simply show an empty cart indicator.
 */
const attachCart = async (req, res, next) => {
    try {
        let userId = null;

        if (req.user && (req.user.userId || req.user.id)) {
            userId = req.user.userId || req.user.id;
        } else {
            const token = req.cookies.access_token;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                    userId = decoded.userId;
                    if (!res.locals.user) {
                        res.locals.user = { userId: decoded.userId, role: decoded.role };
                    }
                } catch (_) { /* expired/invalid — ignore */ }
            }
        }

        if (userId && isConnected) {
            try {
                const raw = await redis.get(`${CART_KEY_PREFIX}${userId}`);
                const cart = raw ? JSON.parse(raw) : { items: [], total: '0.00' };
                res.locals.cart = cart;
                res.locals.cartItemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
                return next();
            } catch (_) { /* Redis command error — fall through to empty cart */ }
        }

        // Default: empty cart (no PG call)
        res.locals.cart = { items: [], total: '0.00' };
        res.locals.cartItemCount = 0;
        next();
    } catch (err) {
        res.locals.cart = { items: [], total: '0.00' };
        res.locals.cartItemCount = 0;
        next();
    }
};

module.exports = attachCart;
