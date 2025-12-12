const express = require('express');
const Station = require('../models/Station');
const User = require('../models/User');
const router = express.Router();

// Home page
router.get('/', async (req, res) => {
    try {
        console.log('Home page accessed');

        let featuredStations = [];
        let totalStations = 0;
        let countries = 0;
        let dbError = false;

        // Check if database is connected
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                console.log('Attempting to fetch data from database...');
                featuredStations = await Station.find()
                    .sort({ rating: -1 })
                    .limit(6)
                    .lean();

                totalStations = await Station.countDocuments();
                const countriesList = await Station.distinct('location.country');
                countries = countriesList ? countriesList.length : 0;
            } catch (dbError) {
                console.error('Database query error:', dbError.message);
                dbError = true;
                featuredStations = getSampleStations();
                totalStations = featuredStations.length;
                countries = 3;
            }
        } else {
            console.log('Database not connected, using sample data');
            dbError = true;
            featuredStations = getSampleStations();
            totalStations = featuredStations.length;
            countries = 3;
        }

        res.render('home', {
            title: 'ChargeIT - EV Charging Station Locator',
            featuredStations,
            totalStations,
            countries,
            dbError
        });
    } catch (error) {
        console.error('Home page error:', error);
        res.render('home', {
            title: 'ChargeIT - EV Charging Station Locator',
            featuredStations: getSampleStations(),
            totalStations: 5,
            countries: 3,
            dbError: true
        });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About ChargeIT'
    });
});

// Favorites Page Route
router.get('/favorites', async (req, res) => {
    // 1. Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        let stations = [];
        let dbError = false;

        // 2. Fetch User and populate their favoriteStations
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            const user = await User.findById(req.session.user.id)
                .populate('favoriteStations') // This replaces IDs with actual Station data
                .lean();
            
            if (user) {
                stations = user.favoriteStations;
            }
        } else {
            dbError = true;
        }

        res.render('favorites', {
            title: 'My Favorite Stations - ChargeIT',
            stations,
            dbError
        });
    } catch (error) {
        console.error('Favorites page error:', error);
        res.render('error', { message: 'Error loading favorites' });
    }
});

// API Route to Add/Remove Favorites
router.post('/api/favorites', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { stationId } = req.body;

    try {
        const user = await User.findById(req.session.user.id);
        const station = await Station.findOne({ stationId: stationId });

        if (!user || !station) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }

        // Check if already in favorites (convert ObjectIds to strings for comparison)
        const index = user.favoriteStations.findIndex(id => id.toString() === station._id.toString());
        let isFavorite = false;

        if (index === -1) {
            user.favoriteStations.push(station._id); // Add
            isFavorite = true;
        } else {
            user.favoriteStations.splice(index, 1); // Remove
            isFavorite = false;
        }

        await user.save();
        res.json({ success: true, isFavorite });

    } catch (error) {
        console.error('Favorites API error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Sample data function
function getSampleStations() {
    return [
        {
            stationId: "EVS00001",
            location: {
                address: "4826 Random Rd, City 98",
                city: "Sample City",
                country: "Sample Country",
                geo: { lat: -33.400998, lng: 77.974972 }
            },
            chargerType: "AC Level 2",
            costPerKWh: 0.27,
            availabilityHours: "09:00-18:00",
            distanceToCityKm: 4.95,
            usageStats: { avgUsersPerDay: 35 },
            stationOperator: "EVgo",
            chargingCapacityKW: 350,
            connectorTypes: ["CCS", "CHAdeMO"],
            installationYear: 2013,
            usesRenewableEnergy: true,
            rating: 4.0,
            parkingSpots: 7,
            maintenanceFrequency: "Annually",
            imageUrl: "https://picsum.photos/id/101/400/300",
            reviews: []
        }
    ];
}

module.exports = router;