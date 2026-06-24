require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

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
    gold: '\x1b[38;5;214m',
};

function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = {
        'INFO': 'ℹ️ INFO',
        'SUCCESS': '✅ SUCCESS',
        'ERROR': '❌ ERROR',
        'WARN': '⚠️ WARN',
        'DEBUG': '🔍 DEBUG',
        'AUTH': '🔐 AUTH',
        'EMAIL': '📧 EMAIL',
        'BANK': '🏦 BANK'
    }[level] || '📌 LOG';
    
    const color = {
        'INFO': colors.cyan,
        'SUCCESS': colors.green,
        'ERROR': colors.red,
        'WARN': colors.yellow,
        'DEBUG': colors.magenta,
        'AUTH': colors.gold,
        'EMAIL': colors.blue,
        'BANK': colors.gold
    }[level] || colors.white;
    
    console.log(`${color}[${timestamp}] ${prefix}: ${message}${colors.reset}`);
    if (data) console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
}

// ========== STARTUP BANNER ==========
console.log(`\n${colors.bright}${colors.gold}`);
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                                                                   ║');
console.log('║     👑  PRIME HERITAGE BANK - INTERNATIONAL BANKING 2026        ║');
console.log('║                                                                   ║');
console.log('║     🌍 Global Excellence  •  💎 Premium Service  •  🔒 Secure    ║');
console.log('║                                                                   ║');
console.log('║     Version: 5.0.0                                               ║');
console.log('║     Initializing banking system...                               ║');
console.log('║                                                                   ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log(`${colors.reset}\n`);

// ========== CONFIGURATION ==========
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure';
const MONGODB_URI = 'mongodb+srv://devvgift_db_user:fZ8W6OUOFYV6KxTU@cluster0.lcshvgf.mongodb.net/primeheritage?retryWrites=true&w=majority&appName=Cluster0';

// ========== EMAIL CONFIGURATION ==========
const EMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'primeheritageinternationalbank@gmail.com',
        pass: 'pzxw dqxj queu wcch'
    },
    tls: { rejectUnauthorized: false }
};

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

transporter.verify((error) => {
    if (error) {
        log('ERROR', 'Email service connection failed:', error.message);
    } else {
        log('SUCCESS', '✅ Email service ready!');
        log('INFO', `📧 From: ${EMAIL_CONFIG.auth.user}`);
    }
});

// ========== RATE LIMITING ==========
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

// ========== DATABASE SCHEMAS ==========
const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    transactionPin: { type: String, required: true },
    currency: { type: String, enum: ['USD', 'EUR', 'GBP'], default: 'USD' },
    accountNumber: { type: String, unique: true },
    iban: { type: String, unique: true },
    swiftCode: String,
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: true },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true },
    accountNumber: { type: String, unique: true },
    iban: { type: String, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    savings: { type: Number, default: 0 },
    totalDeposits: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 }
});

const TransactionSchema = new mongoose.Schema({
    reference: { type: String, unique: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'transfer', 'savings', 'loan'] },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    fromUserId: mongoose.Schema.Types.ObjectId,
    fromAccountNumber: String,
    fromName: String,
    toUserId: mongoose.Schema.Types.ObjectId,
    toAccountNumber: String,
    toName: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cardNumber: { type: String, unique: true },
    last4: String,
    expiryMonth: Number,
    expiryYear: Number,
    cvv: String,
    type: { type: String, enum: ['debit', 'credit', 'premium'], default: 'debit' },
    status: { type: String, enum: ['active', 'frozen', 'blocked'], default: 'active' },
    dailyLimit: { type: Number, default: 5000 },
    createdAt: { type: Date, default: Date.now }
});

const LoanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    purpose: String,
    interestRate: { type: Number, default: 12 },
    tenureMonths: { type: Number, default: 12 },
    monthlyPayment: Number,
    totalPayable: Number,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'active', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const SupportTicketSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    email: String,
    subject: { type: String, required: true },
    message: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const Loan = mongoose.model('Loan', LoanSchema);
