const stripe = require('../config/stripe');
const pool = require('../config/db');

/**
 * POST /api/webhook
 * Raw-body endpoint — must be registered BEFORE express.json() in app.js.
 * Stripe signs every event; we verify the signature before acting.
 */
const handleWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const rawBody   = req.body; // Buffer (express.raw middleware)

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('[Webhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // ── Handle checkout.session.completed ────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const pendingOrderId = session.client_reference_id;
        const userId         = session.metadata && session.metadata.userId;

        if (!pendingOrderId || !userId) {
            console.error('[Webhook] Missing client_reference_id or userId in session metadata.');
            return res.status(200).json({ received: true }); // acknowledge but log
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Lock the order row and confirm it is still awaiting payment
            const orderRes = await client.query(
                `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
                [pendingOrderId]
            );
            const order = orderRes.rows[0];

            if (!order) {
                console.error(`[Webhook] Order ${pendingOrderId} not found.`);
                await client.query('ROLLBACK');
                return res.status(200).json({ received: true });
            }

            // Idempotency guard — if already paid, skip processing
            if (order.status === 'paid') {
                console.log(`[Webhook] Order ${pendingOrderId} already paid. Skipping.`);
                await client.query('ROLLBACK');
                return res.status(200).json({ received: true });
            }

            // 2. Fetch order items so we can deduct stock
            const itemsRes = await client.query(
                `SELECT oi.product_id, oi.quantity
                 FROM order_items oi
                 WHERE oi.order_id = $1`,
                [pendingOrderId]
            );
            const items = itemsRes.rows;

            // 3. Deduct stock for each product (with row-level lock)
            for (const item of items) {
                const stockRes = await client.query(
                    `SELECT stock FROM products WHERE id = $1 FOR UPDATE`,
                    [item.product_id]
                );
                const product = stockRes.rows[0];

                if (!product) {
                    console.warn(`[Webhook] Product ${item.product_id} not found during stock deduction.`);
                    continue;
                }

                if (product.stock < item.quantity) {
                    // Log but do NOT abort — stock was validated at createPendingOrder.
                    // In production you'd trigger a back-order workflow here.
                    console.warn(
                        `[Webhook] Insufficient stock for product ${item.product_id}. ` +
                        `Available: ${product.stock}, Required: ${item.quantity}. Proceeding anyway.`
                    );
                }

                await client.query(
                    `UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2`,
                    [item.quantity, item.product_id]
                );
            }

            // 4. Clear the user's cart
            await client.query(
                `DELETE FROM cart_items
                 WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)`,
                [userId]
            );

            // 5. Mark order as paid and store the session ID
            await client.query(
                `UPDATE orders
                 SET status = 'paid', stripe_session_id = $1
                 WHERE id = $2`,
                [session.id, pendingOrderId]
            );

            await client.query('COMMIT');
            console.log(`[Webhook] Order ${pendingOrderId} marked as paid.`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[Webhook] Transaction failed:', err);
            // Return 500 so Stripe will retry
            return res.status(500).json({ error: 'Internal server error during order fulfilment.' });
        } finally {
            client.release();
        }
    }

    return res.status(200).json({ received: true });
};

module.exports = { handleWebhook };
