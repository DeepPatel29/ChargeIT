require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const mongoose = require('mongoose');
const Station = require('../models/Station');
const fs = require('fs');
const path = require('path');

const importData = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI missing in .env');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const jsonPath = path.resolve(process.cwd(), 'realistic_ev_charging_stations.json');

        if (!fs.existsSync(jsonPath)) {
            throw new Error(`JSON file not found at: ${jsonPath}\nMake sure realistic_ev_charging_stations.json is in the project root!`);
        }

        console.log('Loading realistic_ev_charging_stations.json...');
        const sampleData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        console.log(`Found ${sampleData.length} stations`);

        await Station.deleteMany({});
        console.log('Cleared old stations');

        const batchSize = 1000;
        for (let i = 0; i < sampleData.length; i += batchSize) {
            const batch = sampleData.slice(i, i + batchSize);
            await Station.insertMany(batch);
            console.log(`Imported ${Math.min(i + batchSize, sampleData.length)} / ${sampleData.length}`);
        }

        console.log('ALL STATIONS IMPORTED SUCCESSFULLY!');
        await mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error('IMPORT FAILED:', err.message);
        process.exit(1);
    }
};

importData();