const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Wallet = sequelize.define('Wallet', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        },
        set(value) {
            this.setDataValue('userEmail', value.toLowerCase().trim());
        }
    },
    userPhone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1000.00,
        allowNull: false,
        validate: {
            min: 0,
            isDecimal: true
        }
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EGP',
        allowNull: false
    }
}, {
    tableName: 'wallets',
    timestamps: true
});

module.exports = Wallet;