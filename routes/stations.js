const express = require('express');
const Station = require('../models/Station');
const User = require('../models/User'); 
const PriceSuggestion = require('../models/PriceSuggestion'); // NEW IMPORT
const router = express.Router();

// Get all stations with pagination
router.get('/', async (req, res) => {
    try {
        let stations = [];
        let totalStations = 0;
        let dbError = false;

        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 12;
        const skip = (page - 1) * perPage;

        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                stations = await Station.find()
                    .sort({ 'location.city': 1 })
                    .skip(skip)
                    .limit(perPage)
                    .lean();

                totalStations = await Station.countDocuments();
            } catch (dbErr) {
                console.error('Database error:', dbErr.message);
                dbError = true;
                stations = getSampleStations().slice(skip, skip + perPage);
                totalStations = getSampleStations().length;
            }
        } else {
            dbError = true;
            const allSampleStations = getSampleStations();
            stations = allSampleStations.slice(skip, skip + perPage);
            totalStations = allSampleStations.length;
        }

        const totalPages = Math.ceil(totalStations / perPage);

        // --- SMART PAGINATION LOGIC ---
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, page + 2);

        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(totalPages, startPage + 4);
            } else if (endPage === totalPages) {
                startPage = Math.max(1, endPage - 4);
            }
        }

        let pages = [];
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        res.render('stations/list', {
            title: 'All Charging Stations - ChargeIT',
            stations,
            currentPage: page,
            totalPages,
            pages,
            showFirst: startPage > 1,
            showLast: endPage < totalPages,
            perPage,
            totalStations,
            dbError
        });
    } catch (error) {
        res.render('stations/list', {
            title: 'All Charging Stations - ChargeIT',
            stations: getSampleStations().slice(0, 12),
            currentPage: 1,
            totalPages: 1,
            pages: [1],
            perPage: 12,
            totalStations: 3,
            dbError: true,
            error: error.message
        });
    }
});

// Search stations
router.get('/search', async (req, res) => {
    try {
        const { city, country, chargerType, minRating } = req.query;
        let stations = [];
        let dbError = false;

        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                let query = {};

                if (city) query['location.city'] = new RegExp(city, 'i');
                if (country) query['location.country'] = new RegExp(country, 'i');
                if (chargerType) query.chargerType = chargerType;
                if (minRating) query.rating = { $gte: parseFloat(minRating) };

                stations = await Station.find(query)
                    .sort({ rating: -1 })
                    .limit(50)
                    .lean();
            } catch (dbErr) {
                dbError = true;
                stations = filterSampleStations(req.query);
            }
        } else {
            dbError = true;
            stations = filterSampleStations(req.query);
        }

        const cities = ['Toronto', 'San Francisco', 'Bangkok', 'Sample City'];
        const countries = ['USA', 'Thailand', 'Sample Country', 'Canada'];
        const chargerTypes = ['AC Level 1', 'AC Level 2', 'DC Fast Charger', 'Tesla Supercharger'];

        res.render('stations/search', {
            title: 'Search Stations - ChargeIT',
            stations,
            cities,
            countries,
            chargerTypes,
            searchQuery: req.query,
            dbError
        });
    } catch (error) {
        res.render('stations/search', {
            title: 'Search Stations - ChargeIT',
            stations: [],
            cities: [],
            countries: [],
            chargerTypes: [],
            searchQuery: req.query,
            dbError: true,
            error: error.message
        });
    }
});

// GET Review Form
router.get('/:id/review', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        let station = null;
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            station = await Station.findOne({ stationId: req.params.id }).lean();
        }

        if (!station) {
            return res.status(404).render('error', { message: 'Station not found or DB unavailable' });
        }

        res.render('stations/review', {
            title: `Review ${station.location.city} Station`,
            station
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { message: 'Error loading review form' });
    }
});

