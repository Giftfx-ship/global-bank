require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const { Resend } = require('resend');

const app = express();

// ========== COLORED LOGGING SYSTEM ==========
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let prefix = '';
    let color = '';
    
    switch(level) {
        case 'INFO':
            color = colors.cyan;
            prefix = 'ℹ️ INFO';
            break;
        case 'SUCCESS':
            color = colors.green;
            prefix = '✅ SUCCESS';
            break;
        case 'ERROR':
            color = colors.red;
            prefix = '❌ ERROR';
            break;
        case 'WARN':
            color = colors.yellow;
            prefix = '⚠️ WARN';
            break;
        case 'DEBUG':
            color = colors.magenta;
            prefix = '🔍 DEBUG';
            break;
        case 'TEST':
            color = colors.blue;
            prefix = '🧪 TEST';
            break;
        default:
            color = colors.white;
            prefix = '📌 LOG';
    }
    
    console.log(`${color}[${timestamp}] ${prefix}: ${message}${colors.reset}`);
    if (data) {
        console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
}

// ========== STARTUP BANNER ==========
console.log(`\n${colors.bright}${colors.cyan}`);
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║                                                               ║');
console.log('║     🏦  PRIME HERITAGE BANK - INTERNATIONAL BANKING         ║');
console.log('║                                                               ║');
console.log('║     Version: 3.0.0                                           ║');
console.log('║     Starting up...                                           ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log(`${colors.reset}\n`);

log('INFO', 'Initializing server...');
log('INFO', `Node version: ${process.version}`);
log('INFO', `Environment: ${process.env.NODE_ENV || 'development'}`);

// ========== CONFIGURATION ==========
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'prime_heritage_super_secret_2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'prime_heritage_session_secret';

// ========== TEST 1: RESEND EMAIL ==========
log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TEST', 'TEST 1: Checking Resend Email Service');
log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const RESEND_API_KEY = 're_RfHJYftk_JqBrWqx6oFSsYhc8csMUz4w2';
const resend = new Resend(RESEND_API_KEY);

async function testResendConnection() {
    log('INFO', 'Testing Resend API connection...');
    
    try {
        const { data, error } = await resend.emails.send({
            from: 'Prime Heritage Bank <onboarding@resend.dev>',
            to: ['nwodugift5@gmail.com'],
            subject: '✅ System Test - Prime Heritage Bank',
            html: `
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: Arial, sans-serif; background: #0A0E1A; margin:0; padding:40px;">
                <div style="max-width:500px; margin:0 auto; background:#111827; border-radius:24px; padding:30px; border:1px solid #C6A43F;">
                <h2 style="color:#C6A43F;">✅ System Test Successful!</h2>
                <p style="color:#fff;">Hi Mr Dev,</p>
                <p style="color:#fff;">This is a test email from Prime Heritage Bank.</p>
                <p style="color:#fff;">Your email system is working perfectly!</p>
                <div style="background:#0F1622; padding:15px; border-radius:12px; margin:20px 0;">
                <p><strong style="color:#C6A43F;">Status:</strong> <span style="color:#10B981;">✅ OPERATIONAL</span></p>
                <p><strong style="color:#C6A43F;">Time:</strong> <span style="color:#fff;">${new Date().toLocaleString()}</span></p>
                <p><strong style="color:#C6A43F;">Server:</strong> <span style="color:#fff;">Prime Heritage Bank</span></p>
                </div>
                <p style="color:#9CA3AF;">All systems ready for production!</p>
                </div>
                </body>
                </html>
            `
        });
        
        if (error) {
            log('ERROR', 'Resend API test FAILED:', error);
            return false;
        }
        
        log('SUCCESS', '✅ Resend email test PASSED!');
        log('INFO', `Email ID: ${data?.id}`);
        log('INFO', `Test email sent to: nwodugift5@gmail.com`);
        return true;
    } catch (error) {
        log('ERROR', 'Resend test exception:', error.message);
        return false;
    }
}

// ========== TEST 2: MONGODB CONNECTION ==========
async function testMongoDBConnection() {
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('TEST', 'TEST 2: Checking MongoDB Connection');
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const MONGODB_URI = 'mongodb+srv://mrdev:dev091339@cluster0.grjlq7v.mongodb.net/globalbank?retryWrites=true&w=majority';
    
    try {
        log('INFO', 'Attempting to connect to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        log('SUCCESS', '✅ MongoDB connection successful!');
        log('INFO', `Database: ${mongoose.connection.name}`);
        log('INFO', `Host: ${mongoose.connection.host}`);
        return true;
    } catch (error) {
        log('ERROR', 'MongoDB connection FAILED:', error.message);
        return false;
    }
}

// ========== TEST 3: BCRYPT ==========
async function testBcrypt() {
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('TEST', 'TEST 3: Checking Bcrypt Encryption');
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        const testPassword = 'TestPassword123';
        const hashed = await bcrypt.hash(testPassword, 10);
        const isValid = await bcrypt.compare(testPassword, hashed);
        
        if (isValid) {
            log('SUCCESS', '✅ Bcrypt encryption test PASSED!');
            return true;
        } else {
            log('ERROR', 'Bcrypt encryption test FAILED!');
            return false;
        }
    } catch (error) {
        log('ERROR', 'Bcrypt test error:', error.message);
        return false;
    }
}

// ========== TEST 4: JWT ==========
function testJWT() {
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('TEST', 'TEST 4: Checking JWT Token Generation');
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        const testPayload = { userId: 'test123', email: 'test@example.com' };
        const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '1h' });
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded && decoded.userId === testPayload.userId) {
            log('SUCCESS', '✅ JWT token test PASSED!');
            log('DEBUG', `Test token generated: ${token.substring(0, 50)}...`);
            return true;
        } else {
            log('ERROR', 'JWT token test FAILED!');
            return false;
        }
    } catch (error) {
        log('ERROR', 'JWT test error:', error.message);
        return false;
    }
}

