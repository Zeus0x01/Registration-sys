// config/database.js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const pg = require('pg');

// Use DATABASE_URL for Vercel/Supabase deployments
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('❌ DATABASE_URL is missing! Set it in your Vercel Environment Variables.');
    // Keep the throw to prevent silent failures
    throw new Error('Database connection URL is undefined.'); 
}

// --- SSL Configuration Block ---
const sslOptions = {
    require: true, // Explicitly require SSL connection
};

// Check if a root certificate file is available (e.g., for secure production)
const caCertPath = path.join(__dirname, 'ca-certificate.crt'); 

if (fs.existsSync(caCertPath)) {
    // 🔒 Production/Secure: Use a trusted CA certificate
    console.log('✅ Found CA certificate. Connecting with full SSL validation.');
    sslOptions.ca = fs.readFileSync(caCertPath).toString();
    sslOptions.rejectUnauthorized = true; // Use default secure behavior
} else {
    // ⚠️ Development/Self-signed: Bypass security checks (The fix for your error)
    console.log('⚠️ CA certificate not found. Bypassing SSL validation (rejectUnauthorized: false).');
    sslOptions.rejectUnauthorized = false; 
}
// --- End SSL Configuration Block ---


const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    // 💡 Add the imported 'pg' package here for better compatibility
    dialectModule: pg, 
    dialectOptions: {
        ssl: sslOptions
    },
    // Optional: Logging to see SQL queries executed
    logging: false 
});

module.exports = sequelize;