const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Station = require('../models/Station');
const PriceSuggestion = require('../models/PriceSuggestion'); 
const nodemailer = require('nodemailer'); // Required for email notifications

// EMAIL CONFIGURATION
// Uses explicit SMTP settings (more reliable than 'service: gmail' on cloud platforms)
// Requires Gmail App Password (not regular password) - set up at myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Middleware to check if user is Admin
const checkAdmin = async (req, res, next) => {
    if (!req.session || !req.session.user) {
        console.log('🔒 checkAdmin: No session/user found');
        return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'You must be logged in to access this area.',
            hint: 'Please login with your admin account.'
        });
    }

    console.log(`🔒 checkAdmin: Checking user id=${req.session.user.id} email=${req.session.user.email}`);

    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ checkAdmin: MongoDB not connected! readyState=' + mongoose.connection.readyState);
            return res.status(503).render('error', {
                title: 'Service Unavailable',
                message: 'Database not connected. Cannot verify admin status.',
                hint: 'Check MONGODB_URI in your Vercel environment variables.'
            });
        }

        const freshUser = await User.findById(req.session.user.id).select('isAdmin username email').lean();
        console.log(`🔒 checkAdmin: DB result =`, freshUser);

        if (freshUser && freshUser.isAdmin === true) {
            req.session.user.isAdmin = true;
            return next();
        }

        console.warn(`🔒 checkAdmin: DENIED — user ${freshUser?.email} isAdmin=${freshUser?.isAdmin}`);
        console.warn(`   TIP: Visit /auth/setup-admin?secret=YOUR_ADMIN_SECRET (while logged in) to grant admin access.`);
    } catch (dbErr) {
        console.error('❌ Admin DB check error:', dbErr.message);
        return res.status(500).render('error', {
            title: 'Server Error',
            message: 'Could not verify admin status: ' + dbErr.message
        });
    }

    return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have administrator privileges.',
        hint: 'If you should be an admin, use /auth/setup-admin?secret=YOUR_ADMIN_SECRET while logged in.'
    });
};

// Protect all admin routes
router.use(checkAdmin);

// Set admin layout + inject pendingSuggestions badge count for all admin pages
router.use(async (req, res, next) => {
    try {
        const pendingCount = await PriceSuggestion.countDocuments({ status: 'pending' });
        res.locals.pendingSuggestions = pendingCount;
    } catch(e) { res.locals.pendingSuggestions = 0; }

    const _render = res.render.bind(res);
    res.render = (view, options, callback) => {
        const opts = (typeof options === 'object' && options !== null) ? options : {};
        if (!opts.layout) opts.layout = 'admin';
        _render(view, opts, callback);
    };
    next();
});

