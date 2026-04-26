const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const userService = require('../services/userService');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes' }
});

router.use(authLimiter);

// Validation middleware
const validateRegister = [
    body('email').isEmail().withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('fullName').notEmpty().withMessage('Full name is required')
];

const validateLogin = [
    body('email').isEmail().withMessage('Please provide a valid email address'),
    body('password').notEmpty().withMessage('Password is required')
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Helper function to set cookies
const setTokenCookies = (res, accessToken, refreshToken) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Strict',
        path: '/',
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

router.post('/register', validateRegister, handleValidationErrors, asyncHandler(async (req, res) => {
    const { email, password, fullName } = req.body;
    
    const user = await userService.createUser(email, password, fullName);
    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    setTokenCookies(res, accessToken, refreshToken);
    
    res.status(201).json({
        message: 'Registration successful',
        user
    });
}));

router.post('/login', validateLogin, handleValidationErrors, asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const user = await userService.authenticateUser(email, password);
    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    setTokenCookies(res, accessToken, refreshToken);
    
    res.json({
        message: 'Login successful',
        user
    });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refresh_token;
    
    if (!refreshToken) {
        throw new AppError('Refresh token missing', 401);
    }
    
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        const user = await userService.findUserById(decoded.userId);
        if (!user) {
            throw new AppError('User not found', 401);
        }
        
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        
        setTokenCookies(res, newAccessToken, newRefreshToken);
        
        res.json({ message: 'Tokens refreshed successfully' });
    } catch (err) {
        throw new AppError('Invalid or expired refresh token', 401);
    }
}));

router.post('/logout', (req, res) => {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    
    res.json({ message: 'Logout successful' });
});

module.exports = router;
