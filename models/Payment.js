const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        },
        set(value) {
            this.setDataValue('userEmail', value.toLowerCase().trim());
        }
    },
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
            isDecimal: true
        }
    },
    paymentMethod: {
        type: DataTypes.ENUM('paymob-wallet', 'paymob-card'),
        allowNull: false
    },
    walletNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    paymentStatus: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false
    },
    paymentId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    paymobData: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    uniqueId: {
        type: DataTypes.STRING(8),
        allowNull: false,
        unique: true
    },
    qrCodeData: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    qrCodeImage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    verifiedBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    checkedIn: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    checkedInAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    checkedInBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    approved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    approvedBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    archived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    archivedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    archivedBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'payments',
    timestamps: true
});

module.exports = Payment;