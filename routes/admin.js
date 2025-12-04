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

// List Users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 }).lean();
        res.render('admin/users', { title: 'Manage Users', users });
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

        // Check for existing user
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
            password, // Model pre-save hook will hash this
            isAdmin: isAdmin === 'on' // Checkbox returns 'on' if checked
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

// List Stations
router.get('/stations', async (req, res) => {
    try {
        const stations = await Station.find().sort({ stationId: 1 }).lean();
        res.render('admin/stations', { title: 'Manage Stations', stations });
    } catch (error) {
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
            // Default values
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