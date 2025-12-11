const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser'); // NEW: Reads cookies
const jwt = require('jsonwebtoken');           // NEW: Handles tokens
const { engine } = require('express-handlebars');
const path = require('path');
require('dotenv').config();

const app = express();

// --- Trust Proxy (Required for Vercel/Render) ---
app.set('trust proxy', 1);

// Database connection
const connectDB = require('./config/database');

let dbConnected = false;
console.log('🔄 Initializing database connection...');

// Connect immediately, but errors won't crash the build step
connectDB().then(conn => {
    if (conn) {
        dbConnected = true;
        console.log('✅ Database connection ready');
    } else {
        console.log('⚠️  Running with in-memory data');
    }
}).catch(err => {
    console.log('❌ Database connection failed:', err.message);
});

app.locals.dbConnected = () => dbConnected;

// Handlebars configuration
app.engine('hbs', engine({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: {
        eq: (a, b) => a === b,
        neq: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,
        and: (a, b) => a && b,
        or: (a, b) => a || b,
        times: (n, block) => {
            let accum = '';
            for (let i = 0; i < n; i++) accum += block.fn(i);
            return accum;
        },
        subtract: (a, b) => a - b,
        add: (a, b) => a + b,
        formatDate: (date) => {
            if (!date) return '';
            try {
                return new Date(date).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            } catch (e) { return 'Invalid Date'; }
        },
        json: (context) => JSON.stringify(context, null, 2),
        toFixed: (num, digits) => {
            if (typeof num !== 'number') return num;
            return num.toFixed(digits);
        },
        length: (array) => array ? array.length : 0,
        uppercase: (str) => str ? str.toUpperCase() : '',
        ifEq: (a, b, options) => a === b ? options.fn(this) : options.inverse(this),
        includes: (array, value) => {
            if (!array) return false;
            return array.includes(value);
        }
    }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🔐 JWT & COOKIE CONFIGURATION
// ==========================================

// 1. Add Cookie Parser (Reads the 'token' cookie from browser)
app.use(cookieParser());

// 2. Authentication Middleware (Runs on EVERY page load)
app.use((req, res, next) => {
    const token = req.cookies.token;

    // Default: No user
    req.user = null;
    res.locals.user = null;

    if (token) {
        try {
            // Verify token. Use a fallback secret if .env is missing locally
            const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'fallback-secret-key');
            
            // Success! Attach user data to Request and Locals (for Handlebars)
            req.user = decoded; 
            res.locals.user = decoded; 
        } catch (err) {
            // Token is invalid or expired -> Clear it
            res.clearCookie('token');
        }
    }

    // Global variables for Handlebars
    res.locals.dbConnected = dbConnected;
    res.locals.NODE_ENV = process.env.NODE_ENV || 'development';
    res.locals.appName = 'ChargeIT';
    
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/stations', require('./routes/stations'));
app.use('/admin', require('./routes/admin'));

// 404 & Error Handlers
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: `The page "${req.url}" was not found.`
    });
});

// ==========================================
// 🚀 VERCEL DEPLOYMENT CONFIGURATION
// ==========================================
const PORT = process.env.PORT || 3000;

// Only listen if running locally. Vercel handles this automatically.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 ChargeIT Server Started on port ${PORT}`);
    });
}

// Export the app for Vercel Serverless Functions
module.exports = app;