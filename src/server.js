require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

const app = express();

// ========== FIX FOR RENDER PROXY ==========
app.set('trust proxy', 1);

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, trustProxy: true });
app.use('/api/', limiter);

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'prime_heritage_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ========== MONGODB ==========
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// ========== BREVO EMAIL CONFIGURATION ==========
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'ad3d98001@smtp-brevo.com',
        pass: process.env.EMAIL_PASS || 'bskq8uTe5pfqQdj'
    },
    tls: { rejectUnauthorized: false }
});

transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email error:', error.message);
    } else {
        console.log('✅ Brevo SMTP ready!');
    }
});

// ========== PROFESSIONAL EMAIL TEMPLATES ==========

const getVerificationEmail = (name, code) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email | Prime Heritage Bank</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0A0E1A 0%, #0F1622 100%);
            margin: 0;
            padding: 40px 20px;
        }
        .email-container {
            max-width: 560px;
            margin: 0 auto;
            background: #111827;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            border: 1px solid rgba(198, 164, 63, 0.2);
        }
        .email-header {
            background: linear-gradient(135deg, #C6A43F 0%, #9E8032 100%);
            padding: 35px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .email-header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
            animation: shine 3s infinite;
        }
        @keyframes shine {
            0% { transform: translateX(-100%) translateY(-100%); }
            100% { transform: translateX(100%) translateY(100%); }
        }
        .email-header h1 {
            color: #0A0E1A;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin: 0;
        }
        .email-header p {
            color: rgba(10,14,26,0.8);
            font-size: 13px;
            margin-top: 8px;
        }
        .email-content {
            padding: 40px 35px;
        }
        .greeting {
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #C6A43F, #E8D5A4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .message {
            color: #9CA3AF;
            line-height: 1.6;
            margin-bottom: 25px;
        }
        .code-box {
            background: linear-gradient(135deg, #0F1622, #0A0E1A);
            border: 2px solid #C6A43F;
            border-radius: 20px;
            padding: 28px;
            text-align: center;
            margin: 30px 0;
            position: relative;
        }
        .code-box::after {
            content: '🔐';
            position: absolute;
            top: -15px;
            right: 20px;
            background: #111827;
            padding: 0 10px;
            font-size: 20px;
        }
        .code {
            font-size: 48px;
            font-weight: 800;
            color: #C6A43F;
            letter-spacing: 12px;
            font-family: 'Courier New', monospace;
        }
        .expiry {
            color: #6B7280;
            font-size: 12px;
            margin-top: 15px;
        }
        .security-note {
            background: rgba(16, 185, 129, 0.1);
            border-left: 3px solid #10B981;
            padding: 15px;
            border-radius: 12px;
            margin: 20px 0;
            font-size: 13px;
            color: #10B981;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #C6A43F, #9E8032);
            color: #0A0E1A;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.3s;
        }
        .footer {
            background: #0A0E1A;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #1F2937;
        }
        .footer p {
            color: #6B7280;
            font-size: 12px;
            margin: 5px 0;
        }
        .social-icons {
            margin-top: 15px;
        }
        .social-icons a {
            color: #6B7280;
            margin: 0 8px;
            text-decoration: none;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🏦 PRIME HERITAGE BANK</h1>
            <p>Global Excellence Since 2026</p>
        </div>
        <div class="email-content">
            <div class="greeting">Welcome, ${name}! 👋</div>
            <div class="message">
                Thank you for choosing <strong>Prime Heritage Bank</strong>. To complete your registration and secure your account, please verify your email address using the code below.
            </div>
            <div class="code-box">
                <div class="code">${code}</div>
                <div class="expiry">⏰ This verification code expires in <strong>10 minutes</strong></div>
            </div>
            <div class="security-note">
                🔒 <strong>Security Tip:</strong> Never share this code with anyone. Prime Heritage Bank will never ask for your verification code.
            </div>
            <div class="message">
                If you didn't create an account with Prime Heritage Bank, please ignore this email or contact our support team immediately.
            </div>
            <div style="text-align: center;">
                <a href="#" class="button">Secure Dashboard →</a>
            </div>
        </div>
        <div class="footer">
            <p>© 2026 Prime Heritage Bank - International Division</p>
            <p>This is an automated message, please do not reply</p>
            <div class="social-icons">
                <a href="#"><i class="fab fa-facebook"></i></a>
                <a href="#"><i class="fab fa-twitter"></i></a>
                <a href="#"><i class="fab fa-linkedin"></i></a>
                <a href="#"><i class="fab fa-instagram"></i></a>
            </div>
            <p style="margin-top: 15px;">Need help? <a href="#" style="color: #C6A43F;">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
`;

const getWelcomeEmail = (name, accountNumber, iban, swiftCode, currency) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Prime Heritage Bank</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0A0E1A 0%, #0F1622 100%);
            margin: 0;
            padding: 40px 20px;
        }
        .email-container {
            max-width: 560px;
            margin: 0 auto;
            background: #111827;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            border: 1px solid rgba(198, 164, 63, 0.2);
        }
        .header {
            background: linear-gradient(135deg, #C6A43F 0%, #9E8032 100%);
            padding: 35px 30px;
            text-align: center;
        }
        .header h1 { color: #0A0E1A; font-size: 28px; font-weight: 800; }
        .content { padding: 40px 35px; }
        .welcome { font-size: 28px; font-weight: 800; margin-bottom: 20px; color: #C6A43F; }
        .message { color: #9CA3AF; line-height: 1.6; margin-bottom: 25px; }
        .info-card {
            background: linear-gradient(135deg, #0F1622, #0A0E1A);
            border-radius: 20px;
            padding: 25px;
            margin: 25px 0;
            border: 1px solid rgba(198, 164, 63, 0.2);
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #1F2937;
        }
        .info-label { color: #C6A43F; font-weight: 600; font-size: 12px; text-transform: uppercase; }
        .info-value { font-weight: 600; font-size: 14px; color: #FFFFFF; word-break: break-all; text-align: right; }
        .features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 25px 0;
        }
        .feature {
            background: #0F1622;
            padding: 15px;
            border-radius: 16px;
            text-align: center;
            border: 1px solid #1F2937;
        }
        .feature-icon { font-size: 28px; display: block; margin-bottom: 8px; }
        .feature-text { font-size: 12px; color: #9CA3AF; }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #C6A43F, #9E8032);
            color: #0A0E1A;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            margin-top: 20px;
        }
        .footer {
            background: #0A0E1A;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #1F2937;
        }
        .footer p { color: #6B7280; font-size: 12px; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🏦 PRIME HERITAGE BANK</h1>
        </div>
        <div class="content">
            <div class="welcome">Welcome, ${name}! 🎉</div>
            <div class="message">
                Your account has been successfully verified and activated. You now have access to premium international banking services.
            </div>
            <div class="info-card">
                <div class="info-row">
                    <span class="info-label">Account Number</span>
                    <span class="info-value">${accountNumber}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">IBAN</span>
                    <span class="info-value">${iban}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">SWIFT/BIC</span>
                    <span class="info-value">${swiftCode}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Primary Currency</span>
                    <span class="info-value">${currency}</span>
                </div>
            </div>
            <div class="features">
                <div class="feature"><span class="feature-icon">💳</span><div class="feature-text">Virtual Cards</div></div>
                <div class="feature"><span class="feature-icon">🌍</span><div class="feature-text">Global Transfers</div></div>
                <div class="feature"><span class="feature-icon">📱</span><div class="feature-text">Mobile Banking</div></div>
                <div class="feature"><span class="feature-icon">🔒</span><div class="feature-text">Bank Security</div></div>
            </div>
            <div style="text-align: center;">
                <a href="#" class="button">Access Dashboard →</a>
            </div>
        </div>
        <div class="footer">
            <p>© 2026 Prime Heritage Bank - International Division</p>
            <p>24/7 Support: support@primeheritage.com</p>
        </div>
    </div>
</body>
</html>
`;

const getPasswordResetEmail = (name, code) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Password Reset | Prime Heritage Bank</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0A0E1A 0%, #0F1622 100%);
            margin: 0;
            padding: 40px 20px;
        }
        .email-container {
            max-width: 560px;
            margin: 0 auto;
            background: #111827;
            border-radius: 28px;
            overflow: hidden;
            border: 1px solid rgba(198, 164, 63, 0.2);
        }
        .header {
            background: linear-gradient(135deg, #C6A43F 0%, #9E8032 100%);
            padding: 35px 30px;
            text-align: center;
        }
        .header h1 { color: #0A0E1A; font-size: 28px; }
        .content { padding: 40px 35px; }
        .code-box {
            background: #0F1622;
            border: 2px solid #C6A43F;
            border-radius: 20px;
            padding: 28px;
            text-align: center;
            margin: 30px 0;
        }
        .code { font-size: 48px; font-weight: 800; color: #C6A43F; letter-spacing: 12px; font-family: monospace; }
        .warning {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #EF4444;
            border-radius: 12px;
            padding: 15px;
            margin: 20px 0;
            color: #EF4444;
            font-size: 13px;
        }
        .footer {
            background: #0A0E1A;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #1F2937;
        }
        .footer p { color: #6B7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
            <h2 style="color: #C6A43F; margin-bottom: 20px;">Hello ${name},</h2>
            <p style="color: #9CA3AF;">We received a request to reset your password. Use the verification code below:</p>
            <div class="code-box">
                <div class="code">${code}</div>
            </div>
            <div class="warning">
                ⚠️ This code expires in 10 minutes. Never share this code with anyone.
            </div>
            <p style="color: #9CA3AF;">If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>Prime Heritage Bank - Security Department</p>
        </div>
    </div>
</body>
</html>
`;

// ========== SEND EMAIL FUNCTION ==========
async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"Prime Heritage Bank" <${process.env.EMAIL_USER || 'ad3d98001@smtp-brevo.com'}>`,
            to: to,
            subject: subject,
            html: html
        });
        console.log('✅ Email sent to:', to);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return false;
    }
}

// ========== DATABASE SCHEMAS ==========
const UserSchema = new mongoose.Schema({
    fullName: String, firstName: String, lastName: String,
    email: { type: String, unique: true }, phone: String,
    password: String, transactionPin: String,
    currency: { type: String, enum: ['USD', 'EUR', 'GBP'] },
    accountNumber: { type: String, unique: true },
    iban: { type: String, unique: true },
    swiftCode: String,
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now }
});

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    currency: String, accountNumber: String, iban: String,
    balance: { type: Number, default: 0 }
});

