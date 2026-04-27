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

    // Build per-page description
    let desc = 'Browse our curated collection of handcrafted artisan goods at NOMADICA.';
    if (search) desc = `Search results for "${search}" \u2013 NOMADICA handcrafted collection.`;
    else if (categorySlug) desc = `Shop ${categorySlug} \u2013 handcrafted artisan goods from NOMADICA.`;

    res.render('pages/shop', {
        title: search ? `"${search}" \u2013 Shop` : categorySlug ? `${categorySlug} \u2013 Shop` : 'Shop',
        description: desc,
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
        description: product.description
            ? product.description.slice(0, 155)
            : `Shop ${product.name} \u2013 handcrafted and ethically sourced at NOMADICA.`,
        product
    });
}));

module.exports = router;

