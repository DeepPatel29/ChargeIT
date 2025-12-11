const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // NEW IMPORT

// Try to load firebase admin
let admin;
try {
    admin = require('../config/firebase');
} catch (error) {
    console.warn("⚠️ Firebase Admin not initialized.");
}

// ==========================================
// HELPER: Generate Token & Set Cookie
// ==========================================
const createTokenAndCookie = (user, res) => {
    // 1. Create Payload (Data inside the token)
    const payload = {
        id: user._id, 
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
    };

    // 2. Sign Token
    const token = jwt.sign(payload, process.env.SESSION_SECRET || 'fallback-secret-key', {
        expiresIn: '1d' // Token valid for 1 day
    });

    // 3. Send Cookie
    res.cookie('token', token, {
        httpOnly: true, // Security: JavaScript cannot read this (prevents XSS)
        secure: process.env.NODE_ENV === 'production', // HTTPS only on Vercel
        maxAge: 24 * 60 * 60 * 1000 // 1 Day
    });
};

// Registration form
router.get('/register', (req, res) => {
    if (req.user) return res.redirect('/'); // Changed from req.session.user
    res.render('auth/register', { title: 'Register - ChargeIT', errors: [] });
});

// Registration processing
router.post('/register', [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register', { title: 'Register - ChargeIT', errors: errors.array(), formData: req.body });
    }

    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });

        if (existingUser) {
            return res.render('auth/register', {
                title: 'Register - ChargeIT',
                errors: [{ msg: 'User with this email or username already exists' }],
                formData: req.body
            });
        }

        const user = new User({ username, email, password });
        await user.save();

        // Auto-login (Issue Token)
        createTokenAndCookie(user, res);
        res.redirect('/');

    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', { title: 'Register - ChargeIT', errors: [{ msg: 'Registration failed.' }], formData: req.body });
    }
});

// Login form
router.get('/login', (req, res) => {
    if (req.user) return res.redirect('/'); // Changed from req.session.user
    res.render('auth/login', { title: 'Login - ChargeIT', errors: [] });
});

// Login processing
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/login', { title: 'Login - ChargeIT', errors: errors.array(), formData: req.body });
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.render('auth/login', {
                title: 'Login - ChargeIT',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        // Login Success (Issue Token)
        createTokenAndCookie(user, res);
        res.redirect('/');

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { title: 'Login - ChargeIT', errors: [{ msg: 'Login failed.' }], formData: req.body });
    }
});

// Google Login Processing
router.post('/google', async (req, res) => {
    const { token } = req.body;
    if (!admin) return res.status(500).json({ success: false, message: 'Firebase not initialized.' });

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { email, name } = decodedToken;

        let user = await User.findOne({ email });

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            let username = name || email.split('@')[0];
            const userExists = await User.findOne({ username });
            if (userExists) username += Math.floor(Math.random() * 1000);

            user = new User({ username, email, password: randomPassword, isAdmin: false });
            await user.save();
        }

        // Login Success (Issue Token)
        createTokenAndCookie(user, res);
        res.json({ success: true });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token'); // Delete the cookie
    res.redirect('/');
});
router.get('/logout', (req, res) => {
    res.clearCookie('token'); // Delete the cookie
    res.redirect('/');
});

module.exports = router;