const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let serviceAccount;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // console.log("Loading Firebase credentials from Environment Variable...");
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } 
    // 2. LOCAL / RENDER: Check for physical file
    else {
        const localPath = path.join(__dirname, 'firebase-service-account.json');
        const rootPath = path.join(__dirname, '..', 'firebase-service-account.json');

        if (fs.existsSync(localPath)) {
            serviceAccount = require(localPath);
        } else if (fs.existsSync(rootPath)) {
            serviceAccount = require(rootPath);
        } else {
            throw new Error("No Firebase credentials found (Env Var or File).");
        }
    }

    // Initialize Firebase
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized");
    }

} catch (error) {
    console.error("Firebase Initialization Error:", error.message);
}

module.exports = admin;