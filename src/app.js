require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ejsLayouts = require('express-ejs-layouts');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');
const { attachCsrf } = require('./middleware/csrf');
const webhookController = require('./controllers/webhookController');

const app = express();

// ─── Stripe Webhook ──────────────────────────────────────────────────────────
// MUST be registered BEFORE any body-parsing middleware so req.body is a raw
// Buffer. This route is intentionally excluded from CSRF, auth, and rate limiter.
app.post(
    '/api/webhook',
    express.raw({ type: 'application/json' }),
    webhookController.handleWebhook
);

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc:    ["'self'", "https://fonts.gstatic.com"],
            imgSrc:     ["'self'", "data:", "https:"],
            scriptSrc:  ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100000, // Increased for stress testing from localhost
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', apiLimiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')(process.env.COOKIE_SECRET || 'nomadica_secret'));

// Static Folder
app.use(express.static(path.join(__dirname, '../public')));

// View Engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

// Attach CSRF token to every response (must run before routes)
app.use(attachCsrf);

// Attach Cart data to res.locals
app.use(require('./middleware/attachCart'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/', require('./routes/cartRoutes'));
app.use('/shop',    require('./routes/shopRoutes'));
app.use('/', require('./routes/orderRoutes'));

// ─── Home Page ───────────────────────────────────────────────────────────────
const productService = require('./services/productService');
const asyncHandler   = require('./middleware/asyncHandler');
const NodeCache = require('node-cache');

const homeCache = new NodeCache({ stdTTL: process.env.CACHE_TTL_SECONDS || 30, useClones: false });
const pendingHomeRequests = new Map();

const orderService = require('./services/orderService');

app.get('/account', asyncHandler(async (req, res) => {
    let orders = [];
    if (res.locals.user && res.locals.user.userId) {
        orders = await orderService.getOrdersByUser(res.locals.user.userId);
    }
    
    res.render('pages/account', {
        title: 'Account',
        description: 'Manage your NOMADICA account, view order history, and update your profile.',
        orders,
        returnTo: req.query.returnTo || null,
    });
}));

app.get('/', asyncHandler(async (req, res, next) => {
    const cacheKey = 'home_page';
    
    const cachedHtml = homeCache.get(cacheKey);
    if (cachedHtml) {
        res.setHeader('X-Cache', 'HIT');
        return res.send(cachedHtml);
    }
    
    if (pendingHomeRequests.has(cacheKey)) {
        try {
            const html = await pendingHomeRequests.get(cacheKey);
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
    pendingHomeRequests.set(cacheKey, workPromise);
    
    (async () => {
        try {
            const { products } = await productService.getAllProducts({ page: 1, limit: 4 });
            res.render('pages/home', {
                title: 'Home',
                description: 'NOMADICA – Handcrafted goods from around the world. Discover unique artisan treasures, ethically sourced and beautifully made.',
                products,
            }, (err, html) => {
                if (err) return rejectWork(err);
                homeCache.set(cacheKey, html);
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
        pendingHomeRequests.delete(cacheKey);
    }
}));

// 404 Catch-all — pass AppError to global handler
app.use((req, res, next) => {
    next(new AppError('The page you are looking for could not be found.', 404));
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer(app).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    warmProductCache();
});

/**
 * Pre-load all active products into Redis on startup.
 * This ensures addItemToCart never needs a PG round-trip for product details.
 */
async function warmProductCache() {
    const { client: redis } = require('./config/redis');
    const pool = require('./config/db');

    // Wait up to 8s for Redis to be ready
    let waited = 0;
    while (redis.status !== 'ready' && waited < 8000) {
        await new Promise(r => setTimeout(r, 250));
        waited += 250;
    }

    if (redis.status !== 'ready') {
        console.warn('Product cache warm-up skipped: Redis not ready after 8s');
        return;
    }

    try {
        const { rows } = await pool.query(
            'SELECT id, name, price, stock, image_url as "imageUrl", slug FROM products WHERE is_active = true'
        );
        const pipeline = redis.pipeline();
        for (const p of rows) {
            pipeline.set(`product:${p.id}`, JSON.stringify(p), 'EX', 600);
        }
        await pipeline.exec();
        console.log(`Product cache warmed: ${rows.length} products loaded into Redis`);
    } catch (err) {
        console.warn('Product cache warm-up failed:', err.message);
    }
}