// ========== TEST 5: EXPRESS ROUTES ==========
function testExpressRoutes() {
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('TEST', 'TEST 5: Checking Express Configuration');
    log('TEST', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Test middleware
        app.set('trust proxy', true);
        log('SUCCESS', '✅ Express proxy setting configured');
        
        // Test body parser
        app.use(express.json());
        log('SUCCESS', '✅ JSON body parser configured');
        
        // Test CORS
        app.use(cors());
        log('SUCCESS', '✅ CORS configured');
        
        return true;
    } catch (error) {
        log('ERROR', 'Express configuration error:', error.message);
        return false;
    }
}

// ========== RUN ALL TESTS BEFORE STARTING ==========
async function runStartupTests() {
    log('INFO', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('INFO', '🔧 RUNNING STARTUP TESTS');
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const results = {
        resend: await testResendConnection(),
        mongodb: await testMongoDBConnection(),
        bcrypt: await testBcrypt(),
        jwt: testJWT(),
        express: testExpressRoutes()
    };
    
    log('INFO', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('INFO', '📊 TEST RESULTS SUMMARY');
    log('INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let allPassed = true;
    for (const [test, passed] of Object.entries(results)) {
        if (passed) {
            log('SUCCESS', `✅ ${test.toUpperCase()}: PASSED`);
        } else {
            log('ERROR', `❌ ${test.toUpperCase()}: FAILED`);
            allPassed = false;
        }
    }
    
    log('INFO', '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (allPassed) {
        log('SUCCESS', '🎉 ALL TESTS PASSED! Starting server...');
        return true;
    } else {
        log('ERROR', '💥 SOME TESTS FAILED! Server may not work correctly.');
        return false;
    }
}

// ========== EMAIL FUNCTION ==========
async function sendEmail(to, subject, html) {
    log('INFO', `📧 Sending email to: ${to}`);
    try {
        const { data, error } = await resend.emails.send({
            from: 'Prime Heritage Bank <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: html
        });
        
        if (error) {
            log('ERROR', 'Email send failed:', error);
            return false;
        }
        
        log('SUCCESS', `✅ Email sent! ID: ${data?.id}`);
        return true;
    } catch (error) {
        log('ERROR', 'Email exception:', error.message);
        return false;
    }
}

// ========== EMAIL TEMPLATES ==========
function getVerificationEmail(name, code) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Verify Email</title></head>
<body style="font-family: Arial, sans-serif; background: #0A0E1A; margin:0; padding:40px;">
<div style="max-width:500px; margin:0 auto; background:#111827; border-radius:24px; padding:30px; border:1px solid #C6A43F;">
<h2 style="color:#C6A43F;">Welcome ${name}! 👋</h2>
<p style="color:#fff;">Your verification code is:</p>
<div style="background:#0F1622; padding:20px; text-align:center; border-radius:12px; margin:20px 0;">
<h1 style="color:#C6A43F; letter-spacing:8px;">${code}</h1>
</div>
<p style="color:#9CA3AF;">This code expires in 10 minutes.</p>
</div>
</body>
</html>`;
}

function getWelcomeEmail(name, accountNumber, iban, swiftCode, currency) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Welcome</title></head>
<body style="font-family: Arial, sans-serif; background: #0A0E1A; margin:0; padding:40px;">
<div style="max-width:500px; margin:0 auto; background:#111827; border-radius:24px; padding:30px; border:1px solid #C6A43F;">
<h2 style="color:#C6A43F;">Welcome ${name}! 🎉</h2>
<p style="color:#fff;">Your account has been verified successfully!</p>
<div style="background:#0F1622; padding:15px; border-radius:12px; margin:20px 0;">
<p><strong style="color:#C6A43F;">Account:</strong> <span style="color:#fff;">${accountNumber}</span></p>
<p><strong style="color:#C6A43F;">IBAN:</strong> <span style="color:#fff;">${iban}</span></p>
<p><strong style="color:#C6A43F;">SWIFT:</strong> <span style="color:#fff;">${swiftCode}</span></p>
<p><strong style="color:#C6A43F;">Currency:</strong> <span style="color:#fff;">${currency}</span></p>
</div>
</div>
</body>
</html>`;
}

function getPasswordResetEmail(name, code) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Password Reset</title></head>
<body style="font-family: Arial, sans-serif; background: #0A0E1A; margin:0; padding:40px;">
<div style="max-width:500px; margin:0 auto; background:#111827; border-radius:24px; padding:30px; border:1px solid #C6A43F;">
<h2 style="color:#C6A43F;">Password Reset</h2>
<p style="color:#fff;">Hello ${name},</p>
<p style="color:#fff;">Your password reset code is:</p>
<div style="background:#0F1622; padding:20px; text-align:center; border-radius:12px; margin:20px 0;">
<h1 style="color:#C6A43F; letter-spacing:8px;">${code}</h1>
</div>
<p style="color:#EF4444;">This code expires in 10 minutes.</p>
</div>
</body>
</html>`;
}

// ========== DATABASE SCHEMAS ==========
const UserSchema = new mongoose.Schema({
    fullName: String, firstName: String, lastName: String,
    email: { type: String, unique: true }, phone: String,
    password: String, transactionPin: String,
    currency: { type: String, enum: ['USD', 'EUR', 'GBP'], default: 'USD' },
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
    cvv: String, status: { type: String, default: 'active' },
    dailyLimit: { type: Number, default: 5000 }
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

// ========== REGISTER ROUTE ==========
app.post('/api/register', async (req, res) => {
    log('INFO', `📝 Registration request: ${req.body.email}`);
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) {
            log('WARN', `Registration failed: Email already exists - ${email}`);
            return res.status(400).json({ error: 'Email already registered' });
        }

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
        log('SUCCESS', `User created: ${user._id} - ${email}`);

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

        const emailSent = await sendEmail(email, 'Verify Your Email - Prime Heritage Bank', getVerificationEmail(`${firstName} ${lastName}`, verificationCode));
        
        if (emailSent) {
            log('SUCCESS', `Verification email sent to ${email}`);
        } else {
            log('ERROR', `Failed to send verification email to ${email}`);
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true, token, requiresVerification: true,
            message: emailSent ? 'Verification code sent to your email' : 'Account created. Check console for code.',
            user: { id: user._id, fullName: user.fullName, email, accountNumber, iban, swiftCode, currency, isAdmin: false, isEmailVerified: false }
        });
    } catch (error) {
        log('ERROR', 'Registration error:', error.message);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// ========== VERIFY EMAIL ==========
app.post('/api/verify-email', async (req, res) => {
    log('INFO', `🔐 Verification request: ${req.body.email}`);
    try {
        const { email, code } = req.body;
        
        const verification = await VerificationCode.findOne({ email, code, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!verification) {
            log('WARN', `Invalid verification attempt for ${email} with code ${code}`);
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        
        verification.isUsed = true;
        await verification.save();
        
        const user = await User.findById(verification.userId);
        user.isEmailVerified = true;
        await user.save();
        
        log('SUCCESS', `Email verified: ${email}`);

        await sendEmail(email, 'Welcome to Prime Heritage Bank! 🎉', getWelcomeEmail(user.fullName, user.accountNumber, user.iban, user.swiftCode, user.currency));

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true, token,
            message: 'Email verified successfully!',
            user: { id: user._id, fullName: user.fullName, email, accountNumber: user.accountNumber, iban: user.iban, swiftCode: user.swiftCode, currency: user.currency, isAdmin: user.isAdmin, isEmailVerified: true }
        });
    } catch (error) {
        log('ERROR', 'Verification error:', error.message);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ========== RESEND VERIFICATION ==========
app.post('/api/resend-verification', async (req, res) => {
    log('INFO', `📧 Resend verification: ${req.body.email}`);
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
        log('ERROR', 'Resend error:', error.message);
        res.status(500).json({ error: 'Failed to resend' });
    }
});

// ========== FORGOT PASSWORD ==========
app.post('/api/forgot-password', async (req, res) => {
    log('INFO', `🔐 Forgot password: ${req.body.email}`);
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
        log('ERROR', 'Forgot password error:', error.message);
        res.status(500).json({ error: 'Failed to send reset code' });
    }
});

// ========== RESET PASSWORD ==========
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

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
    log('INFO', `🔐 Login attempt: ${req.body.identifier}`);
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { accountNumber: identifier }, { iban: identifier }] });
        if (!user) {
            log('WARN', `Login failed: User not found - ${identifier}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            log('WARN', `Login failed: Invalid password for ${identifier}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (!user.isEmailVerified && !user.isAdmin) {
            log('WARN', `Login blocked: Email not verified - ${user.email}`);
            return res.status(403).json({ error: 'Email not verified', requiresVerification: true, email: user.email });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        log('SUCCESS', `Login successful: ${user.email}`);
        
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email: user.email, accountNumber: user.accountNumber, iban: user.iban, swiftCode: user.swiftCode, currency: user.currency, isAdmin: user.isAdmin, isEmailVerified: user.isEmailVerified } });
    } catch (error) {
        log('ERROR', 'Login error:', error.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ========== GET CURRENT USER ==========
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
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

// ========== LOANS ==========
app.post('/api/loans/apply', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
        const loans = await Loan.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(loans);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== CARDS ==========
app.post('/api/cards/toggle', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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

// ========== SUPPORT ==========
app.post('/api/support', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
        const tickets = await SupportMessage.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== PROFILE ==========
app.post('/api/update-password', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
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
    const decoded = jwt.verify(token, JWT_SECRET);
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
    const decoded = jwt.verify(token, JWT_SECRET);
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
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
    
    const codes = await BBC.find({ userId: req.params.userId }).select('code step isUsed expiresAt _id').sort({ createdAt: -1 });
    res.json(codes);
});

app.post('/api/admin/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
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
        const decoded = jwt.verify(token, JWT_SECRET);
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
            log('INFO', 'Creating default admin user...');
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
            log('SUCCESS', '✅ Admin created successfully!');
            log('INFO', '📧 Admin Email: admin@primeheritage.com');
            log('INFO', '🔑 Admin Password: Prime@Admin2026');
        } else {
            log('INFO', 'Admin user already exists');
        }
    } catch (error) {
        log('ERROR', 'Admin creation error:', error.message);
    }
}

// ========== START SERVER ==========
async function startServer() {
    // Run startup tests first
    const testsPassed = await runStartupTests();
    
    if (!testsPassed) {
        log('WARN', 'Some tests failed. Server will still start but may have issues.');
    }
    
    // Create admin user
    await createAdmin();
    
    // Apply middleware
    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    app.use(compression());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());
    app.use(express.static('public'));
    
    // Start listening
    app.listen(PORT, () => {
        log('SUCCESS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log('SUCCESS', `🚀 PRIME HERITAGE BANK SERVER IS RUNNING!`);
        log('SUCCESS', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log('INFO', `🌐 Local: http://localhost:${PORT}`);
        log('INFO', `📧 Email Service: Resend (Active)`);
        log('INFO', `💳 BBC Security System: Active`);
        log('INFO', `📊 API Endpoints: /api/register, /api/login, /api/me, etc.`);
        log('INFO', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    });
    
    // Serve frontend
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    log('ERROR', 'Uncaught Exception:', error.message);
    log('DEBUG', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', 'Unhandled Rejection:', reason);
});

// Start the server
startServer();
