const pool = require('../config/db');
const AppError = require('../utils/AppError');
const cartService = require('./cartService');

/**
 * createPendingOrder — called before redirecting to Stripe.
 * Creates the order row and order_items rows inside a transaction but does
 * NOT deduct stock or clear the cart yet (that happens in the webhook).
 *
 * @param {string} userId
 * @param {Object} shippingAddress  { name, address, city, zip, country }
 * @returns {Promise<{ orderId: string, items: Array }>}
 */
const createPendingOrder = async (userId, shippingAddress) => {
    // Get cart from Redis (or fallback)
    const cart = await cartService.getCart(userId);
    if (!cart.items || cart.items.length === 0) {
        throw new AppError('Your cart is empty', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Lock products and check stock
        const productIds = cart.items.map(item => item.productId);
        const productsQuery = `
            SELECT id as product_id, name as product_name, price as product_price, stock as product_stock
            FROM products
            WHERE id = ANY($1)
            FOR UPDATE NOWAIT
        `;
        const productsResult = await client.query(productsQuery, [productIds]);
        
        const productsMap = {};
        for (const p of productsResult.rows) {
            productsMap[p.product_id] = p;
        }

        let total = 0;
        for (const item of cart.items) {
            const product = productsMap[item.productId];
            if (!product) {
                throw new AppError(`Product not found: ${item.name}`, 404);
            }
            if (product.product_stock < item.quantity) {
                throw new AppError(`Insufficient stock for product: ${product.product_name}`, 400);
            }
            total += parseFloat(product.product_price) * item.quantity;
        }

        // Insert order with status = 'awaiting_payment'
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, status, total, shipping_address)
             VALUES ($1, 'awaiting_payment', $2, $3)
             RETURNING *`,
            [userId, total, shippingAddress]
        );
        const order = orderResult.rows[0];

        // Insert order_items (no stock deduction, no cart clear yet)
        for (const item of cart.items) {
            const product = productsMap[item.productId];
            await client.query(
                `INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                 VALUES ($1, $2, $3, $4, $5)`,
                [order.id, product.product_id, product.product_name, product.product_price, item.quantity]
            );
        }

        await client.query('COMMIT');

        // Return the pending order ID and the line items for Stripe
        return {
            orderId: order.id,
            items: cart.items.map((i) => ({
                name:     productsMap[i.productId].product_name,
                price:    productsMap[i.productId].product_price,
                quantity: i.quantity,
            })),
        };

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '55P03') {
            throw new AppError('Could not process order due to high demand. Please try again.', 409);
        }
        throw error;
    } finally {
        client.release();
    }
};

/**
 * getOrderBySessionId — used by the confirmation page to look up the order
 * that was just paid via Stripe.
 *
 * @param {string} sessionId  Stripe checkout session ID (cs_test_...)
 * @param {string} userId     Must match to prevent ID enumeration
 * @returns {Promise<Object>} order with .items array
 */
const getOrderBySessionId = async (sessionId, userId) => {
    const orderResult = await pool.query(
        `SELECT * FROM orders WHERE stripe_session_id = $1 AND user_id = $2`,
        [sessionId, userId]
    );

    if (orderResult.rows.length === 0) {
        return null; // caller renders a generic thank-you if null
    }

    const order = orderResult.rows[0];
    const itemsResult = await pool.query(
        `SELECT * FROM order_items WHERE order_id = $1`,
        [order.id]
    );
    order.items = itemsResult.rows;
    return order;
};


const createOrder = async (userId, shippingAddress) => {
    const cart = await cartService.getCart(userId);
    if (!cart.items || cart.items.length === 0) {
        throw new AppError('Your cart is empty', 400);
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Step a: Fetch products and lock
        const productIds = cart.items.map(item => item.productId);
        const productsQuery = `
            SELECT id as product_id, name as product_name, price as product_price, stock as product_stock
            FROM products
            WHERE id = ANY($1)
            FOR UPDATE NOWAIT
        `;
        const productsResult = await client.query(productsQuery, [productIds]);
        
        const productsMap = {};
        for (const p of productsResult.rows) {
            productsMap[p.product_id] = p;
        }

        let total = 0;

        // Step b & c: Validate stock and calculate total
        for (const item of cart.items) {
            const product = productsMap[item.productId];
            if (!product) {
                throw new AppError(`Product not found: ${item.name}`, 404);
            }
            if (product.product_stock < item.quantity) {
                throw new AppError(`Insufficient stock for product: ${product.product_name}`, 400);
            }
            total += (parseFloat(product.product_price) * item.quantity);
        }

        // Step d: Insert order
        const orderInsertQuery = `
            INSERT INTO orders (user_id, status, total, shipping_address)
            VALUES ($1, 'confirmed', $2, $3)
            RETURNING *
        `;
        const orderResult = await client.query(orderInsertQuery, [
            userId, 
            total, 
            shippingAddress
        ]);
        const order = orderResult.rows[0];

        // Step e: Insert order items and Step f: Deduct stock
        for (const item of cart.items) {
            const product = productsMap[item.productId];
            const orderItemQuery = `
                INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await client.query(orderItemQuery, [
                order.id,
                product.product_id,
                product.product_name,
                product.product_price,
                item.quantity
            ]);

            const deductStockQuery = `
                UPDATE products 
                SET stock = stock - $1 
                WHERE id = $2
            `;
            await client.query(deductStockQuery, [item.quantity, product.product_id]);
        }

        await client.query('COMMIT');

        // Step g: Clear cart
        await cartService.clearCart(userId);

        // Step h: Return the created order
        return order;

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '55P03') { // PostgreSQL error code for lock not available
            throw new AppError('Could not process order due to high demand. Please try again.', 409);
        }
        throw error;
    } finally {
        client.release();
    }
};

const getOrderById = async (orderId, userId) => {
    // Fetch order
    const orderQuery = `
        SELECT * FROM orders 
        WHERE id = $1 AND user_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, userId]);
    
    if (orderResult.rows.length === 0) {
        throw new AppError('Order not found', 404);
    }
    const order = orderResult.rows[0];

    // Fetch order items
    const itemsQuery = `
        SELECT * FROM order_items
        WHERE order_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [orderId]);
    order.items = itemsResult.rows;

    return order;
};

const getOrdersByUser = async (userId) => {
    const query = `
        SELECT * FROM orders 
        WHERE user_id = $1
        ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
};

module.exports = {
    createOrder,
    createPendingOrder,
    getOrderById,
    getOrdersByUser,
    getOrderBySessionId,
};
