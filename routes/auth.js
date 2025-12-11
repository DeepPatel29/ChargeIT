const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const crypto = require('crypto'); 
const jwt = require('jsonwebtoken'); // 🚨 NEW: Import JWT for token handling
const admin = require('firebase-admin'); // Import directly

// ==========================================
// 1. ROBUST FIREBASE INITIALIZATION (FIXED FOR VERCEL)
// ==========================================
// This ensures Google Login works by loading credentials from ENV
if (!admin.apps.length) {
    try {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // Vercel / Render (Production)
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else {
            // Local Development (Fallback to local file)
            serviceAccount = require('../firebase-service-account.json');
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    } catch (error) {
        console.error("❌ Firebase Init Error:", error.message);
    }
}

// ==========================================
// 2. HELPER: Generate Token & Set Cookie
// ==========================================
const createTokenAndCookie = (user, res) => {
    // Payload contains the data needed for user identification
    const payload = {
        id: user._id, 
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
    };

    const token = jwt.sign(payload, process.env.SESSION_SECRET || 'fallback-secret-key', {
        expiresIn: '1d' // Token valid for 1 day
    });

    res.cookie('token', token, {
        httpOnly: true, // Prevents client-side JS access (security)
        secure: process.env.NODE_ENV === 'production', // HTTPS only on Vercel
        maxAge: 24 * 60 * 60 * 1000 // 1 Day
    });
};


// Registration form
router.get('/register', (req, res) => {
    // 🚨 JWT FIX: Check req.user
    if (req.user) { 
        return res.redirect('/');
    }
    res.render('auth/register', {
        title: 'Register - ChargeIT',
        errors: []
    });
});

// Registration processing
router.post('/register', [
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .trim(),
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match')
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            title: 'Register - ChargeIT',
            errors: errors.array(),
            formData: req.body
        });
    }

    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.render('auth/register', {
                title: 'Register - ChargeIT',
                errors: [{ msg: 'User with this email or username already exists' }],
                formData: req.body
            });
        }

        const user = new User({ username, email, password });
        await user.save();

        // 🚨 JWT FIX: Issue Token & Cookie
        createTokenAndCookie(user, res);
        res.redirect('/');

    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Register - ChargeIT',
            errors: [{ msg: 'Registration failed. Please try again.' }],
            formData: req.body
        });
    }
});

// Login form
router.get('/login', (req, res) => {
    // 🚨 JWT FIX: Check req.user
    if (req.user) {
        return res.redirect('/');
    }
    res.render('auth/login', {
        title: 'Login - ChargeIT',
        errors: []
    });
});

// Login processing
router.post('/login', [
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('auth/login', {
            title: 'Login - ChargeIT',
            errors: errors.array(),
            formData: req.body
        });
    }

    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.render('auth/login', {
                title: 'Login - ChargeIT',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Login - ChargeIT',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        // 🚨 JWT FIX: Issue Token & Cookie
        createTokenAndCookie(user, res);
        res.redirect('/');

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', {
            title: 'Login - ChargeIT',
            errors: [{ msg: 'Login failed. Please try again.' }],
            formData: req.body
        });
    }
});

// Google Login Processing
router.post('/google', async (req, res) => {
    const { token } = req.body;

    // Check if Firebase Admin SDK is initialized
    if (!admin.apps.length) {
        return res.status(500).json({ success: false, message: 'Server configuration error: Firebase not initialized.' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { email, name } = decodedToken;

        let user = await User.findOne({ email });

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            
            let username = name || email.split('@')[0];
            const userExists = await User.findOne({ username });
            if (userExists) {
                username += Math.floor(Math.random() * 1000);
            }

            user = new User({
                username: username,
                email: email,
                password: randomPassword,
                isAdmin: false
            });
            await user.save();
        }

        // 🚨 JWT FIX: Issue Token & Cookie
        createTokenAndCookie(user, res);
        res.json({ success: true });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    // 🚨 JWT FIX: Clear the cookie
    res.clearCookie('token');
    res.redirect('/');
});
// Add GET logout fallback for safety
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

module.exports = router;