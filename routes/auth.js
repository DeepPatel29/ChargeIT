const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // Ensure this is installed
const admin = require('firebase-admin'); // Import directly

// ==========================================
// 1. ROBUST FIREBASE INITIALIZATION
// ==========================================
// This fixes the "Firebase not initialized" error on Vercel
if (!admin.apps.length) {
    try {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // Vercel / Render (Production)
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log("✅ Auth Route: Loaded Firebase from Environment Variable");
        } else {
            // Local Development
            try {
                serviceAccount = require('../config/firebase-service-account.json');
                console.log("✅ Auth Route: Loaded Firebase from Local File");
            } catch (e) {
                console.warn("⚠️ Local firebase-service-account.json not found.");
            }
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

// Helper to generate Token & Cookie (reused from your previous setup)
const createTokenAndCookie = (user, res) => {
    const payload = {
        id: user._id, 
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
    };
    const token = jwt.sign(payload, process.env.SESSION_SECRET || 'fallback-secret', { expiresIn: '1d' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    });
};

// Registration Routes
router.get('/register', (req, res) => {
    if (req.user) return res.redirect('/');
    res.render('auth/register', { title: 'Register - ChargeIT', errors: [] });
});

router.post('/register', [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be 6+ chars'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords mismatch')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.render('auth/register', { title: 'Register', errors: errors.array(), formData: req.body });

    try {
        const { username, email, password } = req.body;
        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) return res.render('auth/register', { title: 'Register', errors: [{ msg: 'User already exists' }], formData: req.body });

        const user = new User({ username, email, password });
        await user.save();
        createTokenAndCookie(user, res);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('auth/register', { title: 'Register', errors: [{ msg: 'Server error' }], formData: req.body });
    }
});

// Login Routes
router.get('/login', (req, res) => {
    if (req.user) return res.redirect('/');
    res.render('auth/login', { title: 'Login - ChargeIT', errors: [] });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await user.comparePassword(password))) {
            return res.render('auth/login', { title: 'Login', errors: [{ msg: 'Invalid credentials' }], formData: req.body });
        }
        
        createTokenAndCookie(user, res);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('auth/login', { title: 'Login', errors: [{ msg: 'Login failed' }] });
    }
});

// Google Login Route (Fixed)
router.post('/google', async (req, res) => {
    const { token } = req.body;
    
    // Check if admin is actually initialized
    if (!admin.apps.length) {
        return res.status(500).json({ success: false, message: 'Firebase not configured on server.' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { email, name } = decodedToken;

        let user = await User.findOne({ email });

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            let username = name || email.split('@')[0];
            if (await User.findOne({ username })) username += Math.floor(Math.random() * 1000);

            user = new User({ username, email, password: randomPassword });
            await user.save();
        }

        createTokenAndCookie(user, res);
        res.json({ success: true });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, message: 'Invalid Google Token' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

module.exports = router;