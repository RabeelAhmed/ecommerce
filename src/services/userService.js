const bcrypt = require('bcryptjs');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const createUser = async (email, password, fullName) => {
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Ensure table has email, password_hash, full_name, role
    try {
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, role) 
             VALUES ($1, $2, $3, 'customer') 
             RETURNING id, email, full_name, role, created_at`,
            [email, passwordHash, fullName]
        );
        return result.rows[0];
    } catch (err) {
        if (err.code === '23505') { // Postgres unique violation
            throw new AppError('Email already in use', 400);
        }
        throw err;
    }
};

const authenticateUser = async (email, password) => {
    const result = await db.query(
        `SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1`,
        [email]
    );
    
    const user = result.rows[0];
    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new AppError('Invalid email or password', 401);
    }
    
    // Remove password_hash before returning
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

const findUserById = async (id) => {
    const result = await db.query(
        `SELECT id, email, full_name, role, created_at FROM users WHERE id = $1`,
        [id]
    );
    
    return result.rows[0];
};

module.exports = {
    createUser,
    authenticateUser,
    findUserById
};
