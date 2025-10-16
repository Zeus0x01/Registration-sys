// config/database.js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const pg = require('pg'); // ✅ Explicitly import pg

// Debug: log which environment variable is found
console.log('DEBUG ENV CHECK:');
console.log('process.env.payment_POSTGRES_URL:', process.env.payment_POSTGRES_URL ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.POSTGRES_URL:', process.env.POSTGRES_URL ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');


// Use DATABASE_URL for Vercel/Supabase deployments
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL is missing! Set it in your Vercel Environment Variables.');
  throw new Error('Database connection URL is undefined.');
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false
    }
  }
});

module.exports = sequelize;
