const TelegramBot = require('node-telegram-bot-api');
const Payment = require('./models/Payment');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Generate HMAC for QR code
function generateHMAC(data) {
    return crypto
        .createHmac('sha256', process.env.HMAC_SECRET)
        .update(data)
        .digest('hex');
}

// Initialize Telegram Bot
const bot = process.env.TELEGRAM_BOT_TOKEN ?
    new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true }) : null;

// Send Telegram notification (only for pending approval)
async function sendTelegramNotification(payment) {
    if (!bot || !process.env.TELEGRAM_ORGANIZER_CHAT_ID) {
        console.warn('Telegram bot not configured, skipping notification');
        return;
    }

    // Only send to Telegram if payment needs approval
    if (payment.approved) {
        console.log('Payment already approved, skipping Telegram notification');
        return;
    }

    try {
        const message = `
🔔 *New Payment - Approval Required*

🆔 *Payment ID:* \`${payment.uniqueId}\`
👤 *Name:* ${payment.userName}
📧 *Email:* ${payment.userEmail}
📱 *Phone:* ${payment.userPhone}
    💰 *Amount:* ${Math.round(payment.amount)} EGP
💳 *Method:* ${payment.paymentMethod === 'paymob-wallet' ? '📱 Mobile Wallet' : '💳 Card/Debit'}
📅 *Date:* ${new Date(payment.createdAt).toLocaleString()}

⏳ *Status:* Pending Approval
        `.trim();

        // Add inline keyboard for approval
        const keyboard = {
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
    } catch (error) {
        console.error('Telegram notification error:', error.message);
    }
}

// Setup Bot Commands
if (bot) {
    // /start command
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const welcomeMessage = `
👋 *Welcome to Event Payment Bot!*

Available commands:
/checkin - Check in a participant by scanning QR or entering ID
/help - Show this help message
        `.trim();

        bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // /help command
    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        const helpMessage = `
📖 *Available Commands:*

/checkin - Check in a participant
/start - Show welcome message
/help - Show this help message

*How to use /checkin:*
1. Type /checkin
2. Enter the unique payment ID (e.g., ABC12345)
3. System will verify and check in the participant
        `.trim();

        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // /checkin command
    bot.onText(/\/checkin/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '🎫 Please enter the unique payment ID (e.g., ABC12345):');

        // Listen for the next message from this user
        const listener = bot.onText(/.*/, async(response) => {
            if (response.chat.id !== chatId || response.text.startsWith('/')) {
                return;
            }

            // Remove this listener to prevent duplicate responses
            bot.removeTextListener(listener);

            const uniqueId = response.text.trim().toUpperCase();

            try {
                // Find payment by unique ID
                const payment = await Payment.findOne({ where: { uniqueId } });

                if (!payment) {
                    bot.sendMessage(chatId, '❌ Payment not found. Please check the ID and try again.');
                    return;
                }

                // Check if payment is approved
                if (!payment.approved) {
                    bot.sendMessage(chatId, '⚠️ Payment not yet approved. Please approve first.');
                    return;
                }

                // Check if already checked in
                if (payment.checkedIn) {
                    const checkInInfo = `
✅ *Already Checked In*

🆔 *ID:* \`${payment.uniqueId}\`
👤 *Name:* ${payment.userName}
📅 *Checked In At:* ${new Date(payment.checkedInAt).toLocaleString()}
                    `.trim();
                    bot.sendMessage(chatId, checkInInfo, { parse_mode: 'Markdown' });
                    return;
                }

                // Perform check-in
                payment.checkedIn = true;
                payment.checkedInAt = new Date();
                payment.checkedInBy = 'Telegram Bot';
                await payment.save();

                const successMessage = `
✅ *Check-In Successful!*

🆔 *ID:* \`${payment.uniqueId}\`
👤 *Name:* ${payment.userName}
📧 *Email:* ${payment.userEmail}
📱 *Phone:* ${payment.userPhone}
💰 *Amount:* ${payment.amount} EGP
📅 *Checked In At:* ${new Date().toLocaleString()}
                `.trim();

                bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });

            } catch (error) {
                console.error('Check-in error:', error);
                bot.sendMessage(chatId, '❌ Error during check-in. Please try again.');
            }
        });
    });

    // Handle callback queries (inline button presses)
    bot.on('callback_query', async(callbackQuery) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        try {
            if (data.startsWith('approve_')) {
                const paymentId = data.split('_')[1];
                const payment = await Payment.findByPk(paymentId);

                if (!payment) {
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '❌ Payment not found',
                        show_alert: true
                    });
                    return;
                }

                if (payment.approved) {
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '✅ Payment already approved',
                        show_alert: true
                    });
                    return;
                }

                // Approve payment AND mark as completed
                payment.approved = true;
                payment.approvedAt = new Date();
                payment.approvedBy = 'Telegram';
                payment.paymentStatus = 'completed';
                payment.verified = true;
                payment.verifiedAt = new Date();

                // Generate QR code if not already generated
                if (!payment.qrCodeImage) {
                    const qrPayload = `${payment.uniqueId}:${generateHMAC(payment.uniqueId)}`;
                    payment.qrCodeData = qrPayload;

                    // Generate QR code image (base64)
                    const qrCodeImage = await QRCode.toDataURL(qrPayload);
                    payment.qrCodeImage = qrCodeImage;
                }

                await payment.save();

                // Update message
                const updatedMessage = `
${callbackQuery.message.text}

✅ *APPROVED via Telegram*
📅 *Approved At:* ${new Date().toLocaleString()}
✅ *Status:* Completed
🎫 *QR Code:* Generated
                `.trim();

                await bot.editMessageText(updatedMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });

                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '✅ Payment approved successfully!',
                    show_alert: false
                });
            }
        } catch (error) {
            console.error('Telegram callback error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ Error processing approval',
                show_alert: true
            });
        }
    });

    console.log('✅ Telegram bot initialized with commands');
}

module.exports = { bot, sendTelegramNotification };