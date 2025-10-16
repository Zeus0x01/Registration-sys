// config/database.js
require('dotenv').config();
const { Sequelize } = require('sequelize');

// Debug: log which environment variable is found
console.log('DEBUG ENV CHECK:');
console.log('process.env.payment_POSTGRES_URL:', process.env.payment_POSTGRES_URL ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.POSTGRES_URL:', process.env.POSTGRES_URL ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');

// Use your Supabase connection string
const dbUrl =
  process.env.payment_POSTGRES_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Database URL is missing! Check your Vercel Environment Variables.');
  throw new Error('Database connection URL is undefined.');
}

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: false,
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // For Supabase SSL
    },
  },
});

module.exports = sequelize;
