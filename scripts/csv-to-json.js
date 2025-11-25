const csv = require('csvtojson');
const fs = require('fs');

// Path to your CSV file
const csvFilePath = '../detailed_ev_charging_stations.csv';

// Path to the output JSON file
const jsonFilePath = '../detailed_ev_charging_stations.json';

// Convert CSV to JSON
csv()
    .fromFile(csvFilePath)
    .then((jsonObj) => {
        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonObj, null, 2));
        console.log('CSV file successfully converted to JSON!');
    })
    .catch((err) => {
        console.error('Error converting CSV to JSON:', err);
    });
