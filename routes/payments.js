const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');

const Settings = require('../models/Settings');
const Wallet = require('../models/Wallet');
const Payment = require('../models/Payment');
const Admin = require('../models/Admin');

// Import Telegram notification function
const { sendTelegramNotification } = require('../telegram-bot');

// Middleware: Authenticate Admin
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

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// Generate unique 8-character alphanumeric ID
function generateUniqueId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Generate HMAC for QR code
function generateHMAC(data) {
    return crypto.createHmac('sha256', process.env.HMAC_SECRET).update(data).digest('hex');
}

// Verify Paymob webhook HMAC
function verifyPaymobHMAC(data) {
    const {
        amount_cents,
        created_at,
        currency,
        error_occured,
        has_parent_transaction,
        id,
        integration_id,
        is_3d_secure,
        is_auth,
        is_capture,
        is_refunded,
        is_standalone_payment,
        is_voided,
        order,
        owner,
        pending,
        source_data_pan,
        source_data_sub_type,
        source_data_type,
        success
    } = data;

    const concatenatedString = [
        amount_cents,
        created_at,
        currency,
        error_occured,
        has_parent_transaction,
        id,
        integration_id,
        is_3d_secure,
        is_auth,
        is_capture,
        is_refunded,
        is_standalone_payment,
        is_voided,
        order,
        owner,
        pending,
        source_data_pan,
        source_data_sub_type,
        source_data_type,
        success
    ].join('');

    const expectedHmac = crypto.createHmac('sha256', process.env.PAYMOB_HMAC_SECRET)
        .update(concatenatedString)
        .digest('hex');

    return expectedHmac === data.hmac;
}

