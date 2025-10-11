# Telegram Bot Setup Guide - Payment Notifications

## Overview
This system sends payment notifications to a Telegram chat/channel so you can monitor all payments in real-time.

---

## Step 1: Create Your Telegram Bot

### 1.1 Find BotFather
1. Open Telegram app (mobile or desktop)
2. Search for **@BotFather** (official Telegram bot)
3. Start a chat with BotFather

### 1.2 Create New Bot
1. Send command: `/newbot`
2. BotFather will ask for a name
   - Example: `Payment System Bot`
3. BotFather will ask for a username (must end with 'bot')
   - Example: `my_payment_system_bot`
4. **SAVE THE TOKEN** - You'll get something like:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   ⚠️ **Keep this secret!**

### 1.3 Copy Your Bot Token
- Copy the entire token
- You'll add it to `.env` file

---

## Step 2: Get Your Chat ID

You have **two options**: Personal Chat or Channel

### Option A: Personal Chat (Recommended for Testing)

#### 2.1 Start Chat with Your Bot
1. Search for your bot username in Telegram
   - Example: `@my_payment_system_bot`
2. Click **START** button
3. Send any message (like "Hello")

#### 2.2 Get Your Chat ID
Open this URL in browser (replace `YOUR_BOT_TOKEN`):
```
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

Example:
```
https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrsTUVwxyz/getUpdates
```

You'll see JSON response:
```json
{
  "ok": true,
  "result": [{
    "message": {
      "chat": {
        "id": 123456789,  ← THIS IS YOUR CHAT ID
        "first_name": "Your Name"
      }
    }
  }]
}
```

**Copy the `id` number** (like `123456789`)

---

### Option B: Telegram Channel (For Team Notifications)

#### 2.1 Create a Channel
1. In Telegram, click **Menu** → **New Channel**
2. Name your channel: `Payment Notifications`
3. Choose **Private** or **Public**
4. Skip subscribers (or add team members)
5. Create channel

#### 2.2 Add Bot as Administrator
1. Open your channel
2. Click channel name → **Administrators**
3. Click **Add Administrator**
4. Search for your bot username
5. Add bot and give **"Post Messages"** permission
6. Save

#### 2.3 Get Channel Chat ID
1. Post any message in the channel
2. Open this URL (replace `YOUR_BOT_TOKEN`):
```
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

3. Look for the channel in response:
```json
{
  "ok": true,
  "result": [{
    "channel_post": {
      "chat": {
        "id": -1001234567890,  ← THIS IS YOUR CHANNEL CHAT ID
        "title": "Payment Notifications"
      }
    }
  }]
}
```

**Copy the `id` number** (like `-1001234567890`)
⚠️ **Note**: Channel IDs start with `-100`

---

## Step 3: Configure Your .env File

Open your `.env` file and update these lines:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ORGANIZER_CHAT_ID=123456789
```

### Example (Personal Chat):
```env
TELEGRAM_BOT_TOKEN=5928374651:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
TELEGRAM_ORGANIZER_CHAT_ID=987654321
```

### Example (Channel):
```env
TELEGRAM_BOT_TOKEN=5928374651:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
TELEGRAM_ORGANIZER_CHAT_ID=-1001234567890
```

---

## Step 4: Test Your Setup

### 4.1 Restart Your Server
```powershell
npm start
```

### 4.2 Make a Test Payment
1. Go to http://localhost:5000/payment.html
2. Fill in the form
3. Complete a payment

### 4.3 Check Telegram
You should receive a message like:

```
🎉 New Payment Received!

💳 Payment ID: PAY-abc123
👤 Name: John Doe
📧 Email: john@example.com
📱 Phone: +20 123 456 7890
💰 Amount: 500 EGP
💳 Method: Mobile Wallet
📅 Time: 2025-10-11 14:30:25

Status: ✅ Confirmed
```

---

## Step 5: Advanced - Multiple Recipients

Want notifications to multiple people/channels?

### Option 1: Add Multiple Users to a Group
1. Create a Telegram Group
2. Add your bot to the group
3. Make bot an admin
4. Get group chat ID (same method as channel)
5. Use group chat ID in `.env`

### Option 2: Broadcast to Multiple IDs (Code Change Needed)
Edit `routes/payments.js` to send to multiple chat IDs:

```javascript
const chatIds = [
  process.env.TELEGRAM_ORGANIZER_CHAT_ID,
  '123456789',  // Add more chat IDs
  '-1001234567890'
];

for (const chatId of chatIds) {
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}
```

---

## Troubleshooting

### Problem: Bot not sending messages
**Solutions**:
1. Check bot token is correct in `.env`
2. Make sure you started chat with bot (sent first message)
3. For channels, ensure bot is admin with "Post Messages" permission
4. Restart server after changing `.env`

### Problem: "Chat not found" error
**Solutions**:
1. Verify chat ID is correct (including `-` for channels)
2. For personal chat: Send message to bot first
3. For channel: Make sure bot is added as admin

### Problem: Can't find chat ID
**Solution**:
Use this bot to get your chat ID:
1. Search for `@userinfobot` in Telegram
2. Start chat and it will show your chat ID

### Problem: Bot sends to wrong chat
**Solution**:
Double-check the chat ID in `.env` file matches the one from `getUpdates`

---

## Quick Test Commands

### Test Bot Connection (PowerShell):
```powershell
$token = "YOUR_BOT_TOKEN"
Invoke-RestMethod "https://api.telegram.org/bot$token/getMe"
```

### Test Send Message (PowerShell):
```powershell
$token = "YOUR_BOT_TOKEN"
$chatId = "YOUR_CHAT_ID"
$text = "Test message from payment system"
Invoke-RestMethod "https://api.telegram.org/bot$token/sendMessage?chat_id=$chatId&text=$text"
```

---

## What Gets Sent to Telegram?

Your system sends notifications for:

1. **✅ New Payment Received**
   - When user completes payment
   - Includes all payment details
   - Shows QR code link

2. **🔔 Check-in Notification**
   - When user checks in at event
   - Shows who checked in and when

3. **📊 Payment Status Updates**
   - If payment fails or is pending
   - Webhook confirmations

---

## Current Status Checklist

- [ ] Created Telegram bot via @BotFather
- [ ] Got bot token
- [ ] Started chat with bot (or added to channel)
- [ ] Got chat ID
- [ ] Updated `.env` file with token and chat ID
- [ ] Restarted server
- [ ] Tested with a payment
- [ ] Received notification in Telegram

---

## Need Help?

### Useful Telegram Bot Commands:
- `/start` - Start chat with bot
- `/help` - Get help (if you program it)
- `/getid` - Some bots show chat ID

### Telegram Bot API Documentation:
https://core.telegram.org/bots/api

### Get Updates URL Format:
```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

### Send Message URL Format:
```
https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=<MESSAGE>
```

---

**Once configured, you'll get instant notifications for every payment! 🚀**
