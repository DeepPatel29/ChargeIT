const mongoose = require('mongoose');

const priceSuggestionSchema = new mongoose.Schema({
    stationId: { type: String, required: true },
    stationDbId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Station', 
        required: true 
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    suggestedPrice: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('PriceSuggestion', priceSuggestionSchema);