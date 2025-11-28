const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { engine } = require('express-handlebars');
const path = require('path');
require('dotenv').config();

const app = express();

// Database connection - non-blocking
const connectDB = require('./config/database');

// Initialize database connection but don't block app startup
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
    console.log('💡 Using sample data instead');
});

// Make db status available to routes and templates
app.locals.dbConnected = () => dbConnected;

// Handlebars configuration with custom helpers
app.engine('hbs', engine({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: {
        // Comparison helpers
        eq: (a, b) => a === b,
        neq: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,

        // Logical helpers
        and: (a, b) => a && b,
        or: (a, b) => a || b,

        // Loop helper for stars
        times: (n, block) => {
            let accum = '';
            for (let i = 0; i < n; i++) {
                accum += block.fn(i);
            }
            return accum;
        },

        // Math helpers
        subtract: (a, b) => a - b,
        add: (a, b) => a + b,

        // Formatting helpers
        formatDate: (date) => {
            if (!date) return '';
            try {
                return new Date(date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                return 'Invalid Date';
            }
        },

        // JSON helper for debugging
        json: (context) => {
            try {
                return JSON.stringify(context, null, 2);
            } catch (e) {
                return 'Invalid JSON';
            }
        },

        // Array helpers
        length: (array) => {
            return array ? array.length : 0;
        },

        // String helpers
        uppercase: (str) => {
            return str ? str.toUpperCase() : '';
        },

        // Conditional class helper
        ifEq: (a, b, options) => {
            if (a === b) {
                return options.fn(this);
            }
            return options.inverse(this);
        }
    }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'chargeit-development-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Global variables for templates
app.use((req, res, next) => {
    // User session data
    res.locals.user = req.session.user || null;

    // Database status
    res.locals.dbConnected = dbConnected;

    // Environment
    res.locals.NODE_ENV = process.env.NODE_ENV || 'development';

    // App info
    res.locals.appName = 'ChargeIT';
    res.locals.appVersion = '1.0.0';

    // Request info for debugging
    res.locals.currentPath = req.path;

    next();
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/stations', require('./routes/stations'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: dbConnected ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'ChargeIT API is running',
        version: '1.0.0',
        database: {
            connected: dbConnected,
            status: dbConnected ? 'operational' : 'using sample data'
        },
        server: {
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Error stack:', err.stack);

    // Determine if it's an API request
    const isApiRequest = req.path.startsWith('/api') || req.get('Content-Type') === 'application/json';

    if (isApiRequest) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
    }

    res.status(500).render('error', {
        title: 'Server Error - ChargeIT',
        message: 'Something went wrong on our end!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler - MUST be last
app.use((req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);

    // Determine if it's an API request
    const isApiRequest = req.path.startsWith('/api') || req.get('Content-Type') === 'application/json';

    if (isApiRequest) {
        return res.status(404).json({
            success: false,
            message: 'Endpoint not found',
            requested: req.url,
            availableEndpoints: [
                'GET /api/stations',
                'GET /api/status',
                'GET /health'
            ]
        });
    }

    res.status(404).render('error', {
        title: 'Page Not Found - ChargeIT',
        message: `The page "${req.url}" was not found.`,
        suggestion: 'Check the URL or go back to the homepage.'
    });
});

// Server configuration
const PORT = process.env.PORT || 3000;

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');

    if (dbConnected) {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    }

    console.log('👋 ChargeIT server stopped');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 ChargeIT Server Started Successfully!');
    console.log('='.repeat(50));
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${dbConnected ? '✅ Connected' : '⚠️  Using sample data'}`);
    console.log(`🕒 Started: ${new Date().toISOString()}`);
    console.log('='.repeat(50));
    console.log('📋 Available Routes:');
    console.log('   GET  /                 - Homepage');
    console.log('   GET  /stations         - All stations');
    console.log('   GET  /stations/search  - Search stations');
    console.log('   GET  /stations/:id     - Station details');
    console.log('   GET  /stations/city/:city - Stations by city');
    console.log('   GET  /api/stations     - JSON API');
    console.log('   GET  /auth/login       - Login page');
    console.log('   GET  /auth/register    - Registration page');
    console.log('   GET  /about            - About page');
    console.log('   GET  /health           - Health check');
    console.log('   GET  /api/status       - API status');
    console.log('='.repeat(50));
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.log('💡 Try:');
        console.log('   - Using a different port: PORT=3001 npm run dev');
        console.log('   - Killing the process using the port');
    } else {
        console.error('❌ Server error:', error);
    }
    process.exit(1);
});

module.exports = app;