# Payment System with Paymob Integration

A complete web application for handling event payments in Egypt using **Paymob** payment gateway (Mobile Wallet & InstaPay). Features include admin dashboard, QR code generation, Telegram notifications, and check-in system.

## 🚀 Features

- **Payment Processing**: Paymob Intention API with iframe display
- **Payment Methods**: Mobile Wallet and InstaPay
- **QR Code Generation**: Secure QR codes with HMAC verification
- **Telegram Notifications**: Real-time payment alerts to organizer
- **Admin Dashboard**: Manage pricing, activate/deactivate payments, view all transactions
- **Check-In System**: QR scanner and manual ID verification for event entry
- **Security**: JWT authentication, HMAC verification, input sanitization

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Paymob account (sign up at https://accept.paymob.com/portal)
- Telegram Bot (create via @BotFather)

## 🛠️ Installation

### 1. Clone or Download the Project

```bash
cd Registration-sys
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE payment_system;
```

Or using command line:

```bash
createdb payment_system
```

### 4. Configure Environment Variables

Edit the `.env` file with your credentials:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5000

# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/payment_system

# Security Keys (Generate random strings)
HMAC_SECRET=your_random_secret_key_here
JWT_SECRET=your_jwt_secret_key_here

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_ORGANIZER_CHAT_ID=your_chat_id

# Paymob Configuration (Get from Paymob Dashboard)
PAYMOB_SECRET_KEY=your_paymob_secret_key
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_PUBLIC_KEY=your_paymob_public_key
PAYMOB_INTEGRATION_ID_WALLET=your_wallet_integration_id
PAYMOB_INTEGRATION_ID_INSTAPAY=your_instapay_integration_id
PAYMOB_IFRAME_ID=your_iframe_id
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_API_URL=https://accept.paymob.com
```

**Note:** Admin credentials are no longer needed in `.env` - you'll create admin accounts through the registration page.

## 🔧 Paymob Configuration

### Step 1: Sign Up and Get API Keys

1. Go to https://accept.paymob.com/portal
2. Sign up for an account (test mode is free)
3. Navigate to **Settings** → **Account Info**
4. Copy your:
   - API Key
   - Secret Key
   - Public Key
   - HMAC Secret

### Step 2: Create Integrations

1. Go to **Settings** → **Payment Integrations**
2. Create integrations for:
   - **Mobile Wallet** (copy the Integration ID)
   - **InstaPay** (copy the Integration ID)
3. Note both Integration IDs

### Step 3: Create iFrame

1. Go to **Settings** → **iFrame**
2. Create a new iFrame
3. Copy the iFrame ID
4. Configure the success/error URLs (optional for testing)

### Step 4: Configure Webhooks

1. Go to **Settings** → **Webhooks**
2. Add your webhook URL: `https://your-domain.com/api/paymob-webhook`
3. For local testing, use ngrok:
   ```bash
   ngrok http 5000
   ```
   Then use the ngrok URL: `https://your-ngrok-url.ngrok.io/api/paymob-webhook`

## 📱 Telegram Bot Setup

### Step 1: Create Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the **Bot Token**

### Step 2: Get Your Chat ID

1. Search for **@userinfobot** on Telegram
2. Start a chat and it will show your Chat ID
3. Or start a chat with your bot and use this command:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```

## ▶️ Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on http://localhost:5000

## 🌐 Application URLs

- **Admin Registration**: http://localhost:5000/register.html (Create your first admin account)
- **Admin Dashboard**: http://localhost:5000/admin.html (Login to manage settings)
- **Payment Page**: http://localhost:5000/payment.html (Public payment form)
- **Check-In System**: http://localhost:5000/checkin.html (Event check-in)

## 👨‍💼 Admin Usage

### 1. Register Your Admin Account

- Navigate to http://localhost:5000/register.html
- Fill in the registration form:
  - Username (minimum 3 characters)
  - Email address
  - Password (minimum 6 characters)
  - Confirm password
  - Full name
- Click "Create Admin Account"
- You'll be redirected to the login page

### 2. Login

- Navigate to http://localhost:5000/admin.html
- Enter your username and password
- Click "Login"

### 3. Configure Settings

- **Price**: Set the event ticket price in EGP
- **Status**: Activate or deactivate the payment system
- Click **Save Settings**

### 3. View Payments

- All payments are listed in a table
- View payment status, user details, and check-in status
- Export or print the list as needed

## 💳 User Payment Flow

1. User visits payment page
2. Fills in name, email, phone number
3. Selects payment method (Mobile Wallet or InstaPay)
4. Clicks "Proceed to Payment"
5. Paymob iframe opens with payment interface
6. User completes payment through Paymob
7. On success:
   - QR code is generated
   - Telegram notification sent to organizer
   - User receives QR code and Unique ID

## ✅ Check-In Process

### 1. Login to Check-In

- Navigate to http://localhost:5000/checkin.html
- Login with admin credentials

### 2. Verify Attendees

**Option A: QR Scanner**
- Click "Start Scanner"
- Allow camera access
- Point camera at attendee's QR code
- System automatically verifies and displays user info
- Click "Check In" to mark attendance

**Option B: Manual Entry**
- Enter the 8-character Unique ID
- Click "Verify"
- View user details
- Click "Check In" to mark attendance

## 🧪 Testing

### Test Payment Flow

1. Set up test mode in Paymob dashboard
2. Use Paymob test cards: https://docs.paymob.com/docs/test-card
3. Test credentials (Mobile Wallet):
   - Phone: `01010101010`
   - PIN: `123456`

### Test Webhook Locally

Use ngrok to expose local server:

```bash
ngrok http 5000
```

Update Paymob webhook URL with ngrok URL.

## 📁 Project Structure

```
Registration-sys/
├── app.js                 # Main Express application
├── package.json           # Dependencies
├── .env                   # Environment variables
├── config/
│   └── database.js        # Database configuration
├── models/
│   ├── Settings.js        # Settings model
│   ├── Wallet.js          # Wallet model
│   └── Payment.js         # Payment model
├── routes/
│   └── payments.js        # Payment routes & Paymob integration
└── public/
    ├── payment.html       # User payment page
    ├── admin.html         # Admin dashboard
    ├── checkin.html       # Check-in interface
    ├── css/
    │   └── style.css      # Shared styles
    └── js/
        ├── payment.js     # Payment page logic
        ├── admin.js       # Admin dashboard logic
        └── checkin.js     # Check-in logic
```

## 🔒 Security Features

- **JWT Authentication**: Secure admin access
- **HMAC Verification**: QR code and webhook security
- **Input Sanitization**: XSS prevention
- **Password Hashing**: bcrypt for password storage
- **CORS Protection**: Configured for production
- **Rate Limiting**: Recommended for production (add middleware)

## 🚀 Production Deployment

### 1. Environment Setup

- Set `NODE_ENV=production`
- Use HTTPS for all endpoints
- Configure proper database connection string
- Use strong secrets and passwords

### 2. Security Hardening

```bash
npm install express-rate-limit helmet
```

Add to `app.js`:

```javascript
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 3. Database

- Use connection pooling
- Regular backups
- Proper indexes on frequently queried fields

### 4. Monitoring

- Set up logging (winston, morgan)
- Monitor webhook failures
- Track payment completion rates
- Monitor Telegram notification delivery

## 📝 API Endpoints

### Public Endpoints

- `GET /api/settings/public` - Check if payment system is active
- `POST /api/payments` - Create new payment
- `POST /api/paymob-webhook` - Paymob webhook handler

### Admin Endpoints (Require JWT)

- `POST /api/admin/login` - Admin login
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings
- `GET /api/payments` - List all payments
- `GET /api/payments/:uniqueId` - Get payment details
- `POST /api/payments/:uniqueId/checkin` - Mark as checked in

## 🐛 Troubleshooting

### Database Connection Error

- Check PostgreSQL is running
- Verify database credentials in `.env`
- Ensure database exists

### Paymob Integration Issues

- Verify all Paymob credentials are correct
- Check integration IDs match payment methods
- Ensure webhook URL is accessible (use ngrok for local testing)
- Check HMAC secret matches Paymob dashboard

### Telegram Notifications Not Working

- Verify bot token is correct
- Ensure chat ID is accurate
- Start a conversation with your bot first
- Check bot has necessary permissions

### QR Scanner Not Working

- Ensure HTTPS is used (required for camera access)
- Check camera permissions in browser
- Test on mobile device for better camera quality

## 📚 Resources

- **Paymob Documentation**: https://docs.paymob.com/
- **Paymob Accept API**: https://docs.paymob.com/docs/accept-payment-api
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Sequelize ORM**: https://sequelize.org/
- **jsQR Library**: https://github.com/cozmo/jsQR

## 📄 License

ISC

## 👥 Support

For issues with:
- **Paymob Integration**: Contact Paymob support
- **This Application**: Open an issue or contact the developer

## 🎯 Future Enhancements

- Email notifications to users
- Export payments to CSV/Excel
- Multi-event support
- Refund processing
- Analytics dashboard
- Mobile app for check-in
- Bulk import attendees

---

**Note**: Always test thoroughly in Paymob's test mode before going live with real payments!
