const express = require('express');
const Station = require('../models/Station');
const router = express.Router();

// Get all stations with pagination
router.get('/', async (req, res) => {
    try {
        console.log('Stations list accessed');

        let stations = [];
        let totalStations = 0;
        let dbError = false;

        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 12;
        const skip = (page - 1) * perPage;

        // Check if database is connected
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                console.log('Fetching stations from database...');
                stations = await Station.find()
                    .sort({ 'location.city': 1 })
                    .skip(skip)
                    .limit(perPage)
                    .lean();

                totalStations = await Station.countDocuments();
                console.log(`✅ Found ${stations.length} stations`);
            } catch (dbErr) {
                console.error('Database error:', dbErr.message);
                dbError = true;
                stations = getSampleStations().slice(skip, skip + perPage);
                totalStations = getSampleStations().length;
            }
        } else {
            console.log('Using sample data for stations');
            dbError = true;
            const allSampleStations = getSampleStations();
            stations = allSampleStations.slice(skip, skip + perPage);
            totalStations = allSampleStations.length;
        }

        const totalPages = Math.ceil(totalStations / perPage);

        res.render('stations/list', {
            title: 'All Charging Stations - ChargeIT',
            stations,
            currentPage: page,
            totalPages,
            perPage,
            totalStations,
            dbError
        });
    } catch (error) {
        console.error('Stations list error:', error);
        res.render('stations/list', {
            title: 'All Charging Stations - ChargeIT',
            stations: getSampleStations().slice(0, 12),
            currentPage: 1,
            totalPages: 1,
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
        console.log('Search accessed with query:', req.query);

        const { city, country, chargerType, minRating } = req.query;
        let stations = [];
        let dbError = false;

        // Check if database is connected
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                let query = {};

                if (city) query['location.city'] = new RegExp(city, 'i');
                if (country) query['location.country'] = new RegExp(country, 'i');
                if (chargerType) query.chargerType = chargerType;
                if (minRating) query.rating = { $gte: parseFloat(minRating) };

                console.log('Search query:', query);
                stations = await Station.find(query)
                    .sort({ rating: -1 })
                    .limit(50)
                    .lean();

                console.log(`✅ Search found ${stations.length} stations`);
            } catch (dbErr) {
                console.error('Database search error:', dbErr.message);
                dbError = true;
                stations = filterSampleStations(req.query);
            }
        } else {
            console.log('Using sample data for search');
            dbError = true;
            stations = filterSampleStations(req.query);
        }

        // Get filter options for the form
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
        console.error('Search error:', error);
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

// Get station by ID
router.get('/:id', async (req, res) => {
    try {
        console.log('Station detail accessed for ID:', req.params.id);

        let station = null;
        let nearbyStations = [];
        let dbError = false;

        // Check if database is connected
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                station = await Station.findOne({ stationId: req.params.id }).lean();

                if (!station) {
                    console.log('Station not found in database, using sample data');
                    station = getSampleStations().find(s => s.stationId === req.params.id);
                    dbError = true;
                } else {
                    // Find nearby stations (within approximate range)
                    nearbyStations = await Station.find({
                        stationId: { $ne: req.params.id },
                        'location.city': station.location.city
                    }).limit(4).lean();
                    console.log(`✅ Found ${nearbyStations.length} nearby stations`);
                }
            } catch (dbErr) {
                console.error('Database detail error:', dbErr.message);
                dbError = true;
                station = getSampleStations().find(s => s.stationId === req.params.id);
            }
        } else {
            console.log('Using sample data for station detail');
            dbError = true;
            station = getSampleStations().find(s => s.stationId === req.params.id);
            nearbyStations = getSampleStations()
                .filter(s => s.stationId !== req.params.id)
                .slice(0, 4);
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
            dbError
        });
    } catch (error) {
        console.error('Station detail error:', error);
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
        console.log('City stations accessed for:', req.params.city);

        let stations = [];
        let dbError = false;

        // Check if database is connected
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                stations = await Station.find({
                    'location.city': new RegExp(req.params.city, 'i')
                }).lean();
                console.log(`✅ Found ${stations.length} stations in ${req.params.city}`);
            } catch (dbErr) {
                console.error('Database city error:', dbErr.message);
                dbError = true;
                stations = getSampleStations().filter(s =>
                    s.location.city.toLowerCase().includes(req.params.city.toLowerCase())
                );
            }
        } else {
            console.log('Using sample data for city stations');
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
            perPage: stations.length,
            totalStations: stations.length,
            dbError
        });
    } catch (error) {
        console.error('City stations error:', error);
        res.render('stations/list', {
            title: `Stations in ${req.params.city} - ChargeIT`,
            stations: [],
            currentPage: 1,
            totalPages: 1,
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
        console.log('API stations endpoint accessed');

        let stations = [];
        let dbError = false;

        // Check if database is connected
        if (req.app.locals.dbConnected && req.app.locals.dbConnected()) {
            try {
                stations = await Station.find().limit(100).lean();
                console.log(`✅ API returning ${stations.length} stations`);
            } catch (dbErr) {
                console.error('Database API error:', dbErr.message);
                dbError = true;
                stations = getSampleStations();
            }
        } else {
            console.log('API using sample data');
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
        console.error('API stations error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stations',
            error: error.message,
            data: getSampleStations(),
            dbError: true
        });
    }
});

// Helper function to filter sample stations
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

// Sample data function
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
            reviews: [
                {
                    reviewId: "REV0001",
                    userId: "user123",
                    userName: "John D.",
                    rating: 4,
                    comment: "Reliable station with fast charging. Good location near the city center.",
                    date: "2024-11-15",
                    verifiedPurchase: true
                }
            ]
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
        },
        {
            stationId: "EVS00004",
            location: {
                address: "123 Main Street",
                city: "Toronto",
                country: "Canada",
                geo: { lat: 43.6510, lng: -79.3470 }
            },
            chargerType: "AC Level 1",
            costPerKWh: 0.35,
            availabilityHours: "08:00-20:00",
            distanceToCityKm: 2.1,
            usageStats: { avgUsersPerDay: 45 },
            stationOperator: "ChargePoint",
            chargingCapacityKW: 150,
            connectorTypes: ["Type 1", "Type 2"],
            installationYear: 2020,
            usesRenewableEnergy: true,
            rating: 4.5,
            parkingSpots: 4,
            maintenanceFrequency: "Monthly",
            imageUrl: "https://picsum.photos/id/104/400/300",
            reviews: [
                {
                    reviewId: "REV0004",
                    userId: "user445",
                    userName: "Mike T.",
                    rating: 5,
                    comment: "Excellent station with fast charging and great location!",
                    date: "2024-11-10",
                    verifiedPurchase: true
                }
            ]
        }
    ];
}

module.exports = router;