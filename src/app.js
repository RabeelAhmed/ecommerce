require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ejsLayouts = require('express-ejs-layouts');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc:    ["'self'", "https://fonts.gstatic.com"],
            imgSrc:     ["'self'", "data:", "https://images.unsplash.com", "https://placehold.co"],
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
app.use(require('cookie-parser')());

// Static Folder
app.use(express.static(path.join(__dirname, '../public')));

// View Engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

// Attach Cart data to res.locals
app.use(require('./middleware/attachCart'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/', require('./routes/cartRoutes'));
app.use('/shop',    require('./routes/shopRoutes'));

// ─── Home Page ───────────────────────────────────────────────────────────────
const productService = require('./services/productService');
const asyncHandler   = require('./middleware/asyncHandler');

app.get('/account', asyncHandler(async (req, res) => {
    res.render('pages/account', {
        title: 'Account'
    });
}));

app.get('/', asyncHandler(async (req, res) => {
    const { products } = await productService.getAllProducts({ page: 1, limit: 4 });
    res.render('pages/home', {
        title: 'Home',
        products,
    });
}));

// 404 Catch-all
app.use((req, res, next) => {
    next(new AppError('Not found', 404));
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