// POST Submit Review
router.post('/:id/review', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        const { rating, comment } = req.body;
        
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            const station = await Station.findOne({ stationId: req.params.id });
            
            if (!station) {
                return res.status(404).render('error', { message: 'Station not found' });
            }

            const randomId = Math.floor(1000 + Math.random() * 9000); 
            const newReview = {
                reviewId: `REV${randomId}`,
                userId: req.session.user.id,
                userName: req.session.user.username,
                rating: parseInt(rating),
                comment: comment,
                date: new Date(),
                verifiedPurchase: true
            };

            station.reviews.push(newReview);

            const totalRating = station.reviews.reduce((sum, r) => sum + r.rating, 0);
            station.rating = (totalRating / station.reviews.length).toFixed(1);

            await station.save();
            res.redirect(`/stations/${req.params.id}`);
        } else {
            res.render('error', { message: 'Cannot save review: Database unavailable' });
        }
    } catch (error) {
        console.error('Review submit error:', error);
        res.status(500).render('error', { message: 'Failed to submit review' });
    }
});

// --- NEW: Handle Price Suggestion Submission ---
router.post('/suggest-price', async (req, res) => {
    // 1. Check Login
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Please login to suggest prices' });
    }

    try {
        const { stationId, stationDbId, suggestedPrice, currentPrice } = req.body;

        // 2. Save Suggestion
        const suggestion = new PriceSuggestion({
            stationId: stationId,
            stationDbId: stationDbId,
            userId: req.session.user.id,
            username: req.session.user.username,
            suggestedPrice: parseFloat(suggestedPrice),
            currentPriceAtTime: parseFloat(currentPrice)
        });

        await suggestion.save();
        res.json({ success: true, message: 'Price suggestion submitted for community review!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error saving suggestion' });
    }
});

// Get station by ID
router.get('/:id', async (req, res) => {
    try {
        let station = null;
        let nearbyStations = [];
        let dbError = false;
        let isFavorite = false;

        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                station = await Station.findOne({ stationId: req.params.id }).lean();

                if (!station) {
                    station = getSampleStations().find(s => s.stationId === req.params.id);
                    dbError = true;
                } else {
                    nearbyStations = await Station.find({
                        stationId: { $ne: req.params.id },
                        'location.city': station.location.city
                    }).limit(4).lean();

                    if (req.session.user) {
                        const user = await User.findById(req.session.user.id);
                        if (user && user.favoriteStations.some(id => id.toString() === station._id.toString())) {
                            isFavorite = true;
                        }
                    }
                }
            } catch (dbErr) {
                dbError = true;
                station = getSampleStations().find(s => s.stationId === req.params.id);
            }
        } else {
            dbError = true;
            station = getSampleStations().find(s => s.stationId === req.params.id);
            nearbyStations = getSampleStations().filter(s => s.stationId !== req.params.id).slice(0, 4);
        }

        if (!station) {
            return res.status(404).render('error', {
                title: 'Station Not Found - ChargeIT',
                message: `Station with ID ${req.params.id} not found`
            });
        }

        res.render('stations/detail', {
            title: `${station.location.city} Station - ChargeIT`,
            station,
            nearbyStations,
            dbError,
            isFavorite
        });
    } catch (error) {
        res.status(500).render('error', {
            title: 'Error - ChargeIT',
            message: 'Error loading station details',
            error: error.message
        });
    }
});

// Get stations by city
router.get('/city/:city', async (req, res) => {
    try {
        let stations = [];
        let dbError = false;

        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                stations = await Station.find({
                    'location.city': new RegExp(req.params.city, 'i')
                }).lean();
            } catch (dbErr) {
                dbError = true;
                stations = getSampleStations().filter(s =>
                    s.location.city.toLowerCase().includes(req.params.city.toLowerCase())
                );
            }
        } else {
            dbError = true;
            stations = getSampleStations().filter(s =>
                s.location.city.toLowerCase().includes(req.params.city.toLowerCase())
            );
        }

        res.render('stations/list', {
            title: `Stations in ${req.params.city} - ChargeIT`,
            stations,
            currentPage: 1,
            totalPages: 1,
            pages: [1],
            perPage: stations.length,
            totalStations: stations.length,
            dbError
        });
    } catch (error) {
        res.render('stations/list', {
            title: `Stations in ${req.params.city} - ChargeIT`,
            stations: [],
            currentPage: 1,
            totalPages: 1,
            pages: [1],
            perPage: 0,
            totalStations: 0,
            dbError: true,
            error: error.message
        });
    }
});