const TransactionSchema = new mongoose.Schema({
    fromUserId: mongoose.Schema.Types.ObjectId,
    fromAccountNumber: String, fromName: String,
    toUserId: mongoose.Schema.Types.ObjectId,
    toAccountNumber: String, toName: String,
    amount: Number, currency: String,
    type: { type: String, default: 'transfer' },
    status: { type: String, default: 'completed' },
    reference: { type: String, unique: true },
    note: String,
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cardNumber: String, last4: String,
    expiryMonth: Number, expiryYear: Number,
    cvv: String, status: { type: String, default: 'active' }
});

const LoanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number, purpose: String,
    interestRate: Number, tenureMonths: Number,
    monthlyPayment: Number, totalPayable: Number,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const BBCSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    step: { type: Number, default: 1 },
    isUsed: { type: Boolean, default: false },
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
});

const VerificationCodeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: String,
    code: { type: String, required: true },
    type: { type: String, enum: ['verification', 'password_reset'], default: 'verification' },
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false }
});

const SupportMessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String, email: String, subject: String, message: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const Loan = mongoose.model('Loan', LoanSchema);
const BBC = mongoose.model('BBC', BBCSchema);
const VerificationCode = mongoose.model('VerificationCode', VerificationCodeSchema);
const SupportMessage = mongoose.model('SupportMessage', SupportMessageSchema);

