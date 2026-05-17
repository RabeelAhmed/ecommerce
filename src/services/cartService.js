const pool = require('../config/db');
const AppError = require('../utils/AppError');
const { client: redis, isConnected } = require('../config/redis');
const cartModel = require('../models/cartModel');

const CART_KEY_PREFIX = 'cart:';

/**
 * Carts are strictly Redis-backed. We do NOT fall back to PostgreSQL.
 * Falling back to PG during a high-load Redis transient outage causes
 * a cascading failure that exhausts the DB connection pool.
 */
const redisFallback = async (label, fallbackFn) => {
    throw new AppError('Cart service temporarily unavailable. Please retry.', 503);
};

const getCart = async (userId) => {
    try {
        const data = await redis.get(`${CART_KEY_PREFIX}${userId}`);
        if (data) return JSON.parse(data);
        return { items: [], total: '0.00' };
    } catch (err) {
        console.warn('[cartService] getCart Redis error:', err.message);
        return redisFallback('getCart', () => cartModel.getCartWithItems(userId));
    }
};

const addItemToCart = async (userId, productId, quantity) => {
    try {
        // 1. Product details — Redis cache first (5-min TTL), then PG
        const productCacheKey = `product:${productId}`;
        let product = null;
        const cachedProduct = await redis.get(productCacheKey);
        if (cachedProduct) {
            product = JSON.parse(cachedProduct);
        } else {
            const result = await pool.query(
                'SELECT name, price, stock, image_url as "imageUrl", slug FROM products WHERE id = $1',
                [productId]
            );
            if (result.rows.length === 0) throw new AppError('Product not found', 404);
            product = result.rows[0];
            // ioredis syntax: 'EX', seconds (not { EX: seconds })
            await redis.set(productCacheKey, JSON.stringify(product), 'EX', 300);
        }

        if (product.stock < quantity) throw new AppError('Not enough stock available', 400);

        // 2. Read → mutate → write cart
        const cartKey = `${CART_KEY_PREFIX}${userId}`;
        let cart = { items: [], total: '0.00' };
        const raw = await redis.get(cartKey);
        if (raw) cart = JSON.parse(raw);

        const existing = cart.items.find(i => i.productId === String(productId));
        const existingQty = existing ? existing.quantity : 0;

        if (existingQty + quantity > product.stock) throw new AppError('Not enough stock available', 400);

        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.items.push({
                productId: String(productId),
                quantity,
                name:     product.name,
                price:    product.price,
                imageUrl: product.imageUrl,
                stock:    product.stock,
                slug:     product.slug
            });
        }

        cart.items.sort((a, b) => a.productId.localeCompare(b.productId));
        cart.total = cart.items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2);

        await redis.set(cartKey, JSON.stringify(cart), 'EX', 86400);
        return cart;

    } catch (err) {
        if (err instanceof AppError) throw err;
        console.warn('[cartService] addItemToCart Redis error:', err.message);
        return redisFallback('addItemToCart', () => cartModel.addItemToCart(userId, productId, quantity));
    }
};

const updateCartItem = async (userId, productId, quantity) => {
    try {
        if (quantity <= 0) return await removeItemFromCart(userId, productId);

        // Stock check via Redis product cache
        const productCacheKey = `product:${productId}`;
        const cached = await redis.get(productCacheKey);
        let stock;
        if (cached) {
            stock = JSON.parse(cached).stock;
        } else {
            const r = await pool.query('SELECT stock FROM products WHERE id = $1', [productId]);
            if (r.rows.length === 0) throw new AppError('Product not found', 404);
            stock = r.rows[0].stock;
        }
        if (stock < quantity) throw new AppError('Not enough stock available', 400);

        const cartKey = `${CART_KEY_PREFIX}${userId}`;
        let cart = { items: [], total: '0.00' };
        const raw = await redis.get(cartKey);
        if (raw) cart = JSON.parse(raw);

        const item = cart.items.find(i => i.productId === String(productId));
        if (item) item.quantity = quantity;

        cart.total = cart.items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2);
        await redis.set(cartKey, JSON.stringify(cart), 'EX', 86400);
        return cart;

    } catch (err) {
        if (err instanceof AppError) throw err;
        console.warn('[cartService] updateCartItem Redis error:', err.message);
        return redisFallback('updateCartItem', () => cartModel.updateCartItem(userId, productId, quantity));
    }
};

const removeItemFromCart = async (userId, productId) => {
    try {
        const cartKey = `${CART_KEY_PREFIX}${userId}`;
        let cart = { items: [], total: '0.00' };
        const raw = await redis.get(cartKey);
        if (raw) cart = JSON.parse(raw);

        cart.items = cart.items.filter(i => i.productId !== String(productId));
        cart.total = cart.items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2);

        await redis.set(cartKey, JSON.stringify(cart), 'EX', 86400);
        return cart;
    } catch (err) {
        console.warn('[cartService] removeItemFromCart Redis error:', err.message);
        return redisFallback('removeItemFromCart', () => cartModel.removeItemFromCart(userId, productId));
    }
};

const clearCart = async (userId) => {
    try {
        await redis.del(`${CART_KEY_PREFIX}${userId}`);
        return { items: [], total: '0.00' };
    } catch (err) {
        console.warn('[cartService] clearCart Redis error:', err.message);
        return redisFallback('clearCart', () => cartModel.clearCart(userId));
    }
};

module.exports = { getCart, addItemToCart, updateCartItem, removeItemFromCart, clearCart };
