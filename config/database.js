// config/database.js
require('dotenv').config(); // Only for local dev; ignored on Vercel
const { Sequelize } = require('sequelize');

// Debug logging to check env var in Vercel logs
console.log('POSTGRES_URL value:', process.env.POSTGRES_URL ? 'Defined' : 'UNDEFINED');
console.log('DATABASE_URL value:', process.env.DATABASE_URL ? 'Defined' : 'UNDEFINED');

const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Database URL is missing! Check Vercel Environment Variables.');
  throw new Error('POSTGRES_URL or DATABASE_URL environment variable is missing');
}
const sequelize = new Sequelize(process.env.payment_POSTGRES_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: false
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // For Supabase SSL
    }
  }
});

module.exports = sequelize;

// Debug logs
console.log('DEBUG ENV CHECK');
console.log('process.env.POSTGRES_URL:', process.env.POSTGRES_URL ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.payment_POSTGRES_URL:', process.env.payment_POSTGRES_URL ? 'DEFINED' : 'UNDEFINED');