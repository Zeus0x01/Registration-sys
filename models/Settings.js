const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settings = sequelize.define('Settings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
            min: 0,
            isDecimal: true
        }
    },
    priceOptions: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        comment: 'JSON array of price options: [{"label": "Regular", "amount": 300}, ...]'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    }
}, {
    tableName: 'settings',
    timestamps: true
});

module.exports = Settings;