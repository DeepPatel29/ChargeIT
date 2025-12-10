# ⚡ ChargeIT

**ChargeIT** is a global Electric Vehicle (EV) charging station locator built with Node.js, Express, and MongoDB. It allows users to search for charging stations, view detailed amenities, leave reviews, and manage their favorite spots. It also features a robust Admin Dashboard for content management.

---

## 🚀 Features

### 🔌 For Users
* **Global Station Search:** Filter stations by City, Country, Charger Type (AC/DC/Tesla), and Minimum Rating.
* **Detailed Insights:** View real-time availability, cost per kWh, connector types (CCS, Type 2, Tesla, etc.), and amenities.
* **User Accounts:** Secure registration and login via Email/Password or **Google Sign-In** (Firebase).
* **Community Reviews:** Verified users can rate stations (1-5 stars) and leave detailed comments.
* **Favorites:** Save frequently used stations for quick access.
* **Responsive Design:** Optimized for desktop and mobile devices.

### 🛡️ For Admins
* **Admin Dashboard:** View key metrics (Total Users, Total Stations, Recent Activity).
* **Station Management:** CRUD operations (Create, Read, Update, Delete) for charging stations.
* **User Management:** View user lists, delete accounts, and toggle Admin privileges.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB (with Mongoose ODM)
* **Templating:** Express-Handlebars (`.hbs`)
* **Authentication:** * `bcryptjs` (Local Auth)
  * `firebase-admin` (Google OAuth)
  * `express-session` & `connect-mongo` (Session Management)
* **Styling:** Custom CSS (Public folder)
* **Deployment Ready:** Configured for Vercel/Render.

---

## ⚙️ Installation

### 1. Clone the Repository
```bash
git clone [https://github.com/yourusername/chargeit.git](https://github.com/yourusername/chargeit.git)
cd chargeit

### 2\. Install Dependencies

```bash
npm install
```

### 3\. Environment Configuration

Create a `.env` file in the root directory and add the following variables:

```env
# Server Port
PORT=3000
NODE_ENV=development

# Database Connection (Required)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/chargeit
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/chargeit # Used for Session Store

# Session Security
SESSION_SECRET=your_super_secret_key_here

# Firebase (Optional - For Google Login)
# You can paste the raw JSON content of your service account here
FIREBASE_SERVICE_ACCOUNT={"type": "service_account", ...}
```

> **Note:** If `MONGODB_URI` is not provided, the app will fall back to **in-memory data** mode with limited features.

### 4\. Firebase Setup (Optional)

To enable Google Login:

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Generate a **Service Account Key** (JSON).
3.  Either paste the content into the `FIREBASE_SERVICE_ACCOUNT` env variable **OR** save the file as `firebase-service-account.json` in the root directory.

-----

## 💾 Data Seeding

The project includes a dataset of realistic EV stations (`realistic_ev_charging_stations.json`). To populate your MongoDB database with this initial data:

```bash
npm run import-data
```

*This script will clear existing stations and import the dataset from the JSON file.*

-----

## 🏃 Usage

### Development Mode

Runs the server with `nodemon` for hot-reloading.

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

Visit `http://localhost:3000` in your browser.

-----

## 📂 Project Structure

```
chargeit/
├── config/             # Database and Firebase configurations
├── models/             # Mongoose schemas (User, Station)
├── public/             # Static assets (CSS, JS, Images)
├── routes/             # Express routes (Auth, Admin, Stations)
├── scripts/            # Data import/utility scripts
├── views/              # Handlebars templates
├── app.js              # Application entry point
├── package.json        # Dependencies and scripts
└── realistic_ev...json # Seed data
```

-----

## 🔗 API Endpoints

The application also exposes a public API endpoint to retrieve station data programmatically:

  * **GET** `/stations/api/stations` - Returns a JSON list of all charging stations.

-----

## 🤝 Contributing

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

```
```      
