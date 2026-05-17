const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const asyncHandler = require('../middleware/asyncHandler');
const NodeCache = require('node-cache');

// Create a cache instance with a default TTL of 30 seconds
const cache = new NodeCache({ 
    stdTTL: process.env.CACHE_TTL_SECONDS || 30,
    useClones: false // Essential for performance when caching large HTML strings
});

const pendingRequests = new Map();

router.get('/', asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const categorySlug = req.query.category || '';
    const search = req.query.search || '';

    // Create a cache key based on request parameters
    const cacheKey = `products_${page}_${limit}_${categorySlug}_${search}`;

    // 1. Check if the response is already in the cache
    const cachedHtml = cache.get(cacheKey);
    if (cachedHtml) {
        res.setHeader('X-Cache', 'HIT');
        return res.send(cachedHtml);
    }

    // 2. Prevent Cache Stampede (Thundering Herd)
    // If a request for this key is already in progress, wait for it instead of querying DB again
    if (pendingRequests.has(cacheKey)) {
        try {
            const html = await pendingRequests.get(cacheKey);
            res.setHeader('X-Cache', 'HIT-WAIT');
            return res.send(html);
        } catch (err) {
            return next(err);
        }
    }

    let resolveWork, rejectWork;
    const workPromise = new Promise((resolve, reject) => {
        resolveWork = resolve;
        rejectWork = reject;
    });
    pendingRequests.set(cacheKey, workPromise);

    (async () => {
        try {
            const { products, totalPages, currentPage, totalProducts } = await productService.getAllProducts({
                categorySlug, search, page, limit
            });
            const categories = await productService.getAllCategories();

            let desc = 'Browse our curated collection of handcrafted artisan goods at NOMADICA.';
            if (search) desc = `Search results for "${search}" \u2013 NOMADICA handcrafted collection.`;
            else if (categorySlug) desc = `Shop ${categorySlug} \u2013 handcrafted artisan goods from NOMADICA.`;

            res.render('pages/shop', {
                title: search ? `"${search}" \u2013 Shop` : categorySlug ? `${categorySlug} \u2013 Shop` : 'Shop',
                description: desc, products, categories,
                pagination: { totalPages, currentPage, totalProducts },
                filters: { category: categorySlug, search }
            }, (err, html) => {
                if (err) return rejectWork(err);
                // Store the result in the cache
                cache.set(cacheKey, html);
                resolveWork(html);
            });
        } catch (err) {
            rejectWork(err);
        }
    })();

    try {
        const html = await workPromise;
        res.setHeader('X-Cache', 'MISS');
        res.send(html);
    } catch (err) {
        next(err);
    } finally {
        pendingRequests.delete(cacheKey);
    }
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

