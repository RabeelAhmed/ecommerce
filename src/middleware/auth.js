const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const authenticate = (req, res, next) => {
    try {
        const token = req.cookies.access_token;
        if (!token) {
            throw new AppError('Authentication required. Please log in.', 401);
        }

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = {
            id: decoded.userId,      // alias used by orderRoutes, cartRoutes etc.
            userId: decoded.userId,  // kept for backwards compatibility
            role: decoded.role
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Token expired. Please refresh or log in again.', 401));
        }
        return next(new AppError('Invalid token. Please log in again.', 401));
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};

module.exports = {
    authenticate,
    authorize
};
