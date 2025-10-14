require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Database
const sequelize = require('./config/database');
const Settings = require('./models/Settings');
const Wallet = require('./models/Wallet');
const Payment = require('./models/Payment');
const Admin = require('./models/Admin');

// Initialize Telegram Bot
require('./telegram-bot');

// Routes
const paymentsRouter = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Admin authentication middleware
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');

        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Admin Registration Endpoint
app.post('/api/admin/register', async(req, res) => {
    try {
        const { username, email, password, fullName } = req.body;

        // Validation
        if (!username || !email || !password || !fullName) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({
            where: {
                [sequelize.Sequelize.Op.or]: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: 'Username or email already exists'
            });
        }

        // Create admin
        const admin = await Admin.create({
            username,
            email,
            password, // Will be hashed by the model hook
            fullName
        });

        console.log(`✓ New admin registered: ${username}`);

        res.json({
            success: true,
            message: 'Admin account created successfully',
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                fullName: admin.fullName
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin Login Endpoint
app.post('/api/admin/login', async(req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }

        // Find admin by username
        const admin = await Admin.findOne({ where: { username } });

        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: 'Account is disabled' });
        }

        // Validate password
        const isValidPassword = await admin.validatePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Generate JWT
        const token = jwt.sign({
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: 'admin'
            },
            process.env.JWT_SECRET || 'fallback-secret-key-for-development', { expiresIn: '1d' }
        );

        res.json({
            success: true,
            token,
            admin: {
                username: admin.username,
                email: admin.email,
                fullName: admin.fullName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify Admin Token Endpoint
app.get('/api/admin/verify-token', async(req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ valid: false, message: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');
        
        // Check if admin exists and is active
        const admin = await Admin.findByPk(decoded.id);
        
        if (!admin || !admin.isActive) {
            return res.status(401).json({ valid: false, message: 'Invalid or inactive account' });
        }
        
        return res.json({ 
            valid: true, 
            admin: {
                username: admin.username,
                email: admin.email,
                fullName: admin.fullName
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ valid: false, message: 'Invalid token' });
    }
});

// Get Admin Payments
app.get('/api/admin/payments', authenticateAdmin, async(req, res) => {
    try {
        // Get all payments
        const payments = await Payment.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        // Calculate stats
        const totalPayments = payments.length;
        const totalAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const pendingPayments = payments.filter(p => p.status === 'pending').length;
        const completedPayments = payments.filter(p => p.status === 'completed').length;
        
        res.json({
            success: true,
            payments,
            stats: {
                totalPayments,
                totalAmount,
                pendingPayments,
                completedPayments
            }
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get current admin details
app.get('/api/admin/me', authenticateAdmin, async(req, res) => {
    try {
        const admin = await Admin.findByPk(req.admin.id);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        res.json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                fullName: admin.fullName,
                referralCode: admin.referralCode,
                isActive: admin.isActive,
                lastLogin: admin.lastLogin
            }
        });
    } catch (error) {
        console.error('Get admin details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mount API routes
app.use('/api', paymentsRouter);

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// Database connection and initialization
async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connection established successfully');

        // Sync models
        await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
        console.log('✓ Database models synchronized');

        // Initialize Settings table with default row
        const settingsCount = await Settings.count();
        if (settingsCount === 0) {
            await Settings.create({
                id: 1,
                price: 0.00,
                isActive: false
            });
            console.log('✓ Settings table initialized with default values');
        }

        console.log('✓ Database initialization complete');
    } catch (error) {
        console.error('✗ Unable to connect to database:', error);
        process.exit(1);
    }
}

// Start server
async function startServer() {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on ${process.env.APP_URL}`);
        console.log(`📄 Payment page: ${process.env.APP_URL}/payment.html`);
        console.log(`👨‍💼 Admin dashboard: ${process.env.APP_URL}/admin.html`);
        console.log(`✅ Check-in page: ${process.env.APP_URL}/checkin.html\n`);
    });
}

startServer();

module.exports = app;