require('dotenv').config();
const { Worker } = require('bullmq');
const pool = require('../config/db');
const cartService = require('../services/cartService');
const { client: connection } = require('../config/redis');

const worker = new Worker('order-processing', async (job) => {
    const { userId, shippingAddress, cart } = job.data;
    console.log(`Processing order for user ${userId}, job ID ${job.id}`);
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Step a: Fetch products and lock
        const productIds = cart.items.map(item => item.productId);
        const productsQuery = `
            SELECT id as product_id, name as product_name, price as product_price, stock as product_stock
            FROM products
            WHERE id = ANY($1)
            FOR UPDATE
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
                throw new Error(`Product not found: ${item.name}`);
            }
            if (product.product_stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${product.product_name}`);
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

        console.log(`Order ${order.id} processed successfully for user ${userId}`);

        return order;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to process order for user ${userId}:`, error.message);
        throw error; // Rethrow to let BullMQ handle retry or move to failed set
    } finally {
        client.release();
    }

}, { connection, concurrency: 2 }); // Low concurrency to avoid starving the web server's DB pool

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed with ${err.message}`);
});

console.log('Order worker is running...');
