const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Define possible paths for the secret file
// 1. Local Development: Inside the 'config' folder
const localPath = path.join(__dirname, 'firebase-service-account.json');
// 2. Render Deployment: At the root of the application (one level up from config)
const rootPath = path.join(__dirname, '..', 'firebase-service-account.json');

let serviceAccount;

try {
    if (fs.existsSync(localPath)) {
        console.log("Loading Firebase credentials from config folder...");
        serviceAccount = require(localPath);
    } else if (fs.existsSync(rootPath)) {
        console.log("Loading Firebase credentials from root folder...");
        serviceAccount = require(rootPath);
    } else {
        throw new Error("firebase-service-account.json not found in config or root directory.");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    console.log("✅ Firebase Admin Initialized");

} catch (error) {
    console.error("❌ Firebase Initialization Error:", error.message);
    // We don't crash the app, but Google Login won't work
}

module.exports = admin;