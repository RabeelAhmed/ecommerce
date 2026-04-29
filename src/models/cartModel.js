const pool = require('../config/db');
const AppError = require('../utils/AppError');

const cartCache = new Map();

const clearUserCache = (userId) => {
    cartCache.delete(userId.toString());
};

const getOrCreateCart = async (userId) => {
    let result = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
        result = await pool.query(
            'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
            [userId]
        );
    }
    return result.rows[0].id;
};

const getCartWithItems = async (userId) => {
    const cacheKey = userId.toString();
    const cached = cartCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    const cartId = await getOrCreateCart(userId);

    const query = `
        SELECT 
            ci.product_id as "productId", 
            ci.quantity, 
            p.name, 
            p.price, 
            p.image_url as "imageUrl", 
            p.stock,
            p.slug
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = $1
        ORDER BY ci.product_id
    `;
    
    const result = await pool.query(query, [cartId]);
    const items = result.rows;
    
    // Calculate total
    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    const data = {
        cartId,
        items,
        total: total.toFixed(2)
    };

    cartCache.set(cacheKey, { data, expires: Date.now() + 30000 }); // 30 sec TTL

    return data;
};

const addItemToCart = async (userId, productId, quantity) => {
    // 1. Check stock
    const productResult = await pool.query('SELECT stock FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
        throw new AppError('Product not found', 404);
    }
    const stock = productResult.rows[0].stock;
    if (stock < quantity) {
        throw new AppError('Not enough stock available', 400);
    }

    const cartId = await getOrCreateCart(userId);

    const existingItemResult = await pool.query(
        'SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
        [cartId, productId]
    );
    const existingQuantity = existingItemResult.rows.length > 0 ? existingItemResult.rows[0].quantity : 0;
    
    if (existingQuantity + quantity > stock) {
        throw new AppError('Not enough stock available', 400);
    }

    // 2. Upsert cart_items
    const query = `
        INSERT INTO cart_items (cart_id, product_id, quantity) 
        VALUES ($1, $2, $3)
        ON CONFLICT (cart_id, product_id) 
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
        RETURNING *
    `;
    
    await pool.query(query, [cartId, productId, quantity]);
    clearUserCache(userId);
    return await getCartWithItems(userId);
};

const updateCartItem = async (userId, productId, quantity) => {
    const productResult = await pool.query('SELECT stock FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
        throw new AppError('Product not found', 404);
    }
    const stock = productResult.rows[0].stock;
    
    // Ensure quantity is positive
    if (quantity <= 0) {
        return await removeItemFromCart(userId, productId);
    }

    if (stock < quantity) {
        throw new AppError('Not enough stock available', 400);
    }

    const cartId = await getOrCreateCart(userId);

    await pool.query(
        'UPDATE cart_items SET quantity = $1::int WHERE cart_id = $2 AND product_id = $3',
        [quantity, cartId, productId]
    );

    clearUserCache(userId);
    return await getCartWithItems(userId);
};

const removeItemFromCart = async (userId, productId) => {
    const cartId = await getOrCreateCart(userId);
    await pool.query(
        'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
        [cartId, productId]
    );
    clearUserCache(userId);
    return await getCartWithItems(userId);
};

const clearCart = async (userId) => {
    const cartId = await getOrCreateCart(userId);
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    clearUserCache(userId);
    return await getCartWithItems(userId);
};

module.exports = {
    getOrCreateCart,
    getCartWithItems,
    addItemToCart,
    updateCartItem,
    removeItemFromCart,
    clearCart
};