// ========== HELPER FUNCTIONS ==========
function generateAccountNumber(currency) {
    const prefix = currency === 'USD' ? 'PHB-USA' : currency === 'EUR' ? 'PHB-EU' : 'PHB-UK';
    return `${prefix}-${Math.floor(Math.random()*9000+1000)}-${Math.floor(Math.random()*9000+1000)}-${Math.floor(Math.random()*9000+1000)}`;
}

function generateIBAN(currency, accountNumber) {
    const country = currency === 'USD' ? 'US' : currency === 'EUR' ? 'DE' : 'GB';
    const clean = accountNumber.replace(/[^0-9]/g, '');
    return `${country}${Math.floor(Math.random()*90+10)}${clean}`;
}

function generateSWIFTCode(currency) {
    const country = currency === 'USD' ? 'US' : currency === 'EUR' ? 'DE' : 'GB';
    return `PHBG${country}33${Math.random().toString(36).substring(2,5).toUpperCase()}`;
}

function generateCardNumber() {
    let num = '4532';
    for (let i = 0; i < 12; i++) num += Math.floor(Math.random() * 10);
    return num;
}

function generateReference() {
    return 'PHB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hasBBCodes(userId, step) {
    const count = await BBC.countDocuments({ userId, step, isUsed: false, expiresAt: { $gt: new Date() } });
    return count > 0;
}

