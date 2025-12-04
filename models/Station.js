const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    reviewId: {
        type: String,
        required: true,
        match: /^REV\d{4}$/,
    },
    userId: {
        type: String,
        required: true,
    },
    userName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: true,
        maxlength: 500,
    },
    date: {
        type: Date,
        required: true,
    },
    verifiedPurchase: {
        type: Boolean,
        default: false,
    },
});

const stationSchema = new mongoose.Schema(
    {
        stationId: {
            type: String,
            required: true,
            unique: true,
            match: /^EVS\d{5}$/,
            index: true,
        },
        location: {
            address: {
                type: String,
                required: true,
                trim: true,
            },
            city: {
                type: String,
                required: true,
                trim: true,
            },
            country: {
                type: String,
                required: true,
                trim: true,
            },
            geo: {
                lat: {
                    type: Number,
                    required: true,
                    min: -90,
                    max: 90,
                },
                lng: {
                    type: Number,
                    required: true,
                    min: -180,
                    max: 180,
                },
            },
        },
        chargerType: {
            type: String,
            required: true,
            enum: ['AC Level 1', 'AC Level 2', 'DC Fast Charger', 'Tesla Supercharger'],
        },
        costPerKWh: {
            type: Number,
            required: true,
            min: 0,
            max: 2,
        },
        availabilityHours: {
            type: String,
            required: true,
        },
        distanceToCityKm: {
            type: Number,
            required: true,
            min: 0,
        },
        usageStats: {
            avgUsersPerDay: {
                type: Number,
                required: true,
                min: 0,
            },
        },
        stationOperator: {
            type: String,
            required: true,
            trim: true,
        },
        chargingCapacityKW: {
            type: Number,
            required: true,
            min: 0,
        },
        connectorTypes: [
            {
                type: String,
                required: true,
                enum: [
                    'Type 1', 'Type 2', 'J1772', 'Mennekes',
                    'CCS', 'CCS1', 'CCS2', 'CHAdeMO',
                    'Tesla', 'NACS', 'Tesla Supercharger', 'GB/T'
                ]
            }
        ],
        installationYear: {
            type: Number,
            required: true,
            min: 2000,
            max: new Date().getFullYear(),
        },
        usesRenewableEnergy: {
            type: Boolean,
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 0,
            max: 5,
        },
        parkingSpots: {
            type: Number,
            required: true,
            min: 1,
        },
        maintenanceFrequency: {
            type: String,
            required: true,
            enum: ['Weekly', 'Monthly', 'Quarterly', 'Annually'],
        },
        imageUrl: {
            type: String,
            required: true,
            match: /^https?:\/\/.+\..+/,
        },
        reviews: [reviewSchema],
    },
    {
        timestamps: true,
    }
);

// Original indexes
stationSchema.index({ 'location.geo.lat': 1, 'location.geo.lng': 1 });
stationSchema.index({ 'location.city': 1, 'location.country': 1 });

module.exports = mongoose.model('Station', stationSchema);