const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Import Connect Mongo
const { engine } = require('express-handlebars');
const path = require('path');
require('dotenv').config();

const app = express();

// --- 1. Trust Proxy (Required for Vercel/Render) ---
// This ensures cookies work correctly behind their load balancers
app.set('trust proxy', 1);

// Database connection
const connectDB = require('./config/database');

let dbConnected = false;
console.log('🔄 Initializing database connection...');

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

// --- 2. Session with MongoDB Store (The Fix) ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'chargeit-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI, // Stores session in MongoDB
        collectionName: 'sessions',      // Name of the collection
        ttl: 24 * 60 * 60                // Session lasts 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true on Vercel (HTTPS), false on localhost
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 ChargeIT Server Started on port ${PORT}`);
});
//updates
module.exports = app;