async function useBBCode(userId, code, requiredStep) {
    const bbc = await BBC.findOne({ code, userId, step: requiredStep, isUsed: false, expiresAt: { $gt: new Date() } });
    if (!bbc) return null;
    bbc.isUsed = true;
    await bbc.save();
    return bbc;
}

// ========== AUTH ROUTES ==========

// REGISTER
app.post('/api/register', async (req, res) => {
    console.log('📝 Registration:', req.body.email);
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = await bcrypt.hash(transactionPin, 10);
        const accountNumber = generateAccountNumber(currency);
        const iban = generateIBAN(currency, accountNumber);
        const swiftCode = generateSWIFTCode(currency);

        const user = new User({
            fullName: `${firstName} ${lastName}`, firstName, lastName, email, phone,
            password: hashedPassword, transactionPin: hashedPin,
            currency, accountNumber, iban, swiftCode,
            isEmailVerified: false
        });
        await user.save();

        const account = new Account({ userId: user._id, currency, accountNumber, iban, balance: 0 });
        await account.save();

        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id, cardNumber: cardNum, last4: cardNum.slice(-4),
            expiryMonth: 12, expiryYear: 2030, cvv: Math.floor(100 + Math.random() * 900).toString()
        });
        await card.save();

        const verificationCode = generateVerificationCode();
        await new VerificationCode({
            userId: user._id, email, code: verificationCode, type: 'verification',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }).save();

        await sendEmail(email, 'Verify Your Email - Prime Heritage Bank', getVerificationEmail(`${firstName} ${lastName}`, verificationCode));

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true, token, requiresVerification: true,
            message: 'Verification code sent to your email',
            user: { id: user._id, fullName: user.fullName, email, accountNumber, iban, swiftCode, currency, isAdmin: false, isEmailVerified: false }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// VERIFY EMAIL
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        const verification = await VerificationCode.findOne({ email, code, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!verification) return res.status(400).json({ error: 'Invalid or expired verification code' });
        
        verification.isUsed = true;
        await verification.save();
        
        const user = await User.findById(verification.userId);
        user.isEmailVerified = true;
        await user.save();

        await sendEmail(email, 'Welcome to Prime Heritage Bank! 🎉', getWelcomeEmail(user.fullName, user.accountNumber, user.iban, user.swiftCode, user.currency));

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true, token,
            message: 'Email verified successfully!',
            user: { id: user._id, fullName: user.fullName, email, accountNumber: user.accountNumber, iban: user.iban, swiftCode: user.swiftCode, currency: user.currency, isAdmin: user.isAdmin, isEmailVerified: true }
        });
    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// RESEND VERIFICATION
app.post('/api/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isEmailVerified) return res.status(400).json({ error: 'Email already verified' });
        
        await VerificationCode.updateMany({ email, type: 'verification', isUsed: false }, { isUsed: true });
        
        const verificationCode = generateVerificationCode();
        await new VerificationCode({
            userId: user._id, email, code: verificationCode, type: 'verification',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }).save();

        await sendEmail(email, 'Verify Your Email - Prime Heritage Bank', getVerificationEmail(user.fullName, verificationCode));
        
        res.json({ success: true, message: 'New verification code sent' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resend' });
    }
});

