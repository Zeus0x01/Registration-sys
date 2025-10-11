const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 50]
        }
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        },
        set(value) {
            this.setDataValue('email', value.toLowerCase().trim());
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'admins',
    timestamps: true,
    hooks: {
        beforeCreate: async(admin) => {
            if (admin.password) {
                admin.password = await bcrypt.hash(admin.password, 10);
            }
        },
        beforeUpdate: async(admin) => {
            if (admin.changed('password')) {
                admin.password = await bcrypt.hash(admin.password, 10);
            }
        }
    }
});

// Instance method to check password
Admin.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = Admin;