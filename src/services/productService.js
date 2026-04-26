const pool = require('../config/db');
const AppError = require('../utils/AppError');

exports.getAllProducts = async ({ categorySlug, search, page = 1, limit = 12 }) => {
    const offset = (page - 1) * limit;
    let queryArgs = [];
    let whereClauses = ['p.is_active = true'];
    let argIdx = 1;

    if (categorySlug) {
        whereClauses.push(`c.slug = $${argIdx++}`);
        queryArgs.push(categorySlug);
    }

    if (search) {
        whereClauses.push(`(p.name ILIKE $${argIdx} OR p.description ILIKE $${argIdx})`);
        queryArgs.push(`%${search}%`);
        argIdx++;
    }

    const whereString = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
        SELECT COUNT(*) 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereString}
    `;

    const productsQuery = `
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereString}
        ORDER BY p.created_at DESC
        LIMIT $${argIdx++} OFFSET $${argIdx++}
    `;

    const countResult = await pool.query(countQuery, queryArgs);
    const totalProducts = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    const productsResult = await pool.query(productsQuery, [...queryArgs, limit, offset]);

    return {
        products: productsResult.rows,
        totalPages,
        currentPage: page,
        totalProducts
    };
};

exports.getProductBySlug = async (slug) => {
    const query = `
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.slug = $1 AND p.is_active = true
    `;
    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
        throw new AppError('Product not found', 404);
    }

    return result.rows[0];
};

exports.getAllCategories = async () => {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    return result.rows;
};
