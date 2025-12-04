const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// database connection logic
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to Database');
    } catch (error) {
        console.error('❌ Database connection error:', error);
        process.exit(1);
    }
};

const makeAdmin = async () => {
    // Get email from command line argument
    const email = process.argv[2];

    if (!email) {
        console.log('❌ Please provide an email address.');
        console.log('Usage: node scripts/make-admin.js user@example.com');
        process.exit(1);
    }

    await connectDB();

    try {
        const user = await User.findOne({ email: email });

        if (!user) {
            console.log(`❌ User with email "${email}" not found.`);
            process.exit(1);
        }

        if (user.isAdmin) {
            console.log(`⚠️  User "${user.username}" is already an Admin.`);
            process.exit(0);
        }

        user.isAdmin = true;
        await user.save();

        console.log(`🎉 Success! User "${user.username}" is now an Admin.`);
        console.log('👉 Log out and log back in to see the Admin Panel.');

    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

makeAdmin();