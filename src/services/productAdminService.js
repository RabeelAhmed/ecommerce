const pool = require('../config/db');

const productAdminService = {
    // --- Dashboard Statistics ---
    async getDashboardStats() {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM orders) AS total_orders,
                (SELECT COALESCE(SUM(total), 0) FROM orders) AS total_revenue,
                (SELECT COUNT(*) FROM products WHERE is_active = true) AS total_products
        `);
        return result.rows[0];
    },

    // --- Product Management ---
    async getProducts(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        
        const countResult = await pool.query('SELECT COUNT(*) FROM products');
        const total = parseInt(countResult.rows[0].count, 10);
        
        const productsResult = await pool.query(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        return {
            products: productsResult.rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    },

    async getProductById(id) {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        return result.rows[0];
    },

    async createProduct(data) {
        const { name, slug, description, price, stock, category_id, image_url, is_active } = data;
        const result = await pool.query(`
            INSERT INTO products (name, slug, description, price, stock, category_id, image_url, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true))
            RETURNING *
        `, [name, slug, description, price, stock, category_id || null, image_url, is_active]);
        return result.rows[0];
    },

    async updateProduct(id, data) {
        const { name, slug, description, price, stock, category_id, image_url, is_active } = data;
        const result = await pool.query(`
            UPDATE products 
            SET name = $1, slug = $2, description = $3, price = $4, stock = $5, 
                category_id = $6, image_url = $7, is_active = $8
            WHERE id = $9
            RETURNING *
        `, [name, slug, description, price, stock, category_id || null, image_url, is_active, id]);
        return result.rows[0];
    },

    async softDeleteProduct(id) {
        const result = await pool.query(`
            UPDATE products SET is_active = false WHERE id = $1 RETURNING *
        `, [id]);
        return result.rows[0];
    },

    async getCategories() {
        const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        return result.rows;
    },

    // --- Order Management ---
    async getOrders(page = 1, limit = 10) {
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM orders');
        const total = parseInt(countResult.rows[0].count, 10);

        const ordersResult = await pool.query(`
            SELECT o.*, u.email as customer_email, u.full_name as customer_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        return {
            orders: ordersResult.rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    },

    async getOrderById(id) {
        const orderResult = await pool.query(`
            SELECT o.*, u.email as customer_email, u.full_name as customer_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = $1
        `, [id]);

        if (orderResult.rows.length === 0) return null;
        const order = orderResult.rows[0];

        const itemsResult = await pool.query(`
            SELECT oi.*, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
        `, [id]);
        order.items = itemsResult.rows;

        return order;
    },

    async updateOrderStatus(id, status) {
        const result = await pool.query(`
            UPDATE orders SET status = $1 WHERE id = $2 RETURNING *
        `, [status, id]);
        return result.rows[0];
    }
};

module.exports = productAdminService;