const SupportTicket = mongoose.model('SupportTicket', SupportTicketSchema);

// ========== HELPER FUNCTIONS ==========
function generateAccountNumber(currency) {
    const prefixes = { 'USD': 'PHB-USA', 'EUR': 'PHB-EU', 'GBP': 'PHB-UK' };
    const prefix = prefixes[currency] || 'PHB';
    const nums = Array.from({ length: 3 }, () => Math.floor(Math.random() * 9000 + 1000));
    return `${prefix}-${nums.join('-')}`;
}

function generateIBAN(currency, accountNumber) {
    const countries = { 'USD': 'US', 'EUR': 'DE', 'GBP': 'GB' };
    const country = countries[currency] || 'US';
    const clean = accountNumber.replace(/[^0-9]/g, '');
    const checkDigits = String(Math.floor(Math.random() * 90 + 10));
    return `${country}${checkDigits}${clean.substring(0, 20)}`;
}

function generateSWIFTCode(currency) {
    const codes = { 'USD': 'US', 'EUR': 'DE', 'GBP': 'GB' };
    const country = codes[currency] || 'US';
    const letters = Array.from({ length: 3 }, () => 
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join('');
    return `PHBG${country}33${letters}`;
}

function generateCardNumber() {
    const prefix = '4532';
    const nums = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    return prefix + nums.join('');
}

function generateReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `PHB-${Date.now().toString(36).toUpperCase()}-${random}`;
}