// GET /settings/public - Get public settings (isActive status)
router.get('/settings/public', async(req, res) => {
    try {
        const settings = await Settings.findByPk(1);

        if (!settings) {
            return res.status(404).json({ success: false, message: 'Settings not found' });
        }

        res.json({
            success: true,
            isActive: settings.isActive,
            price: settings.price,
            priceOptions: settings.priceOptions
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /payments - Create payment with Paymob Intention API
router.post('/payments', async(req, res) => {
    try {
        const { userName, userEmail, userPhone, paymentMethod, selectedPriceIndex } = req.body;

        // Validate input
        if (!userName || !userEmail || !userPhone || !paymentMethod) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (!['paymob-wallet', 'paymob-card'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        // No wallet number validation - user enters it directly in Paymob's checkout

        // Check if system is active
        const settings = await Settings.findByPk(1);
        if (!settings || !settings.isActive) {
            return res.status(403).json({ success: false, message: 'Payment system is currently inactive' });
        }

        // Determine the price to use
        let priceToUse = settings.price;
        let priceLabel = 'Default';

        // Check if a price option was selected
        if (selectedPriceIndex !== undefined && selectedPriceIndex !== null) {
            try {
                const priceOptions = JSON.parse(settings.priceOptions);
                if (Array.isArray(priceOptions) && priceOptions[selectedPriceIndex]) {
                    priceToUse = parseFloat(priceOptions[selectedPriceIndex].amount);
                    priceLabel = priceOptions[selectedPriceIndex].label;
                }
            } catch (error) {
                console.error('Error parsing price options:', error);
            }
        }

        if (priceToUse <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid price configuration' });
        }

        // Get client IP and user agent
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // Generate unique ID
        let uniqueId;
        let isUnique = false;
        while (!isUnique) {
            uniqueId = generateUniqueId();
            const existing = await Payment.findOne({ where: { uniqueId } });
            if (!existing) isUnique = true;
        }

        // Create payment record first (before Paymob API calls)
        const payment = await Payment.create({
            userName,
            userEmail,
            userPhone,
            amount: priceToUse,
            paymentMethod,
            walletNumber: null, // Will be filled when user completes payment in Paymob
            paymentStatus: 'pending',
            uniqueId,
            ipAddress,
            userAgent,
            referralCode: req.body.referralCode || null
        });

        // Validate referral code and set referredBy if valid
        if (req.body.referralCode) {
            const referringAdmin = await Admin.findOne({
                where: { referralCode: req.body.referralCode }
            });
            if (referringAdmin) {
                payment.referredBy = referringAdmin.username;
                await payment.save();
            }
        }

        // Create or update wallet (mock)
        await Wallet.upsert({
            userEmail,
            userPhone,
            balance: 1000.00,
            currency: 'EGP'
        });

        // For wallet payments, return without iframe URL (will use custom modal)
        if (paymentMethod === 'paymob-wallet') {
            res.json({
                success: true,
                payment: {
                    id: payment.id,
                    uniqueId: payment.uniqueId,
                    amount: payment.amount,
                    paymentMethod: payment.paymentMethod
                },
                useIframe: false // Custom wallet modal will be used
            });
            return;
        }

        // For card payments, use Intention API to generate payment URL
        const amountCents = Math.round(parseFloat(priceToUse) * 100);

        // Get base URL for callbacks
        const baseUrl = process.env.WEBHOOK_URL ?
            process.env.WEBHOOK_URL.replace('/api/paymob-webhook', '') :
            `http://localhost:${process.env.PORT || 5000}`;

        // Split name into first and last
        const nameParts = userName.split(' ');
        const firstName = nameParts[0] || userName;
        const lastName = nameParts.slice(1).join(' ') || userName;

        // Create Intention API request for card payment
        const intentionPayload = {
            amount: amountCents,
            currency: "EGP",
            payment_methods: [parseInt(process.env.PAYMOB_INTEGRATION_ID_CARD)], // Card integration ID
            items: [{
                name: "Event Registration",
                amount: amountCents,
                description: `Registration for ${userName}`,
                quantity: 1
            }],
            billing_data: {
                apartment: "NA",
                first_name: firstName,
                last_name: lastName,
                street: "NA",
                building: "NA",
                phone_number: userPhone,
                country: "EG",
                email: userEmail,
                floor: "NA",
                state: "NA"
            },
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: userEmail,
                phone_number: userPhone
            },
            extras: {
                ee: uniqueId, // Store uniqueId for reference
                merchant_order_id: uniqueId
            },
            redirection_url: `${baseUrl}/payment-redirect.html?uniqueId=${uniqueId}`,
            notification_url: `${baseUrl}/api/paymob-webhook`, // CRITICAL: Tell Paymob where to send transaction notifications
            special_reference: uniqueId // Additional reference
        };

        console.log('Creating Intention API payment (card):', JSON.stringify(intentionPayload, null, 2));

        try {
            // Call Paymob Intention API
            const intentionResponse = await axios.post(
                `${process.env.PAYMOB_API_URL}/v1/intention/`,
                intentionPayload, {
                    headers: {
                        'Authorization': `Token ${process.env.PAYMOB_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Paymob Intention API response (card):', JSON.stringify(intentionResponse.data, null, 2));

            const intentionData = intentionResponse.data;

            // Update payment with Paymob intention data
            await payment.update({
                paymentId: intentionData.id ?.toString() || uniqueId,
                paymobData: JSON.stringify({
                    intentionId: intentionData.id,
                    clientSecret: intentionData.client_secret,
                    paymentMethods: intentionData.payment_methods,
                    intentionResponse: intentionData
                })
            });

            // For card payments with Intention API, use Unified Checkout with client_secret
            // The client_secret is the payment token that works with Unified Checkout
            const clientSecret = intentionData.client_secret;

            if (!clientSecret) {
                throw new Error('No client_secret returned from Paymob Intention API');
            }

            // Unified Checkout URL (works with Intention API's client_secret)
            const paymentUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;

            res.json({
                success: true,
                payment: {
                    id: payment.id,
                    uniqueId: payment.uniqueId,
                    amount: payment.amount,
                    paymentMethod: payment.paymentMethod
                },
                useIframe: true,
                paymentUrl
            });

        } catch (error) {
            console.error('Intention API error (card):', error.response ?.data || error.message);

            // If Intention API fails, fall back to old API
            console.log('Falling back to old API for card payment...');

            // Old API flow as fallback
            const authResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/auth/tokens`, {
                api_key: process.env.PAYMOB_API_KEY
            });
            const authToken = authResponse.data.token;

            const orderResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/ecommerce/orders`, {
                auth_token: authToken,
                delivery_needed: false,
                amount_cents: amountCents,
                currency: 'EGP',
                items: []
            });
            const orderId = orderResponse.data.id;

            const paymentKeyResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/acceptance/payment_keys`, {
                auth_token: authToken,
                amount_cents: amountCents,
                expiration: 3600,
                order_id: orderId,
                billing_data: {
                    apartment: 'NA',
                    email: userEmail,
                    floor: 'NA',
                    first_name: firstName,
                    last_name: lastName,
                    street: 'NA',
                    building: 'NA',
                    phone_number: userPhone,
                    shipping_method: 'NA',
                    postal_code: 'NA',
                    city: 'Cairo',
                    country: 'EG',
                    state: 'NA'
                },
                currency: 'EGP',
                integration_id: parseInt(process.env.PAYMOB_INTEGRATION_ID_CARD),
                notification_url: `${baseUrl}/api/paymob-webhook`,
                redirection_url: `${baseUrl}/payment-response.html`
            });

            const paymentToken = paymentKeyResponse.data.token;
            const iframeId = process.env.PAYMOB_IFRAME_ID_CARD;
            const paymentUrl = `${process.env.PAYMOB_API_URL}/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;

            await payment.update({
                paymentId: orderId.toString(),
                paymobData: JSON.stringify(paymentKeyResponse.data)
            });

            res.json({
                success: true,
                payment: {
                    id: payment.id,
                    uniqueId: payment.uniqueId,
                    amount: payment.amount,
                    paymentMethod: payment.paymentMethod
                },
                useIframe: true,
                paymentUrl
            });
        }

    } catch (error) {
        console.error('Payment creation error:', error.response ?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.response ?.data ?.detail || error.response ?.data ?.message || error.message
        });
    }
});

// GET /payments/statistics - Get payment statistics (admin only)
// NOTE: This must be BEFORE /payments/:uniqueId to avoid matching "statistics" as a uniqueId
router.get('/payments/statistics', authenticateAdmin, async(req, res) => {
    try {
        const { Op } = require('sequelize');

        // Count approved and valid payments (not archived)
        const approvedCount = await Payment.count({
            where: {
                approved: true,
                [Op.or]: [
                    { archived: false },
                    { archived: null }
                ]
            }
        });

        // Calculate total money from approved payments (not archived)
        const totalResult = await Payment.sum('amount', {
            where: {
                approved: true,
                [Op.or]: [
                    { archived: false },
                    { archived: null }
                ]
            }
        });

        const totalMoney = totalResult || 0;

        // Get total payments (not archived)
        const totalPayments = await Payment.count({
            where: {
                [Op.or]: [
                    { archived: false },
                    { archived: null }
                ]
            }
        });

        // Get checked-in count (not archived)
        const checkedInCount = await Payment.count({
            where: {
                checkedIn: true,
                [Op.or]: [
                    { archived: false },
                    { archived: null }
                ]
            }
        });

        // Get all admins and their referral stats
        const Admin = require('../models/Admin');
        const admins = await Admin.findAll();
        const referralStats = [];
        for (const admin of admins) {
            // Count approved payments referred by this admin (not archived)
            const referralCount = await Payment.count({
                where: {
                    approved: true,
                    referralCode: admin.referralCode,
                    [Op.or]: [
                        { archived: false },
                        { archived: null }
                    ]
                }
            });
            referralStats.push({
                username: admin.username,
                fullName: admin.fullName,
                referralCode: admin.referralCode,
                referralCount
            });
        }

        res.json({
            success: true,
            statistics: {
                approvedCount,
                totalMoney: parseFloat(totalMoney) % 1 === 0 ? parseInt(totalMoney) : parseFloat(totalMoney).toFixed(2),
                totalPayments,
                checkedInCount,
                pendingApproval: totalPayments - approvedCount,
                referralStats
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ success: false, message: 'Failed to get statistics' });
    }
});

// GET /payments/archived - List all archived payments (admin only)
// NOTE: This must be BEFORE /payments/:uniqueId to avoid matching "archived" as a uniqueId
router.get('/payments/archived', authenticateAdmin, async(req, res) => {
    try {
        const payments = await Payment.findAll({
            where: {
                archived: true
            },
            order: [
                ['archivedAt', 'DESC'] // Most recently archived first
            ],
            attributes: [
                'id', 'userName', 'userEmail', 'userPhone', 'amount',
                'paymentMethod', 'paymentStatus', 'uniqueId', 'verified',
                'checkedIn', 'createdAt', 'qrCodeImage', 'approved', 'approvedAt', 'approvedBy',
                'archived', 'archivedAt', 'archivedBy'
            ]
        });

        res.json({ success: true, payments });
    } catch (error) {
        console.error('List archived payments error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /payments/:uniqueId - Get payment status for polling
router.get('/payments/:uniqueId', async(req, res) => {
    try {
        const { uniqueId } = req.params;

        const payment = await Payment.findOne({ where: { uniqueId } });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.json({
            success: true,
            valid: payment.verified && payment.paymentStatus === 'completed',
            payment: {
                uniqueId: payment.uniqueId,
                paymentStatus: payment.paymentStatus,
                verified: payment.verified,
                amount: payment.amount,
                qrCodeImage: payment.qrCodeImage,
                createdAt: payment.createdAt,
                userName: payment.userName,
                userEmail: payment.userEmail,
                userPhone: payment.userPhone,
                paymentMethod: payment.paymentMethod
            }
        });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment status'
        });
    }
});

// POST /wallet-pay-direct - Create wallet payment and return checkout URL directly (simplified flow)
router.post('/wallet-pay-direct', async(req, res) => {
    try {
        const { uniqueId } = req.body;

        if (!uniqueId) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID is required'
            });
        }

        // Find the payment
        const payment = await Payment.findOne({ where: { uniqueId } });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // NOTE: NOT pre-filling phone number - user enters wallet number in Paymob checkout
        // This avoids phone format issues and lets Paymob handle wallet number validation
        console.log('Skipping phone pre-fill - user will enter wallet number in Paymob checkout');

        // Calculate amount in cents
        const amountCents = Math.round(payment.amount * 100);

        // Get base URL for callbacks
        const baseUrl = process.env.WEBHOOK_URL ?
            process.env.WEBHOOK_URL.replace('/api/paymob-webhook', '') :
            `http://localhost:${process.env.PORT || 5000}`;

        // Split name into first and last
        const nameParts = payment.userName.split(' ');
        const firstName = nameParts[0] || payment.userName;
        const lastName = nameParts.slice(1).join(' ') || payment.userName;

        // Create Intention API request WITHOUT phone number pre-fill
        // User will enter their wallet number directly in Paymob's checkout
        const intentionPayload = {
            amount: amountCents,
            currency: "EGP",
            payment_methods: [parseInt(process.env.PAYMOB_INTEGRATION_ID_WALLET)],
            items: [{
                name: "Event Registration",
                amount: amountCents,
                description: `Registration for ${payment.userName}`,
                quantity: 1
            }],
            billing_data: {
                apartment: "NA",
                first_name: firstName,
                last_name: lastName,
                street: "NA",
                building: "NA",
                phone_number: "+20", // Empty - user will enter in checkout
                country: "EG",
                email: payment.userEmail,
                floor: "NA",
                state: "NA"
            },
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: payment.userEmail,
                phone_number: "+20" // Empty - user will enter in checkout
            },
            extras: {
                ee: uniqueId
            },
            notification_url: `${baseUrl}/api/paymob-webhook`, // Webhook for transaction callbacks
            redirection_url: `${baseUrl}/payment-response.html`,
            special_reference: uniqueId
        };

        console.log('Creating Intention API payment (direct - NO phone pre-fill):', JSON.stringify(intentionPayload, null, 2));

        // Call Paymob Intention API
        const intentionResponse = await axios.post(
            `${process.env.PAYMOB_API_URL}/v1/intention/`,
            intentionPayload, {
                headers: {
                    'Authorization': `Token ${process.env.PAYMOB_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Paymob Intention API response (direct):', JSON.stringify(intentionResponse.data, null, 2));

        const intentionData = intentionResponse.data;

        // Update payment with Paymob data
        await payment.update({
            paymentId: intentionData.id ?.toString() || uniqueId,
            walletNumber: null, // Will be filled when user completes payment in Paymob
            paymobData: JSON.stringify({
                intentionId: intentionData.id,
                clientSecret: intentionData.client_secret,
                paymentMethods: intentionData.payment_methods,
                intentionResponse: intentionData
            }),
            paymentStatus: 'pending'
        });

        // Generate unified checkout URL
        if (intentionData.client_secret) {
            const checkoutUrl = `${process.env.PAYMOB_API_URL}/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${intentionData.client_secret}`;

            console.log('Unified checkout URL generated (direct):', checkoutUrl);

            res.json({
                success: true,
                message: 'Payment initiated. Opening checkout...',
                data: {
                    pending: true,
                    checkoutUrl: checkoutUrl,
                    publicKey: process.env.PAYMOB_PUBLIC_KEY,
                    clientSecret: intentionData.client_secret,
                    intentionId: intentionData.id
                }
            });
        } else {
            throw new Error('Client secret not received from Paymob');
        }

    } catch (error) {
        console.error('Wallet pay direct error:', error.response ?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.response ?.data ?.detail || error.response ?.data ?.message || error.message
        });
    }
});

// POST /wallet-pay - Process wallet payment using Intention API (New Unified Checkout)
router.post('/wallet-pay', async(req, res) => {
    try {
        const { uniqueId, mobileNumber } = req.body;

        if (!uniqueId || !mobileNumber) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID and mobile number are required'
            });
        }

        // Find the payment
        const payment = await Payment.findOne({ where: { uniqueId } });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Format mobile number - remove leading zero (01010101010 -> 1010101010)
        let formattedNumber = mobileNumber;
        if (mobileNumber.startsWith('0') && mobileNumber.length === 11) {
            formattedNumber = mobileNumber.substring(1);
            console.log(`Phone number formatted: ${mobileNumber} -> ${formattedNumber}`);
        }

        // Try with +20 country code format (international format)
        const internationalPhone = `+20${formattedNumber}`;
        console.log(`International format: ${internationalPhone}`);

        // Update wallet number (store original with zero)
        await payment.update({ walletNumber: mobileNumber });

        // Calculate amount in cents
        const amountCents = Math.round(payment.amount * 100);

        // Get base URL for callbacks
        const baseUrl = process.env.WEBHOOK_URL ?
            process.env.WEBHOOK_URL.replace('/api/paymob-webhook', '') :
            `http://localhost:${process.env.PORT || 5000}`;

        // Split name into first and last
        const nameParts = payment.userName.split(' ');
        const firstName = nameParts[0] || payment.userName;
        const lastName = nameParts.slice(1).join(' ') || payment.userName;

        // Create Intention API request using new Unified Checkout with pre-filled phone
        const intentionPayload = {
            amount: amountCents,
            currency: "EGP",
            payment_methods: [parseInt(process.env.PAYMOB_INTEGRATION_ID_WALLET)], // Wallet integration ID
            items: [{
                name: "Event Registration",
                amount: amountCents,
                description: `Registration for ${payment.userName}`,
                quantity: 1
            }],
            billing_data: {
                apartment: "NA",
                first_name: firstName,
                last_name: lastName,
                street: "NA",
                building: "NA",
                phone_number: "+20", // Empty - user enters in checkout
                country: "EG",
                email: payment.userEmail,
                floor: "NA",
                state: "NA"
            },
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: payment.userEmail,
                phone_number: "+20" // Empty - user enters in checkout
            },
            extras: {
                ee: uniqueId // Store uniqueId for reference
            },
            notification_url: `${baseUrl}/api/paymob-webhook`, // Webhook for transaction callbacks
            redirection_url: `${baseUrl}/payment-response.html`,
            special_reference: uniqueId // Additional reference
        };

        console.log('Creating Intention API payment:', JSON.stringify(intentionPayload, null, 2));

        // Call Paymob Intention API
        const intentionResponse = await axios.post(
            `${process.env.PAYMOB_API_URL}/v1/intention/`,
            intentionPayload, {
                headers: {
                    'Authorization': `Token ${process.env.PAYMOB_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Paymob Intention API response:', JSON.stringify(intentionResponse.data, null, 2));

        const intentionData = intentionResponse.data;

        // Update payment with Paymob intention data
        await payment.update({
            paymentId: intentionData.id ?.toString() || uniqueId,
            paymobData: JSON.stringify({
                intentionId: intentionData.id,
                clientSecret: intentionData.client_secret,
                paymentMethods: intentionData.payment_methods,
                intentionResponse: intentionData
            }),
            paymentStatus: 'pending' // Set to pending, waiting for phone confirmation
        });

        // According to Paymob Intention API documentation:
        // For wallet payments, return the checkout URL that should be opened in browser/webview
        // URL format: https://accept.paymob.com/unifiedcheckout/?publicKey=<PUBLIC_KEY>&clientSecret=<CLIENT_SECRET>

        if (intentionData.client_secret) {
            // Generate unified checkout URL
            const checkoutUrl = `${process.env.PAYMOB_API_URL}/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${intentionData.client_secret}`;

            console.log('Unified checkout URL generated:', checkoutUrl);

            res.json({
                success: true,
                message: 'Payment initiated. Opening checkout page...',
                data: {
                    pending: true,
                    intentionId: intentionData.id,
                    clientSecret: intentionData.client_secret,
                    checkoutUrl: checkoutUrl, // Return checkout URL for frontend to open
                    publicKey: process.env.PAYMOB_PUBLIC_KEY
                }
            });
        } else {
            res.json({
                success: true,
                message: 'Payment initiated. Please check your phone for confirmation.',
                data: {
                    pending: true,
                    intentionId: intentionData.id
                }
            });
        }

    } catch (error) {
        console.error('Intention API error:', error.response ?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to process wallet payment',
            error: error.response ?.data ?.detail || error.response ?.data ?.message || error.message
        });
    }
});

// POST /wallet-verify-otp - Verify OTP for wallet payment
router.post('/wallet-verify-otp', async(req, res) => {
    try {
        const { uniqueId, otp } = req.body;

        if (!uniqueId || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID and OTP are required'
            });
        }

        // Find the payment
        const payment = await Payment.findOne({ where: { uniqueId } });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Get payment data
        const paymobData = JSON.parse(payment.paymobData || '{}');
        const { paymentToken } = paymobData;

        if (!paymentToken) {
            return res.status(400).json({
                success: false,
                message: 'Payment token not found. Please restart payment process.'
            });
        }

        // Verify OTP with Paymob
        const verifyResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/acceptance/payments/pay`, {
            source: {
                identifier: payment.walletNumber,
                subtype: 'WALLET'
            },
            payment_token: paymentToken,
            otp
        });

        console.log('Paymob OTP verification response:', JSON.stringify(verifyResponse.data, null, 2));

        // Check if payment was successful (Paymob returns different response structures)
        const isSuccess = verifyResponse.data.success === true ||
            verifyResponse.data.success === 'true' ||
            verifyResponse.data.pending === false ||
            (verifyResponse.data.id && !verifyResponse.data.error);

        if (isSuccess) {
            // Update payment status to 'paid' (not 'completed')
            await payment.update({
                paymentStatus: 'paid',
                verified: true,
                verifiedAt: new Date(),
                paymobData: JSON.stringify({
                    ...paymobData,
                    verifyResponse: verifyResponse.data
                })
            });

            // Send notification
            try {
                await sendPaymentNotification(payment);
            } catch (notifError) {
                console.error('Notification error:', notifError);
            }

            res.json({
                success: true,
                message: 'Payment completed successfully',
                payment: {
                    uniqueId: payment.uniqueId,
                    qrCodeImage: payment.qrCodeImage,
                    amount: payment.amount
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'OTP verification failed',
                error: verifyResponse.data
            });
        }

    } catch (error) {
        console.error('OTP verification error:', error.response ?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.response ?.data ?.message || error.message
        });
    }
});

// POST /test-complete-payment - DEVELOPMENT ONLY: Manually complete a payment and send notification
router.post('/test-complete-payment', async(req, res) => {
    try {
        const { uniqueId } = req.body;

        if (!uniqueId) {
            return res.status(400).json({ success: false, message: 'uniqueId is required' });
        }

        const payment = await Payment.findOne({ where: { uniqueId } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Update payment status
        payment.paymentStatus = 'completed';
        payment.verified = true;
        payment.verifiedAt = new Date();

        // Generate QR code if not exists
        if (!payment.qrCodeImage) {
            const qrPayload = `${payment.uniqueId}:${generateHMAC(payment.uniqueId)}`;
            payment.qrCodeData = qrPayload;
            const qrCodeImage = await QRCode.toDataURL(qrPayload);
            payment.qrCodeImage = qrCodeImage;
        }

        await payment.save();

        // Send Telegram notification
        await sendTelegramNotification(payment);

        res.json({
            success: true,
            message: 'Payment completed and notification sent',
            payment: {
                uniqueId: payment.uniqueId,
                status: payment.paymentStatus,
                approved: payment.approved
            }
        });

    } catch (error) {
        console.error('Test complete payment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /paymob-webhook - Handle Paymob webhook (supports both old API and Intention API)
router.post('/paymob-webhook', async(req, res) => {
    try {
        const data = req.body;

        console.log('Webhook received:', JSON.stringify(data, null, 2));

        // Intention API sends transaction data in 'obj' field
        // Look for payment reference in multiple places according to documentation
        let payment = null;
        let transactionSuccess = false;

        // Check transaction success status (handle more Paymob cases)
        if (data.obj) {
            transactionSuccess = (
                data.obj.success === true ||
                data.obj.success === 'true' ||
                data.obj.pending === false ||
                data.obj.response_code === 200 ||
                data.obj.response_code === '200' ||
                (data.obj.id && !data.obj.error)
            );
        }

        // Try to find payment by special_reference (set in Intention API)
        if (data.obj && data.obj.merchant_order_id) {
            // Intention API returns special_reference as merchant_order_id
            const specialRef = data.obj.merchant_order_id;
            payment = await Payment.findOne({ where: { uniqueId: specialRef } });
            console.log(`Looking for payment by special_reference: ${specialRef}`);
        }

        // Try to find by extras.ee (alternative reference field)
        if (!payment && data.obj && data.obj.payment_key_claims && data.obj.payment_key_claims.extra) {
            const extras = data.obj.payment_key_claims.extra;
            if (extras.ee) {
                payment = await Payment.findOne({ where: { uniqueId: extras.ee } });
                console.log(`Looking for payment by extras.ee: ${extras.ee}`);
            }
        }

        // Fallback: Try to find by order ID (old API format)
        if (!payment && data.obj && data.obj.order && data.obj.order.id) {
            const orderId = data.obj.order.id.toString();
            payment = await Payment.findOne({ where: { paymentId: orderId } });
            console.log(`Looking for payment by order ID: ${orderId}`);
        }

        if (!payment) {
            console.error('Payment not found in webhook. Data:', JSON.stringify(data, null, 2));
            // Still return success to Paymob to avoid retries
            return res.json({ success: true, message: 'Payment not found' });
        }

        // Update payment based on transaction status
        if (transactionSuccess && data.type === 'TRANSACTION') {
            console.log(`Payment found: ${payment.uniqueId}, updating to paid`);

            // Update payment status to 'paid' (wait for admin approval)
            payment.paymentStatus = 'paid';
            payment.verified = true;
            payment.verifiedAt = new Date();
            payment.paymobData = JSON.stringify(data);

            // Generate QR code if not exists
            if (!payment.qrCodeImage) {
                const qrPayload = `${payment.uniqueId}:${generateHMAC(payment.uniqueId)}`;
                payment.qrCodeData = qrPayload;
                payment.qrCodeImage = await QRCode.toDataURL(qrPayload);
            }

            await payment.save();
            await sendTelegramNotification(payment);
            console.log('Payment paid and notification sent:', payment.uniqueId);

        } else if (!transactionSuccess && data.obj) {
            // Payment failed
            console.log(`Payment failed: ${payment.uniqueId}`);
            payment.paymentStatus = 'failed';
            payment.paymobData = JSON.stringify(data);
            await payment.save();
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
});

// GET /payments/:uniqueId - Get payment details (admin only, or public with QR verification)
router.get('/payments/:uniqueId', async(req, res) => {
    try {
        const { uniqueId } = req.params;
        const { payload } = req.query;

        const payment = await Payment.findOne({ where: { uniqueId } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found', valid: false });
        }

        // If payload provided, verify HMAC (public QR check)
        if (payload) {
            const [id, hmac] = payload.split(':');
            const expectedHmac = generateHMAC(id);

            if (id === uniqueId && hmac === expectedHmac && payment.paymentStatus === 'completed') {
                return res.json({
                    success: true,
                    valid: true,
                    details: {
                        userName: payment.userName,
                        amount: payment.amount,
                        paymentMethod: payment.paymentMethod,
                        verified: payment.verified,
                        checkedIn: payment.checkedIn
                    }
                });
            } else {
                return res.json({ success: false, valid: false, message: 'Invalid QR code or payment not completed' });
            }
        }

        // Check if this is a public polling request (from payment-success.html)
        // Allow limited public access for status checking
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Public access - return only status and QR if completed
            return res.json({
                success: true,
                payment: {
                    uniqueId: payment.uniqueId,
                    paymentStatus: payment.paymentStatus,
                    approved: payment.approved,
                    qrCodeImage: payment.qrCodeImage, // Only available if payment completed
                }
            });
        }

        // Admin authentication for full details
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        // Return full payment details for admin
        res.json({
            success: true,
            valid: payment.verified && payment.paymentStatus === 'completed', // Use verified instead of approved
            payment: {
                id: payment.id,
                userName: payment.userName,
                userEmail: payment.userEmail,
                userPhone: payment.userPhone,
                amount: payment.amount,
                paymentMethod: payment.paymentMethod,
                paymentStatus: payment.paymentStatus,
                uniqueId: payment.uniqueId,
                qrCodeImage: payment.qrCodeImage,
                verified: payment.verified,
                verifiedAt: payment.verifiedAt,
                approved: payment.approved,
                approvedAt: payment.approvedAt,
                approvedBy: payment.approvedBy,
                checkedIn: payment.checkedIn,
                checkedInAt: payment.checkedInAt,
                checkedInBy: payment.checkedInBy,
                createdAt: payment.createdAt
            }
        });

    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /payments/:uniqueId/checkin - Mark payment as checked in (admin only)
router.post('/payments/:uniqueId/checkin', authenticateAdmin, async(req, res) => {
    // Debug logging for uniqueId and payment lookup
    console.log('Check-in request received for uniqueId:', req.params.uniqueId);
    const payment = await Payment.findOne({ where: { uniqueId: req.params.uniqueId } });
    console.log('Payment lookup result:', payment ? payment.dataValues : null);
    try {
        const { uniqueId } = req.params;

        const payment = await Payment.findOne({ where: { uniqueId } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Check if payment is approved (new requirement)
        // Allow check-in for any payment with status 'completed'
        if (payment.paymentStatus !== 'completed') {
            return res.status(400).json({ success: false, message: 'Payment must be completed before check-in.' });
        }

        if (payment.checkedIn) {
            return res.status(400).json({ success: false, message: 'Payment already checked in.' });
        }

        payment.checkedIn = true;
        payment.checkedInAt = new Date();
        payment.checkedInBy = req.user.username;
        await payment.save();

        // Send Telegram notification for check-in
        if (bot && process.env.TELEGRAM_ORGANIZER_CHAT_ID) {
            const message = `
✅ *Check-In Successful!*

👤 *Name:* ${payment.userName}
📧 *Email:* ${payment.userEmail}
🆔 *Unique ID:* \`${payment.uniqueId}\`
💰 *Amount:* ${payment.amount} EGP
⏰ *Check-In Time:* ${new Date().toLocaleString()}
👨‍💼 *Staff:* ${req.user.username}
            `.trim();

            await bot.sendMessage(
                process.env.TELEGRAM_ORGANIZER_CHAT_ID,
                message, { parse_mode: 'Markdown' }
            );
        }

        res.json({ success: true, message: 'Check-in successful', payment });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /payments - List all payments (admin only)
router.get('/payments', authenticateAdmin, async(req, res) => {
    try {
        const { Op } = require('sequelize');

        const payments = await Payment.findAll({
            order: [
                ['id', 'DESC']
            ],
            attributes: [
                'id', 'userName', 'userEmail', 'userPhone', 'amount',
                'paymentMethod', 'paymentStatus', 'uniqueId', 'verified',
                'checkedIn', 'checkedInAt', 'checkedInBy', 'createdAt', 'qrCodeImage',
                'approved', 'approvedAt', 'approvedBy', 'archived'
            ]
        });

        res.json({ success: true, payments });
    } catch (error) {
        console.error('List payments error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /settings - Update settings (admin only)
router.post('/settings', authenticateAdmin, async(req, res) => {
    try {
        const { price, isActive, priceOptions } = req.body;

        const settings = await Settings.findByPk(1);

        if (!settings) {
            return res.status(404).json({ success: false, message: 'Settings not found' });
        }

        if (price !== undefined) {
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum < 0) {
                return res.status(400).json({ success: false, message: 'Invalid price' });
            }
            settings.price = priceNum;
        }

        if (isActive !== undefined) {
            settings.isActive = isActive === 'true' || isActive === true;
        }

        if (priceOptions !== undefined) {
            settings.priceOptions = priceOptions;
        }

        await settings.save();

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /settings - Get settings (admin only)
router.get('/settings', authenticateAdmin, async(req, res) => {
    try {
        const settings = await Settings.findByPk(1);

        if (!settings) {
            return res.status(404).json({ success: false, message: 'Settings not found' });
        }

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /payments/:id/send-telegram - Send payment to Telegram (admin only)
router.post('/payments/:id/send-telegram', authenticateAdmin, async(req, res) => {
    try {
        const payment = await Payment.findByPk(req.params.id);

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Send to Telegram
        if (bot && process.env.TELEGRAM_ORGANIZER_CHAT_ID) {
            const statusEmoji = payment.paymentStatus === 'completed' ? '✅' :
                payment.paymentStatus === 'pending' ? '⏳' : '❌';

            const approvedEmoji = payment.approved ? '✅ Approved' : '⏳ Pending Approval';

            const message = `
🔔 *Payment Details Sent from Dashboard*

💳 *Payment ID:* ${payment.uniqueId}
👤 *Name:* ${payment.userName}
📧 *Email:* ${payment.userEmail}
📱 *Phone:* ${payment.userPhone}
💰 *Amount:* ${payment.amount} EGP
💳 *Method:* ${payment.paymentMethod === 'paymob-wallet' ? '📱 Mobile Wallet' : '💳 Card/Debit'}
📅 *Date:* ${new Date(payment.createdAt).toLocaleString()}

*Status:* ${statusEmoji} ${payment.paymentStatus}
*Approval:* ${approvedEmoji}
*Check-in:* ${payment.checkedIn ? '✅ Checked In' : '⏳ Not Yet'}
            `.trim();

            // Add inline keyboard for approval if not approved
            const keyboard = payment.approved ? null : {
                inline_keyboard: [
                    [
                        { text: '✅ Approve Payment', callback_data: `approve_${payment.id}` }
                    ]
                ]
            };

            await bot.sendMessage(
                process.env.TELEGRAM_ORGANIZER_CHAT_ID,
                message, { parse_mode: 'Markdown', reply_markup: keyboard }
            );
        }

        res.json({ success: true, message: 'Payment sent to Telegram successfully' });
    } catch (error) {
        console.error('Send to Telegram error:', error);
        res.status(500).json({ success: false, message: 'Failed to send to Telegram' });
    }
});

// POST /payments/:id/approve - Approve payment (admin only)
router.post('/payments/:id/approve', authenticateAdmin, async(req, res) => {
    try {
        const payment = await Payment.findByPk(req.params.id);

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.approved) {
            return res.json({ success: true, message: 'Payment already approved' });
        }

        // Approve payment AND mark as completed
        payment.approved = true;
        payment.approvedAt = new Date();
        payment.approvedBy = req.user.username; // From JWT token
        payment.paymentStatus = 'completed'; // Mark as completed
        payment.verified = true;
        payment.verifiedAt = new Date();

        // Generate QR code if not already generated
        if (!payment.qrCodeImage) {
            const qrPayload = `${payment.uniqueId}:${generateHMAC(payment.uniqueId)}`;
            payment.qrCodeData = qrPayload;

            // Generate QR code image (base64)
            const QRCode = require('qrcode');
            const qrCodeImage = await QRCode.toDataURL(qrPayload);
            payment.qrCodeImage = qrCodeImage;
        }

        await payment.save();

        // Send confirmation to Telegram
        if (bot && process.env.TELEGRAM_ORGANIZER_CHAT_ID) {
            const message = `
✅ *Payment Approved & Completed!*

💳 *Payment ID:* \`${payment.uniqueId}\`
👤 *Name:* ${payment.userName}
📧 *Email:* ${payment.userEmail}
💰 *Amount:* ${payment.amount} EGP
👨‍💼 *Approved By:* ${req.user.username}
📅 *Approved At:* ${new Date().toLocaleString()}

✅ *Status:* Completed
🎫 *QR Code:* Generated
            `.trim();

            await bot.sendMessage(
                process.env.TELEGRAM_ORGANIZER_CHAT_ID,
                message, { parse_mode: 'Markdown' }
            );
        }

        res.json({ success: true, message: 'Payment approved successfully', payment });
    } catch (error) {
        console.error('Approve payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to approve payment' });
    }
});

// POST /payments/:uniqueId/archive - Archive a payment (admin only)
router.post('/payments/:uniqueId/archive', authenticateAdmin, async(req, res) => {
    try {
        const payment = await Payment.findOne({ where: { uniqueId: req.params.uniqueId } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.archived) {
            return res.json({ success: true, message: 'Payment already archived' });
        }

        payment.archived = true;
        payment.archivedAt = new Date();
        payment.archivedBy = req.user.username;
        await payment.save();

        res.json({ success: true, message: 'Payment archived successfully' });
    } catch (error) {
        console.error('Archive payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to archive payment' });
    }
});

// POST /payments/archive-all - Archive all current payments (admin only)
router.post('/payments/archive-all', authenticateAdmin, async(req, res) => {
    try {
        const result = await Payment.update({
            archived: true,
            archivedAt: new Date(),
            archivedBy: req.user.username
        }, {
            where: {
                archived: false
            }
        });

        res.json({
            success: true,
            message: `${result[0]} payment(s) archived successfully`,
            archivedCount: result[0]
        });
    } catch (error) {
        console.error('Archive all payments error:', error);
        res.status(500).json({ success: false, message: 'Failed to archive payments' });
    }
});

// DELETE /payments/:uniqueId - Delete a payment permanently (admin only)
router.delete('/payments/:uniqueId', authenticateAdmin, async(req, res) => {
    try {
        const payment = await Payment.findOne({ where: { uniqueId: req.params.uniqueId } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Delete the payment permanently
        await payment.destroy();

        res.json({ success: true, message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete payment' });
    }
});

module.exports = router;
