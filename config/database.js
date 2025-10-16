require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
    throw new Error('POSTGRES_URL environment variable is missing');
}

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
            rejectUnauthorized: false // Required for Supabase SSL
        }
    }
});

module.exports = sequelize;