async function sendEmail(to, subject, html) {
    log('EMAIL', `📧 Sending email to: ${to}`);
    try {
        const mailOptions = {
            from: `"Prime Heritage Bank" <${EMAIL_CONFIG.auth.user}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: 'primeheritageinternationalbank@gmail.com'
        };
        const info = await transporter.sendMail(mailOptions);
        log('SUCCESS', `✅ Email sent! ID: ${info.messageId}`);
        return true;
    } catch (error) {
        log('ERROR', 'Email send failed:', error.message);
        return false;
    }
}

// ========== EMAIL TEMPLATES ==========
function getWelcomeEmail(user) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Prime Heritage Bank</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0A0E1A; 
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #111827; 
            border-radius: 32px; 
            padding: 48px 40px;
            border: 1px solid rgba(198, 164, 63, 0.3);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
        }
        .header { 
            text-align: center; 
            margin-bottom: 32px;
        }
        .logo { 
            display: inline-block; 
            background: linear-gradient(135deg, #C6A43F, #9E8032); 
            padding: 12px 28px; 
            border-radius: 16px; 
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(198, 164, 63, 0.3);
        }
        .logo span { 
            color: #0A0E1A; 
            font-size: 22px; 
            font-weight: 800; 
            letter-spacing: 3px;
        }
        .gold-text { color: #C6A43F; }
        h1 { 
            color: #C6A43F; 
            font-size: 32px; 
            font-weight: 800;
            margin-bottom: 8px;
        }
        .subtitle { 
            color: #9CA3AF; 
            font-size: 15px;
            font-weight: 400;
        }
        .divider { 
            height: 2px; 
            background: linear-gradient(90deg, transparent, #C6A43F, transparent);
            margin: 30px 0;
            opacity: 0.3;
        }
        .content { color: #E5E7EB; }
        .greeting { 
            font-size: 20px; 
            font-weight: 600;
            margin-bottom: 16px;
        }
        .greeting span { color: #C6A43F; }
        .welcome-message {
            background: linear-gradient(135deg, rgba(198, 164, 63, 0.08), rgba(158, 128, 50, 0.04));
            border-radius: 20px;
            padding: 24px;
            margin: 24px 0;
            border-left: 4px solid #C6A43F;
        }
        .account-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 24px 0;
        }
        .account-item {
            background: #0F1622;
            padding: 16px;
            border-radius: 16px;
            border: 1px solid #1F2937;
        }
        .account-item .label {
            color: #9CA3AF;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .account-item .value {
            color: #C6A43F;
            font-weight: 700;
            font-size: 14px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }
        .features {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin: 24px 0;
        }
        .feature {
            text-align: center;
            padding: 16px 8px;
            background: #0F1622;
            border-radius: 16px;
            border: 1px solid #1F2937;
        }
        .feature i {
            font-size: 24px;
            display: block;
            margin-bottom: 6px;
        }
        .feature span {
            color: #9CA3AF;
            font-size: 11px;
            font-weight: 500;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #C6A43F, #9E8032);
            color: #0A0E1A;
            padding: 16px 40px;
            border-radius: 16px;
            text-decoration: none;
            font-weight: 700;
            font-size: 16px;
            margin: 20px 0 10px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(198, 164, 63, 0.3);
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(198, 164, 63, 0.4);
        }
        .footer {
            color: #6B7280;
            font-size: 12px;
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #1F2937;
        }
        .footer-links { margin: 8px 0; }
        .footer-links a {
            color: #C6A43F;
            text-decoration: none;
            margin: 0 12px;
            font-weight: 500;
        }
        .footer-links a:hover { text-decoration: underline; }
        .badge {
            display: inline-block;
            background: rgba(198, 164, 63, 0.12);
            color: #C6A43F;
            padding: 2px 12px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        @media (max-width: 500px) {
            .container { padding: 24px 20px; }
            .account-grid { grid-template-columns: 1fr; }
            .features { grid-template-columns: 1fr 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo"><span>🏦 PHB</span></div>
            <h1>Welcome to Prime Heritage Bank</h1>
            <p class="subtitle">Your premium international banking journey begins now</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Dear <span>${user.fullName}</span>,
            </div>
            
            <div class="welcome-message">
                <p style="font-size: 16px; font-weight: 500; color: #C6A43F; margin-bottom: 8px;">
                    🎉 Welcome to the family!
                </p>
                <p style="color: #E5E7EB;">
                    Your Prime Heritage Bank account has been successfully created. 
                    We're honored to have you as a valued client. Experience world-class 
                    banking with premium benefits, global accessibility, and top-tier security.
                </p>
            </div>

            <div style="text-align: center; margin: 8px 0 16px;">
                <span class="badge">🌟 Premium Account</span>
                <span class="badge">🔒 Secure Banking</span>
                <span class="badge">🌍 International</span>
            </div>

            <div class="account-grid">
                <div class="account-item">
                    <div class="label">📋 Account Number</div>
                    <div class="value">${user.accountNumber}</div>
                </div>
                <div class="account-item">
                    <div class="label">🌍 IBAN</div>
                    <div class="value">${user.iban}</div>
                </div>
                <div class="account-item">
                    <div class="label">🏦 SWIFT Code</div>
                    <div class="value">${user.swiftCode}</div>
                </div>
                <div class="account-item">
                    <div class="label">💱 Currency</div>
                    <div class="value">${user.currency}</div>
                </div>
            </div>

            <div class="features">
                <div class="feature">
                    <i style="font-size: 24px;">💳</i>
                    <span>Premium Card</span>
                </div>
                <div class="feature">
                    <i style="font-size: 24px;">🌐</i>
                    <span>Global Access</span>
                </div>
                <div class="feature">
                    <i style="font-size: 24px;">🔐</i>
                    <span>Secure Banking</span>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="#" class="cta-button">🚀 Access Your Dashboard</a>
                <p style="color: #6B7280; font-size: 13px; margin-top: 12px;">
                    Sign in to manage your account, transfer funds, and more
                </p>
            </div>

            <div class="divider"></div>
            
            <div style="background: #0F1622; border-radius: 16px; padding: 20px; margin-top: 16px;">
                <p style="color: #9CA3AF; font-size: 13px; text-align: center;">
                    💡 <strong style="color: #C6A43F;">Quick Tips:</strong>
                </p>
                <ul style="color: #9CA3AF; font-size: 13px; list-style: none; padding: 0; text-align: center;">
                    <li style="padding: 4px 0;">• Your account is ready for international transfers</li>
                    <li style="padding: 4px 0;">• Access your funds 24/7 through our digital platform</li>
                    <li style="padding: 4px 0;">• 24/7 premium support available</li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <div class="footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Support</a>
            </div>
            <p style="margin-top: 8px;">© 2026 Prime Heritage Bank. All rights reserved.</p>
            <p style="font-size: 11px; color: #4B5563; margin-top: 4px;">
                This is an automated welcome message. Please do not reply.
            </p>
        </div>
    </div>
</body>
</html>`;
}

// ========== API ROUTES ==========

// Register
app.post('/api/register', async (req, res) => {
    log('AUTH', `📝 Registration: ${req.body.email}`);
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = await bcrypt.hash(transactionPin, 10);
        const accountNumber = generateAccountNumber(currency);
        const iban = generateIBAN(currency, accountNumber);
        const swiftCode = generateSWIFTCode(currency);

        const user = new User({
            fullName: `${firstName} ${lastName}`,
            firstName, lastName, email, phone,
            password: hashedPassword,
            transactionPin: hashedPin,
            currency, accountNumber, iban, swiftCode,
            isEmailVerified: true,
            lastLogin: new Date()
        });
        await user.save();
        log('SUCCESS', `✅ User created: ${user._id} - ${email}`);

        const account = new Account({
            userId: user._id, currency, accountNumber, iban, balance: 0
        });
        await account.save();

        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id,
            cardNumber: cardNum,
            last4: cardNum.slice(-4),
            expiryMonth: 12,
            expiryYear: 2030,
            cvv: String(Math.floor(100 + Math.random() * 900)),
            type: 'premium'
        });
        await card.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        // Send welcome email
        try {
            await sendEmail(
                email,
                '👑 Welcome to Prime Heritage Bank - Your Premium Account is Ready!',
                getWelcomeEmail(user)
            );
        } catch (emailError) {
            log('ERROR', `Email error: ${emailError.message}`);
        }

        res.json({
            success: true,
            token,
            message: 'Account created successfully! Welcome to Prime Heritage Bank.',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                accountNumber: user.accountNumber,
                iban: user.iban,
                swiftCode: user.swiftCode,
                currency: user.currency,
                isAdmin: user.isAdmin,
                isEmailVerified: user.isEmailVerified
            }
        });

    } catch (error) {
        log('ERROR', 'Registration error:', error.message);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    log('AUTH', `🔐 Login attempt: ${req.body.identifier}`);
    try {
        const { identifier, password } = req.body;
        
        const user = await User.findOne({ 
            $or: [{ email: identifier }, { accountNumber: identifier }, { iban: identifier }] 
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is disabled' });
        }
        
        user.lastLogin = new Date();
        user.loginCount += 1;
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        log('SUCCESS', `✅ Login successful: ${user.email}`);
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                accountNumber: user.accountNumber,
                iban: user.iban,
                swiftCode: user.swiftCode,
                currency: user.currency,
                isAdmin: user.isAdmin,
                isEmailVerified: user.isEmailVerified
            }
        });
    } catch (error) {
        log('ERROR', 'Login error:', error.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get user profile
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -transactionPin');
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const account = await Account.findOne({ userId: user._id });
        const cards = await Card.find({ userId: user._id });
        const transactions = await Transaction.find({ 
            $or: [{ fromUserId: user._id }, { toUserId: user._id }] 
        }).sort({ createdAt: -1 }).limit(50);
        const loans = await Loan.find({ userId: user._id });
        const tickets = await SupportTicket.find({ userId: user._id });
        
        res.json({
            user,
            account,
            cards,
            transactions,
            loans,
            tickets,
            totalBalance: account?.balance || 0
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Transfer money
app.post('/api/transfer', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { toAccountNumber, amount, description, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        const senderAccount = await Account.findOne({ userId: user._id });
        if (!senderAccount || senderAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        const recipient = await User.findOne({ 
            $or: [{ accountNumber: toAccountNumber }, { iban: toAccountNumber }] 
        });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        if (recipient._id.equals(user._id)) {
            return res.status(400).json({ error: 'Cannot transfer to yourself' });
        }
        
        const recipientAccount = await Account.findOne({ userId: recipient._id });
        if (!recipientAccount) return res.status(404).json({ error: 'Recipient account not found' });
        
        const reference = generateReference();
        senderAccount.balance -= amount;
        recipientAccount.balance += amount;
        await senderAccount.save();
        await recipientAccount.save();
        
        const transaction = new Transaction({
            reference,
            type: 'transfer',
            amount,
            currency: user.currency,
            fromUserId: user._id,
            fromAccountNumber: senderAccount.accountNumber,
            fromName: user.fullName,
            toUserId: recipient._id,
            toAccountNumber: recipientAccount.accountNumber,
            toName: recipient.fullName,
            description: description || 'Transfer',
            status: 'completed'
        });
        await transaction.save();
        
        log('BANK', `💸 Transfer: ${amount} ${user.currency} from ${user.email} to ${recipient.email}`);
        
        res.json({
            success: true,
            reference,
            amount,
            newBalance: senderAccount.balance,
            recipient: recipient.fullName
        });
    } catch (error) {
        log('ERROR', 'Transfer error:', error.message);
        res.status(500).json({ error: 'Transfer failed' });
    }
});

// Get transactions
app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const transactions = await Transaction.find({
            $or: [{ fromUserId: decoded.userId }, { toUserId: decoded.userId }]
        }).sort({ createdAt: -1 }).limit(100);
        
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Apply for loan
app.post('/api/loans', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { amount, purpose, tenureMonths } = req.body;
        
        const interestRate = 12;
        const monthlyPayment = (amount * (1 + interestRate / 100)) / tenureMonths;
        const totalPayable = monthlyPayment * tenureMonths;
        
        const loan = new Loan({
            userId: decoded.userId,
            amount,
            purpose,
            interestRate,
            tenureMonths,
            monthlyPayment: Math.round(monthlyPayment * 100) / 100,
            totalPayable: Math.round(totalPayable * 100) / 100,
            status: 'pending'
        });
        await loan.save();
        
        log('BANK', `💰 Loan application: ${amount} from user ${decoded.userId}`);
        
        res.json({ success: true, loan });
    } catch (error) {
        res.status(500).json({ error: 'Failed to apply for loan' });
    }
});

// Get loans
app.get('/api/loans', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const loans = await Loan.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(loans);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
});

// Support ticket
app.post('/api/support', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { subject, message, priority } = req.body;
        
        const ticket = new SupportTicket({
            userId: user._id,
            name: user.fullName,
            email: user.email,
            subject,
            message,
            priority: priority || 'medium',
            status: 'open'
        });
        await ticket.save();
        
        log('BANK', `🎫 Support ticket created: ${ticket._id} from ${user.email}`);
        
        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// Get support tickets
app.get('/api/support', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const tickets = await SupportTicket.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// ========== ADMIN ROUTES ==========
app.get('/api/admin/users', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        
        const users = await User.find({}, '-password -transactionPin');
        const usersWithBalance = await Promise.all(users.map(async (u) => {
            const account = await Account.findOne({ userId: u._id });
            return { ...u.toObject(), balance: account?.balance || 0 };
        }));
        
        res.json(usersWithBalance);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/admin/toggle-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.isActive = !user.isActive;
        await user.save();
        
        log('BANK', `👤 User ${user.email} status changed to ${user.isActive ? 'active' : 'inactive'}`);
        
        res.json({ success: true, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});

app.post('/api/admin/send-money', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        
        const { toAccountNumber, amount, currency, description } = req.body;
        
        const recipient = await User.findOne({ accountNumber: toAccountNumber });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        
        const recipientAccount = await Account.findOne({ userId: recipient._id });
        if (!recipientAccount) {
            return res.status(404).json({ error: 'Recipient account not found' });
        }
        
        recipientAccount.balance += amount;
        await recipientAccount.save();
        
        const transaction = new Transaction({
            reference: generateReference(),
            type: 'deposit',
            amount,
            currency,
            toUserId: recipient._id,
            toAccountNumber: recipientAccount.accountNumber,
            toName: recipient.fullName,
            fromName: 'System Administrator',
            description: description || 'Admin deposit',
            status: 'completed'
        });
        await transaction.save();
        
        log('BANK', `💰 Admin deposit: ${amount} ${currency} to ${recipient.email}`);
        
        res.json({
            success: true,
            message: `Successfully sent ${amount} ${currency} to ${recipient.fullName}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send money' });
    }
});

// ========== CREATE ADMIN ==========
async function createAdmin() {
    try {
        const adminExists = await User.findOne({ isAdmin: true });
        if (!adminExists) {
            log('INFO', 'Creating admin user...');
            const hashedPassword = await bcrypt.hash('Prime@Admin2026', 10);
            const hashedPin = await bcrypt.hash('0000', 10);
            const accountNumber = generateAccountNumber('USD');
            
            const admin = new User({
                fullName: 'System Administrator',
                firstName: 'System',
                lastName: 'Admin',
                email: 'admin@primeheritage.com',
                phone: '+1 (800) 555-0000',
                password: hashedPassword,
                transactionPin: hashedPin,
                currency: 'USD',
                accountNumber,
                iban: generateIBAN('USD', accountNumber),
                swiftCode: generateSWIFTCode('USD'),
                isAdmin: true,
                isEmailVerified: true,
                isActive: true
            });
            await admin.save();
            
            const account = new Account({
                userId: admin._id,
                currency: 'USD',
                accountNumber,
                iban: generateIBAN('USD', accountNumber),
                balance: 1000000
            });
            await account.save();
            
            log('SUCCESS', '✅ Admin created successfully!');
            log('AUTH', '📧 Email: admin@primeheritage.com');
            log('AUTH', '🔑 Password: Prime@Admin2026');
        } else {
            log('INFO', 'Admin user already exists');
        }
    } catch (error) {
        log('ERROR', 'Admin creation error:', error.message);
    }
}

// ========== CONNECT TO MONGODB ==========
async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        log('SUCCESS', '✅ MongoDB connected successfully!');
        log('INFO', `📊 Database: ${mongoose.connection.name}`);
        log('INFO', `🌐 Host: ${mongoose.connection.host}`);
        return true;
    } catch (error) {
        log('ERROR', 'MongoDB connection failed:', error.message);
        return false;
    }
}

// ========== START SERVER ==========
async function startServer() {
    const dbConnected = await connectDB();
    if (!dbConnected) {
        log('ERROR', 'Cannot start server without database connection');
        process.exit(1);
    }
    
    await createAdmin();
    
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));
    app.use(compression());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());
    app.use(limiter);
    app.use(express.static('public'));
    
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'online',
            version: '5.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    app.listen(PORT, () => {
        console.log(`\n${colors.bright}${colors.gold}`);
        console.log('╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                   ║');
        console.log('║     🚀  PRIME HERITAGE BANK IS NOW LIVE!                         ║');
        console.log('║                                                                   ║');
        console.log(`║     🌐  URL:     http://localhost:${PORT}                          ║`);
        console.log('║     📧  Email:   primeheritageinternationalbank@gmail.com        ║');
        console.log('║     💳  System:  International Banking Platform 2026             ║');
        console.log('║                                                                   ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝');
        console.log(`${colors.reset}\n`);
        
        log('SUCCESS', '🎉 Server is ready for connections!');
        log('INFO', `💻 Environment: ${process.env.NODE_ENV || 'development'}`);
        log('INFO', `📊 API: /api/register, /api/login, /api/me, /api/transfer`);
    });
}

process.on('uncaughtException', (error) => {
    log('ERROR', 'Uncaught Exception:', error.message);
    console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', 'Unhandled Rejection:', reason);
});

startServer();
