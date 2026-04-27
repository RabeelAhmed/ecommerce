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

const app = express();

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
    origin: process.env.CORS_ORIGIN || '*'
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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

const orderService = require('./services/orderService');

app.get('/account', asyncHandler(async (req, res) => {
    let orders = [];
    if (res.locals.user && res.locals.user.userId) {
        orders = await orderService.getOrdersByUser(res.locals.user.userId);
    }
    
    res.render('pages/account', {
        title: 'Account',
        description: 'Manage your NOMADICA account, view order history, and update your profile.',
        orders
    });
}));

app.get('/', asyncHandler(async (req, res) => {
    const { products } = await productService.getAllProducts({ page: 1, limit: 4 });
    res.render('pages/home', {
        title: 'Home',
        description: 'NOMADICA – Handcrafted goods from around the world. Discover unique artisan treasures, ethically sourced and beautifully made.',
        products,
    });
}));

// 404 Catch-all — render dedicated 404 page
app.use((req, res) => {
    res.status(404).render('pages/404', {
        title: 'Page Not Found',
        description: 'The page you are looking for could not be found.',
    });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer(app).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// nodemon trigger 2
