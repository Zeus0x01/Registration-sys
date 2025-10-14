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
    },
    referralCode: {
        type: DataTypes.STRING(8),
        allowNull: true,
        comment: 'Unique referral code for tracking referred payments'
    }
}, {
    tableName: 'admins',
    timestamps: true,
    indexes: [{
        unique: true,
        fields: ['referralCode']
    }],
    hooks: {
        beforeCreate: async(admin) => {
            if (admin.password) {
                admin.password = await bcrypt.hash(admin.password, 10);
            }
            // Generate unique referral code - will be done after model is defined
        },
        beforeUpdate: async(admin) => {
            if (admin.changed('password')) {
                admin.password = await bcrypt.hash(admin.password, 10);
            }
        }
    }
});

// Generate referral codes for existing admins
const generateReferralCodes = async() => {
    try {
        const admins = await Admin.findAll({ where: { referralCode: null } });
        for (const admin of admins) {
            let code;
            let isUnique = false;
            while (!isUnique) {
                code = Math.random().toString(36).substring(2, 10).toUpperCase();
                const existing = await Admin.findOne({ where: { referralCode: code } });
                if (!existing) isUnique = true;
            }
            admin.referralCode = code;
            await admin.save();
            console.log(`Generated referral code ${code} for admin ${admin.username}`);
        }
    } catch (error) {
        console.error('Error generating referral codes:', error);
    }
};

// Run this once to update existing admins
if (require.main === module) {
    const sequelize = require('../config/database');
    sequelize.sync().then(() => {
        generateReferralCodes().then(() => {
            console.log('Referral codes generated successfully');
            process.exit(0);
        });
    });
}

// Add validatePassword method to Admin prototype
Admin.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = Admin;

// Add referral code generation hook after model is defined
Admin.addHook('beforeCreate', 'generateReferralCode', async(admin) => {
    if (!admin.referralCode) {
        let code;
        let isUnique = false;
        while (!isUnique) {
            code = Math.random().toString(36).substring(2, 10).toUpperCase();
            const existing = await Admin.findOne({ where: { referralCode: code } });
            if (!existing) isUnique = true;
        }
        admin.referralCode = code;
    }
});