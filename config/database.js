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
const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectModule: pg,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
});

module.exports = sequelize;