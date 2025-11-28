const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

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