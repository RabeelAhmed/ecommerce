const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const categorySlug = req.query.category || '';
    const search = req.query.search || '';

    const { products, totalPages, currentPage, totalProducts } = await productService.getAllProducts({
        categorySlug,
        search,
        page,
        limit
    });

    const categories = await productService.getAllCategories();

    res.render('pages/shop', {
        title: 'Shop',
        products,
        categories,
        pagination: {
            totalPages,
            currentPage,
            totalProducts
        },
        filters: {
            category: categorySlug,
            search
        }
    });
}));

router.get('/:slug', asyncHandler(async (req, res) => {
    const product = await productService.getProductBySlug(req.params.slug);
    
    res.render('pages/product', {
        title: product.name,
        product
    });
}));

module.exports = router;
