const admin = require("firebase-admin");
const path = require("path");



// Load the service account key you downloaded from Firebase Console
// Make sure this file exists in your config folder
const serviceAccount = require(path.join(__dirname, 'firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;