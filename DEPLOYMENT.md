# Payment Registration System - Deployment Guide

## 🚀 Production Deployment on Vercel

### Prerequisites
1. GitHub account
2. Vercel account (sign up at vercel.com)
3. PostgreSQL database (hosted)
4. Paymob account with API credentials
5. Telegram Bot

---

## 📋 Environment Variables

You need to set these environment variables in Vercel:

### Database
```
DATABASE_URL=postgresql://username:password@host:port/database_name
```

### Paymob Settings
```
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID_WALLET=your_wallet_integration_id
PAYMOB_INTEGRATION_ID_CARD=your_card_integration_id
PAYMOB_IFRAME_ID_WALLET=your_wallet_iframe_id
PAYMOB_IFRAME_ID_CARD=your_card_iframe_id
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_PUBLIC_KEY=your_public_key
PAYMOB_SECRET_KEY=your_secret_key
PAYMOB_API_URL=https://accept.paymob.com
```

### Telegram Bot
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_channel_or_group_id
```

### Admin Credentials
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
ADMIN_EMAIL=admin@example.com
```

### Server Settings
```
PORT=5000
NODE_ENV=production
SESSION_SECRET=your_random_secret_key_for_sessions
JWT_SECRET=your_jwt_secret_key
```

### Webhook URL (Set after deploying to Vercel)
```
WEBHOOK_URL=https://your-app.vercel.app/api/paymob-webhook
```

---

## 🔧 Deployment Steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Payment System"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### 2. Deploy to Vercel

#### Option A: Via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Import your GitHub repository
4. Add all environment variables from the list above
5. Click "Deploy"

#### Option B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
# Follow the prompts and add environment variables
```

### 3. Configure Paymob Webhook

After deployment, you'll get a URL like: `https://your-app.vercel.app`

1. Go to Paymob Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/paymob-webhook`
3. Enable webhook for transaction events
4. Update `WEBHOOK_URL` environment variable in Vercel with this URL

### 4. Configure Telegram Bot

Update your bot commands:
```
/start - Get started with the bot
/help - Show help information
/checkin - Check in a user with Payment ID
```

---

## 🗄️ Database Setup

### PostgreSQL (Recommended: Neon, Supabase, or Railway)

1. Create a PostgreSQL database
2. Get the connection string (DATABASE_URL)
3. The app will automatically create tables on first run

Example connection string:
```
postgresql://user:password@host.region.neon.tech/database?sslmode=require
```

---

## 📱 Pages After Deployment

- **Payment Page**: `https://your-app.vercel.app/payment.html`
- **Admin Dashboard**: `https://your-app.vercel.app/admin.html`
- **Check-in Page**: `https://your-app.vercel.app/checkin.html`

---

## 🔒 Security Notes

1. **Never commit .env file** to GitHub
2. **Use strong passwords** for admin accounts
3. **Keep your API keys secret**
4. **Enable HTTPS** (automatic on Vercel)
5. **Update SESSION_SECRET and JWT_SECRET** with random strings

Generate random secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🧪 Testing in Production

1. Make a test payment
2. Check Telegram notification arrives
3. Verify payment appears in admin dashboard
4. Test approval workflow
5. Test check-in with QR code

---

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure DATABASE_URL is correct
- Check if database allows external connections
- Verify SSL mode is enabled

### Paymob Webhook Not Working
- Check webhook URL in Paymob dashboard
- Verify HMAC secret is correct
- Check Vercel logs for webhook errors

### Telegram Notifications Not Sending
- Verify bot token is correct
- Check chat ID is correct (use negative number for groups)
- Ensure bot is admin in the channel/group

---

## 📊 Monitoring

View logs in Vercel:
1. Go to your project dashboard
2. Click "Deployments"
3. Click on the active deployment
4. View "Functions" logs

---

## 🔄 Updates

To update your deployed app:
```bash
git add .
git commit -m "Your update message"
git push
```

Vercel will automatically redeploy!

---

## 📞 Support

For issues:
1. Check Vercel deployment logs
2. Check browser console for frontend errors
3. Verify all environment variables are set
4. Test Paymob webhook manually

---

## 🎉 Features

✅ Paymob payment integration (Wallet & Card)
✅ Admin dashboard with approval system
✅ Telegram bot notifications
✅ QR code generation for check-ins
✅ Payment statistics
✅ User management
✅ Archive system
✅ Real-time updates

---

**Note**: Remember to configure your Paymob webhook URL after deployment for the notification system to work properly!