// 1. ADMIN DASHBOARD
router.get('/', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const stationCount = await Station.countDocuments();
        const pendingSuggestions = await PriceSuggestion.countDocuments({ status: 'pending' });
        const approvedSuggestions = await PriceSuggestion.countDocuments({ status: 'approved' });

        const recentStations = await Station.find().sort({ createdAt: -1 }).limit(5).lean();
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).lean();

        // Chart data: stations by charger type
        const chargerTypeStats = await Station.aggregate([
            { $group: { _id: '$chargerType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Chart data: top 5 countries by station count
        const countryStats = await Station.aggregate([
            { $group: { _id: '$location.country', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            userCount,
            stationCount,
            pendingSuggestions,
            approvedSuggestions,
            recentStations,
            recentUsers,
            chargerTypeStatsJson: JSON.stringify(chargerTypeStats),
            countryStatsJson: JSON.stringify(countryStats)
        });
    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Dashboard Error' });
    }
});

// 2. PRICE SUGGESTIONS (CROWD CONSENSUS)

// GET: View Suggestions
router.get('/price-suggestions', async (req, res) => {
    try {
        const threshold = 3; // Threshold for enabling the "Approve" button

        const aggregatedSuggestions = await PriceSuggestion.aggregate([
            // 1. Only look at pending suggestions
            { $match: { status: 'pending' } },

            // 2. JOIN with Users collection to get Email & Username
            {
                $lookup: {
                    from: "users",          // MongoDB collection name for User model
                    localField: "userId",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            { $unwind: "$userInfo" },       // Flatten the user array

            // 3. Group by Station
            {
                $group: {
                    _id: "$stationDbId", 
                    stationDisplayId: { $first: "$stationId" }, 
                    userCount: { $sum: 1 }, 
                    avgPrice: { $avg: "$suggestedPrice" }, 
                    // Keep IDs for the "Approve All" logic
                    suggestionIds: { $push: "$_id" },
                    // Collect details for the dropdown list
                    details: { 
                        $push: {
                            username: "$userInfo.username",
                            email: "$userInfo.email",
                            price: "$suggestedPrice"
                        }
                    }
                }
            },

            // 4. Join with Station data for display info (City, Current Price)
            {
                $lookup: {
                    from: "stations", 
                    localField: "_id",
                    foreignField: "_id",
                    as: "stationData"
                }
            },
            { $unwind: "$stationData" }, 

            // 5. Sort by most requested (high consensus first)
            { $sort: { userCount: -1 } }
        ]);

        res.render('admin/price-suggestions', {
            title: 'Crowdsourced Price Updates',
            suggestions: aggregatedSuggestions,
            threshold
        });

    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Error fetching suggestions' });
    }
});

// POST: Approve (Update Station Price & Send Emails)
router.post('/price-suggestions/approve', async (req, res) => {
    try {
        const { stationDbId, finalPrice, suggestionIds } = req.body;
        const idsArray = JSON.parse(suggestionIds);

        // 1. Get Old Price (for email context)
        const station = await Station.findById(stationDbId);
        if (!station) throw new Error('Station not found');
        const oldPrice = station.costPerKWh;

        let newPrice = parseFloat(finalPrice);
        newPrice = Math.round((newPrice + Number.EPSILON) * 100) / 100;

        // 3. Update Station in Database
        station.costPerKWh = newPrice;
        await station.save();

        // 4. Find the suggestions to email the specific users
        const approvedSuggestions = await PriceSuggestion.find({ _id: { $in: idsArray } })
            .populate('userId');

        // 5. Send Email to Each User
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            // Use for...of so each email is properly awaited (forEach ignores async)
            for (const suggestion of approvedSuggestions) {
                if (suggestion.userId && suggestion.userId.email) {
                    const mailOptions = {
                        from: `"ChargeIT" <${process.env.EMAIL_USER}>`,
                        to: suggestion.userId.email,
                        subject: 'ChargeIT: Price Suggestion Approved!',
                        html: `
                            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px; max-width: 500px;">
                                <h2 style="color: #00C36A;">Suggestion Approved!</h2>
                                <p>Hi <strong>${suggestion.userId.username}</strong>,</p>
                                <p>Thank you for contributing to the ChargeIT community. Your price suggestion for <strong>${station.location.city}</strong> has been verified and approved.</p>

                                <table style="width: 100%; max-width: 400px; margin: 20px 0; border-collapse: collapse;">
                                    <tr style="background-color: #f8f9fa;">
                                        <td style="padding: 10px; border: 1px solid #ddd;">Previous Price</td>
                                        <td style="padding: 10px; border: 1px solid #ddd;">$${oldPrice.toFixed(2)}/kWh</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px; border: 1px solid #ddd;">Your Suggestion</td>
                                        <td style="padding: 10px; border: 1px solid #ddd;">$${suggestion.suggestedPrice.toFixed(2)}/kWh</td>
                                    </tr>
                                    <tr style="background-color: #d1e7dd; font-weight: bold;">
                                        <td style="padding: 10px; border: 1px solid #ddd;">New Updated Price</td>
                                        <td style="padding: 10px; border: 1px solid #ddd;">$${newPrice.toFixed(2)}/kWh</td>
                                    </tr>
                                </table>

                                <p>Your input helps keep our data accurate for everyone!</p>
                                <p style="color: #6c757d; font-size: 0.9em;">Best regards,<br>The ChargeIT Team</p>
                            </div>
                        `
                    };

                    try {
                        await transporter.sendMail(mailOptions);
                        console.log(`✅ Email sent to ${suggestion.userId.email}`);
                    } catch (err) {
                        console.error(`❌ Email failed for ${suggestion.userId.email}:`, err.message);
                    }
                }
            }
        } else {
            console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set - emails skipped. Set these in your Vercel/Render environment variables.');
        }

        // 6. Mark suggestions as approved
        await PriceSuggestion.updateMany(
            { _id: { $in: idsArray } },
            { status: 'approved' }
        );

        // 7. Cleanup other pending suggestions for this station
        await PriceSuggestion.updateMany(
            { stationDbId: stationDbId, status: 'pending' },
            { status: 'rejected' }
        );

        res.redirect('/admin/price-suggestions');
    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Error approving price' });
    }
});

// POST: Reject All
router.post('/price-suggestions/reject', async (req, res) => {
    try {
        const { suggestionIds } = req.body;
        const idsArray = JSON.parse(suggestionIds);

        await PriceSuggestion.updateMany(
            { _id: { $in: idsArray } },
            { status: 'rejected' }
        );

        res.redirect('/admin/price-suggestions');
    } catch (error) {
        res.render('error', { message: 'Error rejecting suggestions' });
    }
});

// 3. USERS MANAGEMENT

router.get('/users', async (req, res) => {
    try {
        const searchQuery = req.query.search;
        let query = {};

        if (searchQuery) {
            query = {
                $or: [
                    { username: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } }
                ]
            };
        }

        const users = await User.find(query).sort({ createdAt: -1 }).lean();
        
        res.render('admin/users', { 
            title: 'Manage Users', 
            users,
            searchQuery 
        });
    } catch (error) {
        res.render('error', { message: 'Error fetching users' });
    }
});

router.get('/users/add', (req, res) => {
    res.render('admin/user-form', { title: 'Add New User' });
});

router.post('/users/add', async (req, res) => {
    try {
        const { username, email, password, isAdmin } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.render('admin/user-form', { 
                title: 'Add New User', 
                error: 'Username or Email already exists',
                formData: req.body 
            });
        }

        const newUser = new User({
            username,
            email,
            password,
            isAdmin: isAdmin === 'on'
        });

        await newUser.save();
        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.render('admin/user-form', { 
            title: 'Add New User', 
            error: error.message,
            formData: req.body 
        });
    }
});

router.post('/users/toggle-role/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.isAdmin = !user.isAdmin;
            await user.save();
        }
        res.redirect('/admin/users');
    } catch (error) {
        res.render('error', { message: 'Error updating user role' });
    }
});