// FORGOT PASSWORD
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'Email not found' });
        
        await VerificationCode.updateMany({ email, type: 'password_reset', isUsed: false }, { isUsed: true });
        
        const resetCode = generateVerificationCode();
        await new VerificationCode({
            userId: user._id, email, code: resetCode, type: 'password_reset',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }).save();

        await sendEmail(email, 'Password Reset - Prime Heritage Bank', getPasswordResetEmail(user.fullName, resetCode));
        
        res.json({ success: true, message: 'Reset code sent to your email' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send reset code' });
    }
});

// RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        
        const verification = await VerificationCode.findOne({ email, code, type: 'password_reset', isUsed: false, expiresAt: { $gt: new Date() } });
        if (!verification) return res.status(400).json({ error: 'Invalid or expired reset code' });
        
        verification.isUsed = true;
        await verification.save();
        
        const user = await User.findById(verification.userId);
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { accountNumber: identifier }, { iban: identifier }] });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        
        if (!user.isEmailVerified && !user.isAdmin) {
            return res.status(403).json({ error: 'Email not verified', requiresVerification: true, email: user.email });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email: user.email, accountNumber: user.accountNumber, iban: user.iban, swiftCode: user.swiftCode, currency: user.currency, isAdmin: user.isAdmin, isEmailVerified: user.isEmailVerified } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET CURRENT USER
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const accounts = await Account.find({ userId: user._id });
        const cards = await Card.find({ userId: user._id });
        const transactions = await Transaction.find({ $or: [{ fromUserId: user._id }, { toUserId: user._id }] }).sort({ createdAt: -1 }).limit(30);
        const loans = await Loan.find({ userId: user._id });
        const tickets = await SupportMessage.find({ userId: user._id });
        const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        const hasBbc2 = await hasBBCodes(user._id, 2);
        const hasBbc3 = await hasBBCodes(user._id, 3);
        
        res.json({ user, accounts, cards, transactions, loans, tickets, totalBalance, bbcStatus: { step1: hasBbc1, step2: hasBbc2, step3: hasBbc3 } });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// ========== SEND MONEY ROUTES ==========
