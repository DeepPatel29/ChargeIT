const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const crypto = require('crypto'); // Built-in Node module for generating random passwords

// Try to load firebase admin, handle error if not set up yet
let admin;
try {
    admin = require('../config/firebase');
} catch (error) {
    console.warn("⚠️ Firebase Admin not initialized. Google Login will not work until 'config/firebase-service-account.json' is present.");
}

// Registration form
router.get('/register', (req, res) => {
    if (req.session.user) {
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

        // Check if user already exists
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

        // Create new user
        const user = new User({ username, email, password });
        await user.save();

        // Auto-login after registration
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.redirect('/');
        });

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
    if (req.session.user) {
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

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('auth/login', {
                title: 'Login - ChargeIT',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Login - ChargeIT',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        // Set session
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            }
            res.redirect('/');
        });

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

    if (!admin) {
        return res.status(500).json({ success: false, message: 'Server configuration error: Firebase not initialized.' });
    }

    try {
        // Verify the token sent from the client
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { email, name, uid } = decodedToken;

        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user if they don't exist
            // We generate a random password to satisfy the model requirement
            // The user won't know this password, but can login via Google
            const randomPassword = crypto.randomBytes(16).toString('hex');
            
            // Generate a unique username if name is missing or taken
            let username = name || email.split('@')[0];
            // Basic check to ensure unique username (simple implementation)
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

        // Create Session
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.json({ success: false, message: 'Session error' });
            }
            res.json({ success: true });
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;