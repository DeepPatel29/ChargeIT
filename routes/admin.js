const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Station = require('../models/Station');
const PriceSuggestion = require('../models/PriceSuggestion'); 
const nodemailer = require('nodemailer'); // Required for email notifications

// ==========================================
// EMAIL CONFIGURATION
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail', // Change if using Outlook/Yahoo/etc.
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
});

// Middleware to check if user is Admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.isAdmin) {
        return next();
    }
    res.status(403).render('error', { 
        title: 'Access Denied', 
        message: 'You must be an administrator to access this area.' 
    });
};

// Protect all admin routes
router.use(checkAdmin);

// ==========================================
// 1. ADMIN DASHBOARD
// ==========================================
router.get('/', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const stationCount = await Station.countDocuments();
        // Count pending suggestions for the dashboard badge
        const pendingSuggestions = await PriceSuggestion.countDocuments({ status: 'pending' });
        
        const recentStations = await Station.find().sort({ createdAt: -1 }).limit(5).lean();
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).lean();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            userCount,
            stationCount,
            pendingSuggestions,
            recentStations,
            recentUsers
        });
    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Dashboard Error' });
    }
});

// ==========================================
// 2. PRICE SUGGESTIONS (CROWD CONSENSUS)
// ==========================================

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

        // 2. Parse and Round New Price (Fix Floating Point Bug: 0.70000001 -> 0.70)
        let newPrice = parseFloat(finalPrice);
        newPrice = Math.round((newPrice + Number.EPSILON) * 100) / 100;

        // 3. Update Station in Database
        station.costPerKWh = newPrice;
        await station.save();

        // 4. Find the suggestions to email the specific users
        const approvedSuggestions = await PriceSuggestion.find({ _id: { $in: idsArray } })
            .populate('userId');

        // 5. Send Email to Each User
        if (process.env.EMAIL_USER) {
            approvedSuggestions.forEach(async (suggestion) => {
                if (suggestion.userId && suggestion.userId.email) {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: suggestion.userId.email,
                        subject: 'ChargeIT: Price Suggestion Approved!',
                        html: `
                            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                                <h2 style="color: #198754;">Suggestion Approved!</h2>
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
                        console.log(`Email sent to ${suggestion.userId.email}`);
                    } catch (err) {
                        console.error('Email error:', err.message);
                    }
                }
            });
        } else {
            console.warn('⚠️ No EMAIL_USER in .env - Emails skipped.');
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

// ==========================================
// 3. USERS MANAGEMENT
// ==========================================

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

// ==========================================
// 4. STATIONS MANAGEMENT
// ==========================================

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