router.post('/users/delete/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin/users');
    } catch (error) {
        res.render('error', { message: 'Error deleting user' });
    }
});

// 4. STATIONS MANAGEMENT

router.get('/stations', async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const filterType = req.query.type || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 20; 
        const skip = (page - 1) * limit;

        let query = {};

        if (searchQuery) {
            query.$or = [
                { stationId: { $regex: searchQuery, $options: 'i' } },
                { 'location.city': { $regex: searchQuery, $options: 'i' } },
                { stationOperator: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        if (filterType) {
            query.chargerType = filterType;
        }

        const totalStations = await Station.countDocuments(query);
        const stations = await Station.find(query)
            .sort({ stationId: 1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        const totalPages = Math.ceil(totalStations / limit);

        let paginationParams = [];
        if (searchQuery) paginationParams.push(`search=${encodeURIComponent(searchQuery)}`);
        if (filterType) paginationParams.push(`type=${encodeURIComponent(filterType)}`);
        const paginationQuery = paginationParams.length > 0 ? '&' + paginationParams.join('&') : '';

        const chargerTypes = ['AC Level 1', 'AC Level 2', 'DC Fast Charger', 'Tesla Supercharger'];

        res.render('admin/stations', { 
            title: 'Manage Stations', 
            stations,
            searchQuery,
            filterType,
            chargerTypes,
            currentPage: page,
            totalPages,
            paginationQuery
        });
    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Error fetching stations' });
    }
});

router.get('/stations/add', (req, res) => {
    res.render('admin/station-form', { title: 'Add New Station' });
});

router.post('/stations/add', async (req, res) => {
    try {
        const { 
            stationId, city, address, country, lat, lng, 
            chargerType, costPerKWh, stationOperator 
        } = req.body;

        const newStation = new Station({
            stationId,
            location: {
                city,
                address,
                country,
                geo: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng)
                }
            },
            chargerType,
            costPerKWh: parseFloat(costPerKWh),
            stationOperator,
            availabilityHours: "24/7",
            distanceToCityKm: 5,
            usageStats: { avgUsersPerDay: 0 },
            chargingCapacityKW: 150,
            connectorTypes: ["Type 2", "CCS"],
            installationYear: new Date().getFullYear(),
            usesRenewableEnergy: false,
            rating: 0,
            parkingSpots: 4,
            maintenanceFrequency: "Annually",
            imageUrl: "https://picsum.photos/400/300" 
        });

        await newStation.save();
        res.redirect('/admin/stations');
    } catch (error) {
        console.error(error);
        res.render('admin/station-form', { 
            title: 'Add New Station', 
            error: error.message,
            station: req.body 
        });
    }
});

router.get('/stations/edit/:id', async (req, res) => {
    try {
        const station = await Station.findOne({ _id: req.params.id }).lean();
        if (!station) return res.redirect('/admin/stations');
        res.render('admin/station-form', { title: 'Edit Station', station, isEdit: true });
    } catch (error) {
        res.redirect('/admin/stations');
    }
});

router.post('/stations/edit/:id', async (req, res) => {
    try {
        const { 
            city, address, country, lat, lng, 
            chargerType, costPerKWh, stationOperator 
        } = req.body;

        await Station.findByIdAndUpdate(req.params.id, {
            'location.city': city,
            'location.address': address,
            'location.country': country,
            'location.geo.lat': parseFloat(lat),
            'location.geo.lng': parseFloat(lng),
            chargerType,
            costPerKWh: parseFloat(costPerKWh),
            stationOperator
        });

        res.redirect('/admin/stations');
    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Error updating station' });
    }
});

router.post('/stations/delete/:id', async (req, res) => {
    try {
        await Station.findByIdAndDelete(req.params.id);
        res.redirect('/admin/stations');
    } catch (error) {
        res.render('error', { message: 'Error deleting station' });
    }
});

module.exports = router;