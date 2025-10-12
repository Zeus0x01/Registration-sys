const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');

const Settings = require('../models/Settings');
const Wallet = require('../models/Wallet');
const Payment = require('../models/Payment');

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
        const { userName, userEmail, userPhone, paymentMethod, walletNumber, selectedPriceIndex } = req.body;

        // Validate input
        if (!userName || !userEmail || !userPhone || !paymentMethod) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (!['paymob-wallet', 'paymob-card'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        // Validate wallet number if mobile wallet selected
        if (paymentMethod === 'paymob-wallet' && (!walletNumber || walletNumber.length !== 11)) {
            return res.status(400).json({ success: false, message: 'Valid wallet number is required' });
        }

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

        // Step 1: Get Paymob auth token
        const authResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/auth/tokens`, {
            api_key: process.env.PAYMOB_API_KEY
        });

        const authToken = authResponse.data.token;

        // Step 2: Create order
        const amountCents = Math.round(parseFloat(priceToUse) * 100);
        const orderResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/ecommerce/orders`, {
            auth_token: authToken,
            delivery_needed: false,
            amount_cents: amountCents,
            currency: 'EGP',
            items: []
        });

        const orderId = orderResponse.data.id;

        // Step 3: Create payment intention with callbacks
        const integrationId = paymentMethod === 'paymob-wallet' ?
            process.env.PAYMOB_INTEGRATION_ID_WALLET :
            process.env.PAYMOB_INTEGRATION_ID_CARD;

        // Get base URL for callbacks (use WEBHOOK_URL if available, otherwise construct from environment)
        const baseUrl = process.env.WEBHOOK_URL ? 
            process.env.WEBHOOK_URL.replace('/api/paymob-webhook', '') : 
            `http://localhost:${process.env.PORT || 5000}`;

        const intentionResponse = await axios.post(`${process.env.PAYMOB_API_URL}/api/acceptance/payment_keys`, {
            auth_token: authToken,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: orderId,
            billing_data: {
                apartment: 'NA',
                email: userEmail,
                floor: 'NA',
                first_name: userName.split(' ')[0] || userName,
                last_name: userName.split(' ').slice(1).join(' ') || userName,
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
            integration_id: parseInt(integrationId),
            // Add callback URLs
            notification_url: `${baseUrl}/api/paymob-webhook`,
            redirection_url: `${baseUrl}/payment-response.html`
        });

        const paymentToken = intentionResponse.data.token;

        // Generate iframe URL with correct iframe ID based on payment method
        const iframeId = paymentMethod === 'paymob-wallet' ?
            process.env.PAYMOB_IFRAME_ID_WALLET :
            process.env.PAYMOB_IFRAME_ID_CARD;
        const paymentUrl = `${process.env.PAYMOB_API_URL}/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;

        // Create payment record
        const payment = await Payment.create({
            userName,
            userEmail,
            userPhone,
            amount: priceToUse,
            paymentMethod,
            walletNumber: paymentMethod === 'paymob-wallet' ? walletNumber : null,
            paymentStatus: 'pending',
            paymentId: orderId.toString(),
            paymobData: JSON.stringify(intentionResponse.data),
            uniqueId,
            ipAddress,
            userAgent
        });

        // Create or update wallet (mock)
        await Wallet.upsert({
            userEmail,
            userPhone,
            balance: 1000.00,
            currency: 'EGP'
        });

        // Don't send notification yet - wait for user to complete payment
        // Notification will be sent by webhook when payment is confirmed

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
        console.error('Payment creation error:', error.response ? .data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment',
            error: error.response ? .data ? .message || error.message
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

// POST /paymob-webhook - Handle Paymob webhook
router.post('/paymob-webhook', async(req, res) => {
    try {
        const data = req.body;

        console.log('Webhook received:', JSON.stringify(data, null, 2));

        // Verify HMAC
        if (!verifyPaymobHMAC(data)) {
            console.error('Invalid HMAC signature');
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        // Check if transaction is successful
        if (data.obj && data.obj.success === true && data.type === 'TRANSACTION') {
            const orderId = data.obj.order ? .id ? .toString();

            if (!orderId) {
                console.error('No order ID in webhook');
                return res.status(400).json({ success: false, message: 'No order ID' });
            }

            // Find payment by order ID
            const payment = await Payment.findOne({ where: { paymentId: orderId } });

            if (!payment) {
                console.error('Payment not found for order:', orderId);
                return res.status(404).json({ success: false, message: 'Payment not found' });
            }

            // Update payment status
            payment.paymentStatus = 'completed';
            payment.verified = true;
            payment.verifiedAt = new Date();
            payment.paymobData = JSON.stringify(data);

            // Generate QR code
            const qrPayload = `${payment.uniqueId}:${generateHMAC(payment.uniqueId)}`;
            payment.qrCodeData = qrPayload;

            // Generate QR code image (base64)
            const qrCodeImage = await QRCode.toDataURL(qrPayload);
            payment.qrCodeImage = qrCodeImage;

            await payment.save();

            // Send Telegram notification
            await sendTelegramNotification(payment);

            console.log('Payment completed:', payment.uniqueId);
        } else if (data.obj && data.obj.success === false) {
            // Payment failed
            const orderId = data.obj.order ? .id ? .toString();
            if (orderId) {
                await Payment.update({ paymentStatus: 'failed', paymobData: JSON.stringify(data) }, { where: { paymentId: orderId } });
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
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

        res.json({
            success: true,
            statistics: {
                approvedCount,
                totalMoney: parseFloat(totalMoney) % 1 === 0 ? parseInt(totalMoney) : parseFloat(totalMoney).toFixed(2),
                totalPayments,
                checkedInCount,
                pendingApproval: totalPayments - approvedCount
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

        // Otherwise, require admin authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

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
            valid: payment.approved, // Changed: Check if approved instead of completed
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
                approved: payment.approved, // Add approved field
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
    try {
        const { uniqueId } = req.params;

        const payment = await Payment.findOne({ where: { uniqueId } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Check if payment is approved (new requirement)
        if (!payment.approved) {
            return res.status(400).json({ success: false, message: 'Payment not approved yet' });
        }

        // Allow check-in for approved payments (even if status is pending)
        // Remove strict requirement for paymentStatus === 'completed'

        if (payment.checkedIn) {
            return res.status(400).json({ success: false, message: 'Already checked in' });
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
            where: {
                [Op.and]: [{
                        [Op.or]: [
                            { archived: false },
                            { archived: null }
                        ]
                    },
                    // Only show payments that have been completed or verified
                    {
                        [Op.or]: [
                            { paymentStatus: 'completed' },
                            { verified: true }
                        ]
                    }
                ]
            },
            order: [
                ['id', 'DESC'] // Newest payments first (descending ID)
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

// POST /payments/:id/archive - Archive a payment (admin only)
router.post('/payments/:id/archive', authenticateAdmin, async(req, res) => {
    try {
        const payment = await Payment.findByPk(req.params.id);

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

module.exports = router;