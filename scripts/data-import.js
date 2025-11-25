const mongoose = require('mongoose');
const csv = require('csvtojson');
const Station = require('../models/Station');
const dotenv = require('dotenv');

dotenv.config();

const importData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Clear existing data
        await Station.deleteMany({});

        // Read CSV file
        const stations = await csv().fromFile('./detailed_ev_charging_stations.csv');

        // Insert data into MongoDB
        await Station.insertMany(stations);

        console.log('Data imported successfully');
        process.exit();
    } catch (err) {
        console.error('Error importing data:', err);
        process.exit(1);
    }
};

importData();