app.post('/api/send/step1', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { toAccountNumber, amount, note, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
        
        const recipient = await User.findOne({ $or: [{ accountNumber: toAccountNumber }, { iban: toAccountNumber }] });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        if (!hasBbc1) return res.status(403).json({ error: 'No BBC Code 1 available' });
        
        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, fromAccountNumber: userAccount.accountNumber, fromName: user.fullName,
            toUserId: recipient._id, toAccountNumber: recipient.accountNumber, toName: recipient.fullName,
            amount, currency: user.currency, reference, status: 'pending', note
        });
        await transaction.save();
        
        res.json({ success: true, step: 1, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/send/step2', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode } = req.body;
        
        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        const bbc = await useBBCode(user._id, bbcCode, 1);
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 1' });
        
        res.json({ success: true, step: 2, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/send/step3', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode } = req.body;
        
        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        const bbc = await useBBCode(user._id, bbcCode, 2);
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 2' });
        
        res.json({ success: true, step: 3, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/send/step4', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode } = req.body;
        
        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        const bbc = await useBBCode(user._id, bbcCode, 3);
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 3' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: transaction.currency });
        const recipientAccount = await Account.findOne({ userId: transaction.toUserId, currency: transaction.currency });
        
        userAccount.balance -= transaction.amount;
        recipientAccount.balance += transaction.amount;
        await userAccount.save();
        await recipientAccount.save();
        
        transaction.status = 'completed';
        await transaction.save();
        
        res.json({ success: true, step: 4, reference, amount: transaction.amount, newBalance: userAccount.balance });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== OTHER ROUTES ==========
app.post('/api/loans/apply', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { amount, purpose, tenureMonths } = req.body;
        const interestRate = 12;
        const monthlyPayment = (amount * (1 + interestRate / 100)) / tenureMonths;
        const totalPayable = monthlyPayment * tenureMonths;
        const loan = new Loan({
            userId: decoded.userId, amount, purpose, interestRate, tenureMonths,
            monthlyPayment: Math.round(monthlyPayment * 100) / 100,
            totalPayable: Math.round(totalPayable * 100) / 100
        });
        await loan.save();
        res.json({ success: true, loan });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/loans', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const loans = await Loan.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(loans);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/cards/toggle', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { cardId, transactionPin } = req.body;
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        const card = await Card.findOne({ _id: cardId, userId: user._id });
        if (!card) return res.status(404).json({ error: 'Card not found' });
        card.status = card.status === 'active' ? 'frozen' : 'active';
        await card.save();
        res.json({ success: true, status: card.status });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/support', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { subject, message } = req.body;
        const ticket = new SupportMessage({ userId: user._id, name: user.fullName, email: user.email, subject, message });
        await ticket.save();
        res.json({ success: true, ticket });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/support/tickets', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tickets = await SupportMessage.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/update-password', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { currentPassword, newPassword } = req.body;
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/update-pin', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { currentPin, newPin } = req.body;
        const valid = await bcrypt.compare(currentPin, user.transactionPin);
        if (!valid) return res.status(401).json({ error: 'Current PIN incorrect' });
        user.transactionPin = await bcrypt.hash(newPin, 10);
        await user.save();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== ADMIN ROUTES ==========
app.get('/api/admin/users', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
    
    const users = await User.find({}, '-password -transactionPin');
    const usersWithBalance = await Promise.all(users.map(async (u) => {
        const accounts = await Account.find({ userId: u._id });
        const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
        return { ...u.toObject(), totalBalance };
    }));
    res.json(usersWithBalance);
});

app.post('/api/admin/generate-bbc', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
    
    const { userId, step = 1, quantity = 20, expiryDays = 30 } = req.body;
    const codes = [];
    for (let i = 0; i < quantity; i++) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await new BBC({
            code, userId, step,
            expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
        }).save();
        codes.push(code);
    }
    res.json({ success: true, codes });
});

app.get('/api/admin/bbc/:userId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
    
    const codes = await BBC.find({ userId: req.params.userId }).select('code step isUsed expiresAt _id').sort({ createdAt: -1 });
    res.json(codes);
});

app.post('/api/admin/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
    
    const { toAccountNumber, amount, currency, senderName, note } = req.body;
    const recipient = await User.findOne({ $or: [{ accountNumber: toAccountNumber }, { iban: toAccountNumber }] });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    
    let recipientAccount = await Account.findOne({ userId: recipient._id, currency });
    if (!recipientAccount) {
        recipientAccount = new Account({ userId: recipient._id, currency, accountNumber: generateAccountNumber(currency), iban: generateIBAN(currency, generateAccountNumber(currency)), balance: 0 });
        await recipientAccount.save();
    }
    recipientAccount.balance += amount;
    await recipientAccount.save();
    
    const reference = generateReference();
    const transaction = new Transaction({ toUserId: recipient._id, toAccountNumber: recipientAccount.accountNumber, toName: recipient.fullName, fromName: senderName, amount, currency, reference, note, type: 'deposit' });
    await transaction.save();
    
    res.json({ success: true, message: `Sent ${currency} ${amount} to ${recipient.fullName}` });
});

app.post('/api/admin/toggle-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
        
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.isActive = !user.isActive;
        await user.save();
        
        res.json({ success: true, isActive: user.isActive });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== CREATE DEFAULT ADMIN ==========
async function createAdmin() {
    try {
        const adminExists = await User.findOne({ isAdmin: true });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Prime@Admin2026', 10);
            const accountNumber = generateAccountNumber('USD');
            const admin = new User({
                fullName: 'System Administrator',
                firstName: 'System',
                lastName: 'Admin',
                email: 'admin@primeheritage.com',
                phone: '+1 (800) 555-0000',
                password: hashedPassword,
                transactionPin: await bcrypt.hash('0000', 10),
                currency: 'USD',
                accountNumber,
                iban: generateIBAN('USD', accountNumber),
                swiftCode: generateSWIFTCode('USD'),
                isAdmin: true,
                isEmailVerified: true
            });
            await admin.save();
            console.log('✅ Admin created!');
            console.log('📧 Email: admin@primeheritage.com');
            console.log('🔑 Password: Prime@Admin2026');
        }
    } catch (error) {
        console.error('Admin creation error:', error);
    }
}

// ========== START SERVER ==========
createAdmin();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`👑 Prime Heritage Bank running on http://localhost:${PORT}`);
    console.log(`📧 Email: Brevo SMTP - ACTIVE`);
    console.log(`💳 BBC Security System: ACTIVE`);
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