// API endpoint for stations
router.get('/api/stations', async (req, res) => {
    try {
        let stations = [];
        let dbError = false;

        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                stations = await Station.find().limit(100).lean();
            } catch (dbErr) {
                dbError = true;
                stations = getSampleStations();
            }
        } else {
            dbError = true;
            stations = getSampleStations();
        }

        res.json({
            success: true,
            data: stations,
            count: stations.length,
            dbError: dbError,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stations',
            error: error.message,
            data: getSampleStations(),
            dbError: true
        });
    }
});

// --- HELPER FUNCTIONS ---

function filterSampleStations(query) {
    const { city, country, chargerType, minRating } = query;
    let stations = getSampleStations();

    if (city) {
        stations = stations.filter(s =>
            s.location.city.toLowerCase().includes(city.toLowerCase())
        );
    }
    if (country) {
        stations = stations.filter(s =>
            s.location.country.toLowerCase().includes(country.toLowerCase())
        );
    }
    if (chargerType) {
        stations = stations.filter(s => s.chargerType === chargerType);
    }
    if (minRating) {
        stations = stations.filter(s => s.rating >= parseFloat(minRating));
    }

    return stations;
}

function getSampleStations() {
    return [
        {
            stationId: "EVS00001",
            location: {
                address: "4826 Random Rd, City 98",
                city: "Toronto",
                country: "Canada",
                geo: { lat: 43.6532, lng: -79.3832 }
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
        },
        {
            stationId: "EVS00002",
            location: {
                address: "8970 San Francisco Ave",
                city: "San Francisco",
                country: "USA",
                geo: { lat: 37.7749, lng: -122.4194 }
            },
            chargerType: "DC Fast Charger",
            costPerKWh: 0.19,
            availabilityHours: "24/7",
            distanceToCityKm: 4.96,
            usageStats: { avgUsersPerDay: 83 },
            stationOperator: "EVgo",
            chargingCapacityKW: 350,
            connectorTypes: ["Tesla", "Type 2"],
            installationYear: 2010,
            usesRenewableEnergy: true,
            rating: 3.9,
            parkingSpots: 2,
            maintenanceFrequency: "Monthly",
            imageUrl: "https://picsum.photos/id/102/400/300",
            reviews: [
                {
                    reviewId: "REV0002",
                    userId: "user234",
                    userName: "Lisa R.",
                    rating: 4,
                    comment: "24/7 availability saved me during a late-night trip! Very convenient.",
                    date: "2024-11-14",
                    verifiedPurchase: true
                }
            ]
        },
        {
            stationId: "EVS00003",
            location: {
                address: "5974 Bangkok Ave",
                city: "Bangkok",
                country: "Thailand",
                geo: { lat: 13.7563, lng: 100.5018 }
            },
            chargerType: "AC Level 2",
            costPerKWh: 0.48,
            availabilityHours: "06:00-22:00",
            distanceToCityKm: 8.54,
            usageStats: { avgUsersPerDay: 24 },
            stationOperator: "ChargePoint",
            chargingCapacityKW: 50,
            connectorTypes: ["Type 2", "CCS"],
            installationYear: 2019,
            usesRenewableEnergy: false,
            rating: 3.6,
            parkingSpots: 9,
            maintenanceFrequency: "Annually",
            imageUrl: "https://picsum.photos/id/103/400/300",
            reviews: [
                {
                    reviewId: "REV0003",
                    userId: "user334",
                    userName: "Chiang M.",
                    rating: 3,
                    comment: "Average charging speed but plenty of parking available.",
                    date: "2024-11-12",
                    verifiedPurchase: true
                }
            ]
        }
    ];
}

module.exports = router;