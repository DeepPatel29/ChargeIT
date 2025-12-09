const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Station = require('../models/Station');

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

// Admin Dashboard
router.get('/', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const stationCount = await Station.countDocuments();
        const recentStations = await Station.find().sort({ createdAt: -1 }).limit(5).lean();
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).lean();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            userCount,
            stationCount,
            recentStations,
            recentUsers
        });
    } catch (error) {
        console.error(error);
        res.render('error', { message: 'Dashboard Error' });
    }
});

// --- USERS MANAGEMENT ---

// List Users with Search
router.get('/users', async (req, res) => {
    try {
        const searchQuery = req.query.search;
        let query = {};

        // If search term exists, search by username or email
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
            searchQuery // Pass back to view to keep input populated
        });
    } catch (error) {
        res.render('error', { message: 'Error fetching users' });
    }
});

// Add User Form
router.get('/users/add', (req, res) => {
    res.render('admin/user-form', { title: 'Add New User' });
});

// Process Add User
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

// Toggle User Admin Role
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

// Delete User
router.post('/users/delete/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin/users');
    } catch (error) {
        res.render('error', { message: 'Error deleting user' });
    }
});

// --- STATIONS MANAGEMENT ---

// List Stations with Search, Filter & Pagination
router.get('/stations', async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const filterType = req.query.type || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 20; // Stations per page
        const skip = (page - 1) * limit;

        let query = {};

        // 1. Build Search Query
        if (searchQuery) {
            query.$or = [
                { stationId: { $regex: searchQuery, $options: 'i' } },
                { 'location.city': { $regex: searchQuery, $options: 'i' } },
                { stationOperator: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // 2. Build Filter Query
        if (filterType) {
            query.chargerType = filterType;
        }

        // 3. Fetch Data with Pagination
        const totalStations = await Station.countDocuments(query);
        const stations = await Station.find(query)
            .sort({ stationId: 1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        const totalPages = Math.ceil(totalStations / limit);

        // 4. Create Pagination Query String (keeps search/filter active on page change)
        let paginationParams = [];
        if (searchQuery) paginationParams.push(`search=${encodeURIComponent(searchQuery)}`);
        if (filterType) paginationParams.push(`type=${encodeURIComponent(filterType)}`);
        const paginationQuery = paginationParams.length > 0 ? '&' + paginationParams.join('&') : '';

        // Charger Types Enum (matching Station model)
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

// Add Station Form
router.get('/stations/add', (req, res) => {
    res.render('admin/station-form', { title: 'Add New Station' });
});

// Process Add Station
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

// Edit Station Form
router.get('/stations/edit/:id', async (req, res) => {
    try {
        const station = await Station.findOne({ _id: req.params.id }).lean();
        if (!station) return res.redirect('/admin/stations');
        res.render('admin/station-form', { title: 'Edit Station', station, isEdit: true });
    } catch (error) {
        res.redirect('/admin/stations');
    }
});

// Process Edit Station
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

// Delete Station
router.post('/stations/delete/:id', async (req, res) => {
    try {
        await Station.findByIdAndDelete(req.params.id);
        res.redirect('/admin/stations');
    } catch (error) {
        res.render('error', { message: 'Error deleting station' });
    }
});

module.exports = router;