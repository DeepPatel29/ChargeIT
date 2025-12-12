const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Check if MONGODB_URI is provided
        if (!process.env.MONGODB_URI) {
            console.warn(' MONGODB_URI not found in environment variables');
            console.log('Using in-memory data instead. Some features will be limited.');
            return null;
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Remove deprecated options
            serverSelectionTimeoutMS: 10000, // Keep trying to send operations for 10 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('Database connection error:', error.message);
        console.log('Using in-memory data instead. Some features will be limited.');

        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        return null;
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.log('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

// Close the connection when app is terminated
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('Mongoose connection closed through app termination');
    process.exit(0);
});

module.exports = connectDB;