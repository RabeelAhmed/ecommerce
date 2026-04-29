const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const productAdminService = require('../services/productAdminService');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { csrfProtection } = require('../middleware/csrf');

// ─── Product validation rules ────────────────────────────────────────────────
const validateProduct = [
    body('name').notEmpty().withMessage('Product name is required').trim().isLength({ max: 255 }),
    body('slug')
        .notEmpty().withMessage('Slug is required')
        .matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase letters, numbers, and hyphens only')
        .isLength({ max: 255 }),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('image_url').optional({ checkFalsy: true }).isURL().withMessage('Image URL must be a valid URL'),
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('pages/error', {
            title: 'Validation Error',
            message: errors.array().map(e => e.msg).join(', '),
            statusCode: 400,
        });
    }
    next();
};

// Protect all admin routes
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

// Override default layout for admin routes
router.use((req, res, next) => {
    res.locals.layout = 'layouts/admin';
    next();
});

// --- Dashboard ---
router.get('/', asyncHandler(async (req, res) => {
    const stats = await productAdminService.getDashboardStats();
    res.render('pages/admin/dashboard', {
        title: 'Admin Dashboard',
        stats
    });
}));

// --- Products Management ---
router.get('/products', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const { products, totalPages } = await productAdminService.getProducts(page, 10);
    res.render('pages/admin/products/index', {
        title: 'Manage Products',
        products,
        page,
        totalPages
    });
}));

router.get('/products/create', asyncHandler(async (req, res) => {
    const categories = await productAdminService.getCategories();
    res.render('pages/admin/products/form', {
        title: 'Create Product',
        product: {}, // Empty object for new product
        categories,
        action: '/admin/products/create'
    });
}));

router.post('/products/create', csrfProtection, validateProduct, handleValidationErrors, asyncHandler(async (req, res) => {
    await productAdminService.createProduct(req.body);
    res.redirect('/admin/products');
}));

router.get('/products/:id/edit', asyncHandler(async (req, res) => {
    const product = await productAdminService.getProductById(req.params.id);
    const categories = await productAdminService.getCategories();
    if (!product) {
        return res.status(404).render('pages/error', { title: 'Not Found', message: 'Product not found', statusCode: 404 });
    }
    res.render('pages/admin/products/form', {
        title: 'Edit Product',
        product,
        categories,
        action: `/admin/products/${req.params.id}/edit`
    });
}));

router.post('/products/:id/edit', csrfProtection, validateProduct, handleValidationErrors, asyncHandler(async (req, res) => {
    // Checkbox mapping: if not checked, it doesn't send 'is_active'. So we map it.
    const updateData = {
        ...req.body,
        is_active: req.body.is_active === 'on' || req.body.is_active === 'true'
    };
    await productAdminService.updateProduct(req.params.id, updateData);
    res.redirect('/admin/products');
}));

router.post('/products/:id/delete', csrfProtection, asyncHandler(async (req, res) => {
    await productAdminService.softDeleteProduct(req.params.id);
    res.redirect('/admin/products');
}));

// --- Orders Management ---
router.get('/orders', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const { orders, totalPages } = await productAdminService.getOrders(page, 10);
    res.render('pages/admin/orders/index', {
        title: 'Manage Orders',
        orders,
        page,
        totalPages
    });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
    const order = await productAdminService.getOrderById(req.params.id);
    if (!order) {
        return res.status(404).render('pages/error', { title: 'Not Found', message: 'Order not found', statusCode: 404 });
    }
    res.render('pages/admin/orders/show', {
        title: `Order Details - ${order.id}`,
        order
    });
}));

router.post('/orders/:id/status', csrfProtection, asyncHandler(async (req, res) => {
    const { status } = req.body;
    await productAdminService.updateOrderStatus(req.params.id, status);
    res.redirect(`/admin/orders/${req.params.id}`);
}));

module.exports = router;
