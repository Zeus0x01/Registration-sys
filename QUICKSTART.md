# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```powershell
npm install
```

### Step 2: Setup PostgreSQL Database

```powershell
# Create database (if not exists)
createdb payment_system
```

Or using SQL:
```sql
CREATE DATABASE payment_system;
```

### Step 3: Configure .env File

Open `.env` and update these essential values:

```env
# Database - Update with your PostgreSQL password
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/payment_system

# Paymob - Get from https://accept.paymob.com/portal
PAYMOB_API_KEY=your_key_here
PAYMOB_SECRET_KEY=your_secret_here
PAYMOB_PUBLIC_KEY=your_public_key_here
PAYMOB_INTEGRATION_ID_WALLET=your_wallet_id
PAYMOB_INTEGRATION_ID_INSTAPAY=your_instapay_id
PAYMOB_IFRAME_ID=your_iframe_id
PAYMOB_HMAC_SECRET=your_hmac_secret

# Telegram - Get from @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ORGANIZER_CHAT_ID=your_chat_id
```

### Step 4: Start the Server

```powershell
npm run dev
```

### Step 5: Register Your Admin Account

1. Open your browser and go to: http://localhost:5000/register.html
2. Fill in the registration form:
   - Choose a username (min 3 characters)
   - Enter your email
   - Create a password (min 6 characters)
   - Confirm password
   - Enter your full name
3. Click "Create Admin Account"
4. You'll be redirected to the login page

### Step 6: Access the Application

- **Admin Registration**: http://localhost:5000/register.html (First time setup)
- **Admin Dashboard**: http://localhost:5000/admin.html (Login & manage)
- **Payment Page**: http://localhost:5000/payment.html (Public payments)
- **Check-In**: http://localhost:5000/checkin.html (Event check-in)

## 📋 First Time Setup Checklist

- [ ] Install Node.js and PostgreSQL
- [ ] Run `npm install`
- [ ] Create database
- [ ] Configure `.env` file with database and Paymob credentials
- [ ] Start server with `npm run dev`
- [ ] Register your admin account at `/register.html`
- [ ] Login to admin dashboard
- [ ] Set event price and activate system
- [ ] Test payment flow

## 🧪 Testing Locally

### Test with ngrok (for Paymob webhooks)

```powershell
# Install ngrok: https://ngrok.com/download

# Run ngrok
ngrok http 5000
```

Copy the ngrok URL and configure it in Paymob dashboard webhook settings:
```
https://your-ngrok-url.ngrok.io/api/paymob-webhook
```

### Test Payment

1. Go to admin dashboard and set a test price (e.g., 10 EGP)
2. Activate the system
3. Visit payment page
4. Fill in test details
5. Use Paymob test credentials
6. Complete payment
7. Check Telegram for notification
8. View payment in admin dashboard

## ⚠️ Important Notes

- **First admin**: Register at `/register.html` before using the dashboard
- **Multiple admins**: You can register multiple admin accounts
- **Test mode**: Use Paymob test credentials first
- **Webhook**: Requires public URL (use ngrok for local testing)
- **Camera access**: HTTPS required for QR scanner (use ngrok or deploy)

## 🆘 Common Issues

### Database Connection Failed
```powershell
# Check PostgreSQL is running
pg_isready
```

### Port Already in Use
Change `PORT=5000` to another port in `.env` (e.g., `PORT=3000`)

### Cannot Access Camera
- Use HTTPS (ngrok provides HTTPS)
- Grant browser camera permissions
- Test on mobile device

## 📚 Next Steps

1. ✅ Complete setup above
2. 📖 Read full documentation in `README.md`
3. 🧪 Test all features thoroughly
4. 🔧 Customize as needed
5. 🚀 Deploy to production

## 🎯 Ready to Deploy?

See `README.md` for production deployment guidelines!
