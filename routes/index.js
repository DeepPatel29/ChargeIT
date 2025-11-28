const express = require('express');
const Station = require('../models/Station');
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
                // Try to get data from database
                featuredStations = await Station.find()
                    .sort({ rating: -1 })
                    .limit(6)
                    .lean();

                totalStations = await Station.countDocuments();
                const countriesList = await Station.distinct('location.country');
                countries = countriesList ? countriesList.length : 0;

                console.log(`✅ Loaded ${featuredStations.length} stations from database`);
            } catch (dbError) {
                console.error('Database query error:', dbError.message);
                dbError = true;
                // Fall back to sample data
                featuredStations = getSampleStations();
                totalStations = featuredStations.length;
                countries = new Set(featuredStations.map(s => s.location.country)).size;
            }
        } else {
            // Use sample data when database is not connected
            console.log('Database not connected, using sample data');
            dbError = true;
            featuredStations = getSampleStations();
            totalStations = featuredStations.length;
            countries = new Set(featuredStations.map(s => s.location.country)).size;
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
        // Final fallback - always render something
        res.render('home', {
            title: 'ChargeIT - EV Charging Station Locator',
            featuredStations: getSampleStations(),
            totalStations: 5,
            countries: 3,
            dbError: true,
            error: error.message
        });
    }
});

// About page
router.get('/about', (req, res) => {
    console.log('About page accessed');
    res.render('about', {
        title: 'About ChargeIT'
    });
});

// Enhanced sample data for when DB is not available
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
                geo: { lat: 37.861857, lng: -122.490299 }
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
                geo: { lat: 13.776092, lng: 100.412776 }
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