const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// ========== MODELS ==========

const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    transactionPin: { type: String, required: true },
    currency: { type: String, required: true, enum: ['USD', 'EUR', 'GBP'] },
    accountNumber: { type: String, unique: true },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String }
});

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true, enum: ['USD', 'EUR', 'GBP'] },
    accountNumber: { type: String, unique: true },
    balance: { type: Number, default: 0 },
    accountType: { type: String, enum: ['checking', 'savings', 'investment'], default: 'checking' },
    interestRate: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
});

const TransactionSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromAccountNumber: { type: String },
    fromName: { type: String },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toAccountNumber: { type: String },
    toName: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    type: { type: String, enum: ['transfer', 'deposit', 'withdrawal', 'airtime', 'bill', 'investment'], default: 'transfer' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'reversed'], default: 'completed' },
    reference: { type: String, unique: true },
    note: { type: String },
    senderNameDisplay: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cardNumber: { type: String, unique: true },
    last4: { type: String },
    expiryMonth: { type: Number },
    expiryYear: { type: Number },
    cvv: { type: String },
    type: { type: String, enum: ['virtual', 'physical'], default: 'virtual' },
    status: { type: String, enum: ['active', 'frozen', 'blocked'], default: 'active' },
    dailyLimit: { type: Number, default: 10000 },
    currency: { type: String, default: 'USD' },
    spentToday: { type: Number, default: 0 }
});

const InvestmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['stocks', 'crypto', 'bonds', 'etf'], required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    returnRate: { type: Number, default: 0 },
    purchasedAt: { type: Date, default: Date.now }
});

const LoanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    tenureMonths: { type: Number, required: true },
    monthlyPayment: { type: Number, required: true },
    totalPayable: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'active', 'completed'], default: 'pending' },
    purpose: { type: String },
    approvedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const AirtimePurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phoneNumber: { type: String, required: true },
    network: { type: String, required: true },
    amount: { type: Number, required: true },
    reference: { type: String, unique: true },
    status: { type: String, default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

const BillPaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    billType: { type: String, enum: ['electricity', 'cable', 'water', 'internet'], required: true },
    provider: { type: String, required: true },
    accountNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    reference: { type: String, unique: true },
    status: { type: String, default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

const SupportTicketSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
    replies: [{
        from: { type: String, enum: ['user', 'admin'] },
        message: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const BBCSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    usedForTransaction: { type: String },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const Investment = mongoose.model('Investment', InvestmentSchema);
const Loan = mongoose.model('Loan', LoanSchema);
const AirtimePurchase = mongoose.model('AirtimePurchase', AirtimePurchaseSchema);
const BillPayment = mongoose.model('BillPayment', BillPaymentSchema);
const SupportTicket = mongoose.model('SupportTicket', SupportTicketSchema);
const BBC = mongoose.model('BBC', BBCSchema);

// ========== HELPER FUNCTIONS ==========

function generateAccountNumber(currency) {
    const prefix = currency === 'USD' ? 'GB-USA-' : currency === 'EUR' ? 'GB-EU-' : 'GB-UK-';
    const random = Math.floor(Math.random() * 9000) + 1000;
    return prefix + random;
}

function generateCardNumber() {
    let num = '4532';
    for (let i = 0; i < 12; i++) {
        num += Math.floor(Math.random() * 10);
    }
    return num;
}

function generateReference() {
    return 'GB-TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateBBCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateVerificationToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Send Email Function
async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"Global Bank" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        });
        console.log(`📧 Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

// Send Welcome Email
async function sendWelcomeEmail(user, accountNumber, cardLast4) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #0A2540, #0066FF); padding: 30px; text-align: center; color: white; }
                .header h1 { margin: 0; font-size: 28px; }
                .content { padding: 30px; }
                .detail-box { background: #F7F9FC; border-radius: 12px; padding: 20px; margin: 20px 0; }
                .detail-item { margin: 10px 0; }
                .detail-label { font-weight: 600; color: #1E293B; }
                .detail-value { color: #0066FF; font-weight: 600; font-size: 18px; }
                .button { background: #0066FF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
                .footer { background: #1E293B; color: #94A3B8; padding: 20px; text-align: center; font-size: 12px; }
                .warning { background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌍 GLOBAL BANK</h1>
                    <p>Welcome to International Banking</p>
                </div>
                <div class="content">
                    <h2>Welcome, ${user.fullName}!</h2>
                    <p>Thank you for choosing Global Bank. Your account has been successfully created.</p>
                    
                    <div class="detail-box">
                        <div class="detail-item">
                            <span class="detail-label">Account Number:</span>
                            <span class="detail-value">${accountNumber}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Primary Currency:</span>
                            <span class="detail-value">${user.currency}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Virtual Card:</span>
                            <span class="detail-value">•••• •••• •••• ${cardLast4}</span>
                        </div>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Important Information</strong><br>
                        Your account is currently pending verification. A bank representative will review your account within 24 hours.
                        You will receive funds once your account is verified.
                    </div>
                    
                    <a href="http://localhost:3000" class="button">Access Your Account</a>
                    
                    <p><strong>Security Tips:</strong></p>
                    <ul>
                        <li>Never share your password or PIN with anyone</li>
                        <li>Always log out after using online banking</li>
                        <li>Enable notifications for all transactions</li>
                    </ul>
                </div>
                <div class="footer">
                    <p>Global Bank - Your World. Your Money.</p>
                    <p>This is an educational simulation. No real money.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(user.email, 'Welcome to Global Bank!', html);
}

// Send Deposit Notification Email
async function sendDepositEmail(user, amount, currency, senderName, note, newBalance) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #00D4AA, #0066FF); padding: 20px; text-align: center; color: white; }
                .content { padding: 30px; }
                .amount { font-size: 36px; color: #00D4AA; font-weight: bold; text-align: center; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>💰 Money Received</h2>
                </div>
                <div class="content">
                    <p>Dear ${user.fullName},</p>
                    <div class="amount">${currency} ${amount.toLocaleString()}</div>
                    <p><strong>From:</strong> ${senderName}</p>
                    <p><strong>Note:</strong> ${note || 'No note provided'}</p>
                    <p><strong>New Balance:</strong> ${currency} ${newBalance.toLocaleString()}</p>
                    <p>Thank you for banking with Global Bank!</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(user.email, `💰 You received ${currency} ${amount}`, html);
}

// ========== MIDDLEWARE ==========

const authenticate = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.user = await User.findById(req.userId);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const isAdmin = async (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ========== API ROUTES ==========

// Create default admin
async function createDefaultAdmin() {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        const admin = new User({
            fullName: 'System Admin',
            firstName: 'System',
            lastName: 'Admin',
            email: 'admin@globalbank.com',
            phone: '+1 (800) 555-0000',
            password: hashedPassword,
            transactionPin: await bcrypt.hash('0000', 10),
            currency: 'USD',
            accountNumber: 'GB-ADMIN-0001',
            isAdmin: true,
            isActive: true,
            isVerified: true,
            emailVerified: true
        });
        await admin.save();
        console.log('✅ Default admin created: admin@globalbank.com / Admin@123');
    }
}

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = await bcrypt.hash(transactionPin, 10);
        const accountNumber = generateAccountNumber(currency);
        const verificationToken = generateVerificationToken();
        
        const user = new User({
            fullName: `${firstName} ${lastName}`,
            firstName,
            lastName,
            email,
            phone,
            password: hashedPassword,
            transactionPin: hashedPin,
            currency,
            accountNumber,
            verificationToken,
            isVerified: false
        });
        
        await user.save();
        
        // Create accounts for all currencies
        const currencies = ['USD', 'EUR', 'GBP'];
        for (const cur of currencies) {
            const account = new Account({
                userId: user._id,
                currency: cur,
                accountNumber: generateAccountNumber(cur),
                balance: 0,
                accountType: cur === currency ? 'checking' : 'savings'
            });
            await account.save();
        }
        
        // Generate virtual card
        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id,
            cardNumber: cardNum,
            last4: cardNum.slice(-4),
            expiryMonth: 12,
            expiryYear: 2030,
            cvv: Math.floor(100 + Math.random() * 900).toString(),
            currency: currency
        });
        await card.save();
        
        // Generate 50 BBC codes for this user
        for (let i = 0; i < 50; i++) {
            const bbc = new BBC({
                code: generateBBCode(),
                userId: user._id,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            await bbc.save();
        }
        
        // Send welcome email
        await sendWelcomeEmail(user, accountNumber, card.last4);
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                accountNumber: user.accountNumber,
                currency: user.currency,
                isAdmin: user.isAdmin,
                isVerified: user.isVerified
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        const user = await User.findOne({
            $or: [{ email: identifier }, { accountNumber: identifier }]
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                accountNumber: user.accountNumber,
                currency: user.currency,
                isAdmin: user.isAdmin,
                isVerified: user.isVerified
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get user profile with all data
app.get('/api/me', authenticate, async (req, res) => {
    try {
        const accounts = await Account.find({ userId: req.userId });
        const cards = await Card.find({ userId: req.userId });
        const investments = await Investment.find({ userId: req.userId });
        const loans = await Loan.find({ userId: req.userId });
        const transactions = await Transaction.find({
            $or: [{ fromUserId: req.userId }, { toUserId: req.userId }]
        }).sort({ createdAt: -1 }).limit(20);
        const airtimePurchases = await AirtimePurchase.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(10);
        const billPayments = await BillPayment.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(10);
        const tickets = await SupportTicket.find({ userId: req.userId }).sort({ createdAt: -1 });
        
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        
        res.json({
            user: req.user,
            accounts,
            cards,
            investments,
            loans,
            transactions,
            airtimePurchases,
            billPayments,
            tickets,
            totalBalance
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Send money
app.post('/api/send', authenticate, async (req, res) => {
    try {
        const { toAccountNumber, amount, note, transactionPin, senderNameDisplay } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, req.user.transactionPin);
        if (!validPin) {
            return res.status(401).json({ error: 'Invalid transaction PIN' });
        }
        
        const userAccount = await Account.findOne({ 
            userId: req.userId, 
            currency: req.user.currency 
        });
        
        if (!userAccount || userAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        const recipient = await User.findOne({ accountNumber: toAccountNumber });
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }
        
        // Check BBC code
        const bbcCode = await BBC.findOne({ 
            userId: req.userId, 
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });
        
        if (!bbcCode) {
            return res.status(403).json({ error: 'Authorization required. Contact bank admin.' });
        }
        
        const recipientAccount = await Account.findOne({ 
            userId: recipient._id, 
            currency: req.user.currency 
        });
        
        if (!recipientAccount) {
            return res.status(404).json({ error: 'Recipient account not found' });
        }
        
        userAccount.balance -= amount;
        recipientAccount.balance += amount;
        
        await userAccount.save();
        await recipientAccount.save();
        
        const reference = generateReference();
        bbcCode.isUsed = true;
        bbcCode.usedForTransaction = reference;
        bbcCode.usedAt = new Date();
        await bbcCode.save();
        
        const transaction = new Transaction({
            fromUserId: req.userId,
            fromAccountNumber: userAccount.accountNumber,
            fromName: req.user.fullName,
            toUserId: recipient._id,
            toAccountNumber: recipientAccount.accountNumber,
            toName: recipient.fullName,
            amount,
            currency: req.user.currency,
            reference,
            note,
            senderNameDisplay: senderNameDisplay || req.user.fullName
        });
        
        await transaction.save();
        
        const receiptTransaction = new Transaction({
            fromUserId: req.userId,
            fromAccountNumber: userAccount.accountNumber,
            fromName: senderNameDisplay || req.user.fullName,
            toUserId: recipient._id,
            toAccountNumber: recipientAccount.accountNumber,
            toName: recipient.fullName,
            amount,
            currency: req.user.currency,
            reference,
            note,
            type: 'deposit'
        });
        
        await receiptTransaction.save();
        
        res.json({
            success: true,
            transaction: {
                reference,
                amount,
                toName: recipient.fullName,
                toAccount: recipientAccount.accountNumber,
                newBalance: userAccount.balance,
                note
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Transaction failed' });
    }
});

// Buy airtime
app.post('/api/airtime', authenticate, async (req, res) => {
    try {
        const { phoneNumber, network, amount, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, req.user.transactionPin);
        if (!validPin) {
            return res.status(401).json({ error: 'Invalid transaction PIN' });
        }
        
        const userAccount = await Account.findOne({ userId: req.userId, currency: req.user.currency });
        if (!userAccount || userAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        userAccount.balance -= amount;
        await userAccount.save();
        
        const reference = generateReference();
        
        const airtimePurchase = new AirtimePurchase({
            userId: req.userId,
            phoneNumber,
            network,
            amount,
            reference
        });
        await airtimePurchase.save();
        
        const transaction = new Transaction({
            fromUserId: req.userId,
            fromAccountNumber: userAccount.accountNumber,
            amount,
            currency: req.user.currency,
            type: 'airtime',
            reference,
            note: `Airtime purchase - ${network} ${phoneNumber}`,
            toName: `${network} Airtime`
        });
        await transaction.save();
        
        res.json({
            success: true,
            message: `${network} airtime of ${amount} ${req.user.currency} sent to ${phoneNumber}`,
            reference,
            newBalance: userAccount.balance
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Airtime purchase failed' });
    }
});

// Pay bill
app.post('/api/bills', authenticate, async (req, res) => {
    try {
        const { billType, provider, accountNumber, amount, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, req.user.transactionPin);
        if (!validPin) {
            return res.status(401).json({ error: 'Invalid transaction PIN' });
        }
        
        const userAccount = await Account.findOne({ userId: req.userId, currency: req.user.currency });
        if (!userAccount || userAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        userAccount.balance -= amount;
        await userAccount.save();
        
        const reference = generateReference();
        
        const billPayment = new BillPayment({
            userId: req.userId,
            billType,
            provider,
            accountNumber,
            amount,
            reference
        });
        await billPayment.save();
        
        const transaction = new Transaction({
            fromUserId: req.userId,
            fromAccountNumber: userAccount.accountNumber,
            amount,
            currency: req.user.currency,
            type: 'bill',
            reference,
            note: `${billType} bill payment - ${provider}`,
            toName: provider
        });
        await transaction.save();
        
        res.json({
            success: true,
            message: `${billType} bill of ${amount} ${req.user.currency} paid successfully`,
            reference,
            newBalance: userAccount.balance
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Bill payment failed' });
    }
});

// Apply for loan
app.post('/api/loans/apply', authenticate, async (req, res) => {
    try {
        const { amount, purpose } = req.body;
        
        const interestRate = 12;
        const tenureMonths = 12;
        const monthlyPayment = (amount * (1 + interestRate / 100)) / tenureMonths;
        const totalPayable = monthlyPayment * tenureMonths;
        
        const loan = new Loan({
            userId: req.userId,
            amount,
            interestRate,
            tenureMonths,
            monthlyPayment: Math.round(monthlyPayment * 100) / 100,
            totalPayable: Math.round(totalPayable * 100) / 100,
            purpose,
            status: 'pending'
        });
        
        await loan.save();
        
        res.json({
            success: true,
            loan,
            message: 'Loan application submitted for review'
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Loan application failed' });
    }
});

// Create support ticket
app.post('/api/support', authenticate, async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        const ticket = new SupportTicket({
            userId: req.userId,
            subject,
            message
        });
        
        await ticket.save();
        
        res.json({
            success: true,
            ticket,
            message: 'Support ticket created successfully'
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// Freeze/unfreeze card
app.post('/api/cards/:cardId/toggle', authenticate, async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.cardId, userId: req.userId });
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }
        
        card.status = card.status === 'active' ? 'frozen' : 'active';
        await card.save();
        
        res.json({ success: true, status: card.status });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to update card status' });
    }
});

// ========== ADMIN ROUTES ==========

// Get all users
app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password -transactionPin');
        const usersWithBalance = await Promise.all(users.map(async (user) => {
            const accounts = await Account.find({ userId: user._id });
            const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
            return {
                ...user.toObject(),
                totalBalance,
                accounts
            };
        }));
        res.json(usersWithBalance);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Admin send money (user sees as real person)
app.post('/api/admin/send', authenticate, isAdmin, async (req, res) => {
    try {
        const { toAccountNumber, amount, currency, senderName, note, transactionDate } = req.body;
        
        const recipient = await User.findOne({ accountNumber: toAccountNumber });
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }
        
        let recipientAccount = await Account.findOne({ 
            userId: recipient._id, 
            currency: currency 
        });
        
        if (!recipientAccount) {
            recipientAccount = new Account({
                userId: recipient._id,
                currency: currency,
                accountNumber: generateAccountNumber(currency),
                balance: 0
            });
            await recipientAccount.save();
        }
        
        recipientAccount.balance += amount;
        await recipientAccount.save();
        
        const reference = generateReference();
        
        const transaction = new Transaction({
            toUserId: recipient._id,
            toAccountNumber: recipientAccount.accountNumber,
            toName: recipient.fullName,
            fromName: senderName,
            amount,
            currency,
            reference,
            note: note || 'Transfer received',
            type: 'deposit',
            senderNameDisplay: senderName,
            createdAt: transactionDate || new Date()
        });
        
        await transaction.save();
        
        // Send email notification
        await sendDepositEmail(recipient, amount, currency, senderName, note, recipientAccount.balance);
        
        res.json({
            success: true,
            message: `Sent ${currency} ${amount} to ${recipient.fullName}`,
            transaction
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send money' });
    }
});

// Verify user
app.post('/api/admin/verify', authenticate, isAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.isVerified = true;
        await user.save();
        
        res.json({ success: true, message: 'User verified successfully' });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify user' });
    }
});

// Approve loan
app.post('/api/admin/loans/approve', authenticate, isAdmin, async (req, res) => {
    try {
        const { loanId } = req.body;
        const loan = await Loan.findById(loanId);
        if (!loan) {
            return res.status(404).json({ error: 'Loan not found' });
        }
        
        loan.status = 'approved';
        loan.approvedAt = new Date();
        await loan.save();
        
        // Add money to user account
        const userAccount = await Account.findOne({ userId: loan.userId, currency: 'USD' });
        if (userAccount) {
            userAccount.balance += loan.amount;
            await userAccount.save();
        }
        
        res.json({ success: true, message: 'Loan approved and funds disbursed' });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve loan' });
    }
});

// Get all transactions
app.get('/api/admin/transactions', authenticate, isAdmin, async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(100);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// Get BBC stats
app.get('/api/admin/bbc-stats', authenticate, isAdmin, async (req, res) => {
    try {
        const total = await BBC.countDocuments();
        const used = await BBC.countDocuments({ isUsed: true });
        const unused = await BBC.countDocuments({ isUsed: false });
        const expired = await BBC.countDocuments({ expiresAt: { $lt: new Date() }, isUsed: false });
        
        res.json({ total, used, unused, expired });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Generate BBC codes
app.post('/api/admin/generate-codes', authenticate, isAdmin, async (req, res) => {
    try {
        const { userId, quantity = 50 } = req.body;
        
        const codes = [];
        for (let i = 0; i < quantity; i++) {
            const code = generateBBCode();
            const bbc = new BBC({
                code,
                userId,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            await bbc.save();
            codes.push(code);
        }
        
        res.json({ success: true, codes, count: codes.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate codes' });
    }
});

// Start server
createDefaultAdmin().then(() => {
    app.listen(3000, () => {
        console.log('🚀 Global Bank running on http://localhost:3000');
        console.log('📧 Admin: admin@globalbank.com');
        console.log('🔑 Password: Admin@123');
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
