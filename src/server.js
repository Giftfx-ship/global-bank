require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'prime_heritage_secure_session',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
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
    .then(() => console.log('✅ Prime Heritage Bank - MongoDB Connected'))
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
    currency: { type: String, enum: ['USD', 'EUR', 'GBP'], required: true },
    accountNumber: { type: String, unique: true },
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true },
    accountNumber: { type: String, unique: true },
    balance: { type: Number, default: 0 },
    accountType: { type: String, default: 'checking' }
});

const TransactionSchema = new mongoose.Schema({
    fromUserId: mongoose.Schema.Types.ObjectId,
    fromAccountNumber: String,
    fromName: String,
    toUserId: mongoose.Schema.Types.ObjectId,
    toAccountNumber: String,
    toName: String,
    amount: Number,
    currency: String,
    type: { type: String, default: 'transfer' },
    status: { type: String, default: 'completed' },
    reference: { type: String, unique: true },
    note: String,
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cardNumber: String,
    last4: String,
    expiryMonth: Number,
    expiryYear: Number,
    cvv: String,
    type: { type: String, default: 'virtual' },
    status: { type: String, default: 'active' }
});

const BBCSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isUsed: { type: Boolean, default: false },
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const BBC = mongoose.model('BBC', BBCSchema);

// ========== HELPER FUNCTIONS ==========

function generateAccountNumber(currency) {
    const prefix = currency === 'USD' ? 'PHB-USA-' : currency === 'EUR' ? 'PHB-EU-' : 'PHB-UK-';
    return prefix + Math.floor(Math.random() * 9000 + 1000);
}

function generateCardNumber() {
    return '4532' + Math.random().toString().slice(2, 14);
}

function generateReference() {
    return 'PHB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function generateBBCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send Email Function
async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"Prime Heritage Bank" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log(`📧 Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

// Send Welcome Email (After Registration)
async function sendWelcomeEmail(user, accountNumber, cardLast4) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to Prime Heritage Bank</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 40px; }
                .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .header { background: #0A2540; padding: 32px; text-align: center; }
                .header h1 { color: #C6A43F; margin: 0; font-size: 28px; font-weight: 600; }
                .content { padding: 32px; }
                .greeting { font-size: 18px; color: #0A2540; margin-bottom: 16px; }
                .details { background: #F5F7FA; border-radius: 12px; padding: 20px; margin: 24px 0; }
                .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
                .detail-label { color: #64748B; }
                .detail-value { color: #0A2540; font-weight: 600; }
                .footer { background: #F5F7FA; padding: 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
                .btn { display: inline-block; background: #C6A43F; color: #0A2540; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Prime Heritage Bank</h1>
                    <p>Welcome to Premium Banking</p>
                </div>
                <div class="content">
                    <div class="greeting">Welcome, ${user.firstName}!</div>
                    <p>Your account has been successfully created and activated.</p>
                    <div class="details">
                        <div class="detail-row"><span class="detail-label">Account Number:</span><span class="detail-value">${accountNumber}</span></div>
                        <div class="detail-row"><span class="detail-label">Account Type:</span><span class="detail-value">Heritage Premium Checking</span></div>
                        <div class="detail-row"><span class="detail-label">Virtual Card:</span><span class="detail-value">•••• •••• •••• ${cardLast4}</span></div>
                        <div class="detail-row"><span class="detail-label">Initial Balance:</span><span class="detail-value">${user.currency} 0.00</span></div>
                    </div>
                    <p>To start banking, log in to your account.</p>
                    <div style="text-align: center;">
                        <a href="https://global-bank-n6c3.onrender.com" class="btn">Access Your Account</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Prime Heritage Bank - Your World. Your Money.</p>
                    <p>© 2025 Prime Heritage Bank. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(user.email, 'Welcome to Prime Heritage Bank', html);
}

// Send Transaction Receipt Email
async function sendTransactionEmail(user, transaction, type) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Transaction Receipt</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 40px; }
                .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .header { background: #0A2540; padding: 24px; text-align: center; }
                .header h2 { color: #C6A43F; margin: 0; }
                .content { padding: 32px; }
                .amount { font-size: 32px; color: #0A2540; font-weight: 700; text-align: center; margin: 20px 0; }
                .details { background: #F5F7FA; border-radius: 12px; padding: 20px; margin: 20px 0; }
                .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
                .footer { background: #F5F7FA; padding: 20px; text-align: center; font-size: 12px; color: #64748B; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Transaction Receipt</h2>
                </div>
                <div class="content">
                    <div class="amount">${transaction.currency} ${transaction.amount.toLocaleString()}</div>
                    <div class="details">
                        <div class="detail-row"><span>Status:</span><span style="color:#10B981;">Completed</span></div>
                        <div class="detail-row"><span>Reference:</span><span>${transaction.reference}</span></div>
                        <div class="detail-row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
                        <div class="detail-row"><span>Type:</span><span>${type}</span></div>
                        ${transaction.toName ? `<div class="detail-row"><span>To:</span><span>${transaction.toName}</span></div>` : ''}
                        ${transaction.fromName ? `<div class="detail-row"><span>From:</span><span>${transaction.fromName}</span></div>` : ''}
                        ${transaction.note ? `<div class="detail-row"><span>Note:</span><span>${transaction.note}</span></div>` : ''}
                    </div>
                </div>
                <div class="footer">
                    <p>Prime Heritage Bank</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(user.email, `Transaction Receipt - ${transaction.reference}`, html);
}

// ========== API ROUTES ==========

// Register - Direct account creation with welcome email
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = await bcrypt.hash(transactionPin, 10);
        const accountNumber = generateAccountNumber(currency);

        const user = new User({
            fullName: `${firstName} ${lastName}`,
            firstName, lastName, email, phone,
            password: hashedPassword,
            transactionPin: hashedPin,
            currency, accountNumber,
            isActive: true
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

        // Create virtual card
        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id,
            cardNumber: cardNum,
            last4: cardNum.slice(-4),
            expiryMonth: 12,
            expiryYear: 2030,
            cvv: Math.floor(100 + Math.random() * 900).toString()
        });
        await card.save();

        // Generate BBC codes for user
        for (let i = 0; i < 50; i++) {
            await new BBC({
                code: generateBBCode(),
                userId: user._id,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }).save();
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
                isAdmin: user.isAdmin
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
        
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

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
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get User Profile
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const accounts = await Account.find({ userId: user._id });
        const cards = await Card.find({ userId: user._id });
        const transactions = await Transaction.find({
            $or: [{ fromUserId: user._id }, { toUserId: user._id }]
        }).sort({ createdAt: -1 }).limit(20);
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        
        res.json({ user, accounts, cards, transactions, totalBalance });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Send Money
app.post('/api/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { toAccountNumber, amount, note, transactionPin } = req.body;

        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        // Check for available BBC code
        const bbc = await BBC.findOne({ userId: user._id, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!bbc) return res.status(403).json({ error: 'Transaction authorization required. Contact bank admin.' });

        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

        const recipient = await User.findOne({ accountNumber: toAccountNumber });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

        const recipientAccount = await Account.findOne({ userId: recipient._id, currency: user.currency });
        if (!recipientAccount) return res.status(404).json({ error: 'Recipient account not found' });

        // Process transaction
        userAccount.balance -= amount;
        recipientAccount.balance += amount;
        await userAccount.save();
        await recipientAccount.save();

        bbc.isUsed = true;
        await bbc.save();

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id,
            fromAccountNumber: userAccount.accountNumber,
            fromName: user.fullName,
            toUserId: recipient._id,
            toAccountNumber: recipientAccount.accountNumber,
            toName: recipient.fullName,
            amount,
            currency: user.currency,
            reference,
            note
        });
        await transaction.save();

        // Send receipt emails to both parties
        await sendTransactionEmail(user, transaction, 'Sent');
        await sendTransactionEmail(recipient, transaction, 'Received');

        res.json({
            success: true,
            transaction: {
                reference,
                amount,
                toName: recipient.fullName,
                newBalance: userAccount.balance
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Transaction failed' });
    }
});

// Withdraw to Bank
app.post('/api/withdraw', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { bankName, accountHolder, bankAccountNumber, amount, transactionPin } = req.body;

        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

        userAccount.balance -= amount;
        await userAccount.save();

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id,
            amount,
            currency: user.currency,
            type: 'withdrawal',
            reference,
            note: `Withdrawal to ${bankName} - ${bankAccountNumber}`,
            toName: accountHolder
        });
        await transaction.save();

        await sendTransactionEmail(user, transaction, 'Withdrawal');

        res.json({ success: true, reference, newBalance: userAccount.balance });

    } catch (error) {
        res.status(500).json({ error: 'Withdrawal failed' });
    }
});

// Airtime Purchase
app.post('/api/airtime', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { phoneNumber, network, amount, transactionPin } = req.body;

        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

        userAccount.balance -= amount;
        await userAccount.save();

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id,
            amount,
            currency: user.currency,
            type: 'airtime',
            reference,
            note: `${network} airtime to ${phoneNumber}`,
            toName: `${network} Airtime`
        });
        await transaction.save();

        await sendTransactionEmail(user, transaction, 'Airtime Purchase');

        res.json({ success: true, reference, newBalance: userAccount.balance });

    } catch (error) {
        res.status(500).json({ error: 'Airtime purchase failed' });
    }
});

// ========== ADMIN ROUTES ==========

// Get all users
app.get('/api/admin/users', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const users = await User.find({}, '-password -transactionPin');
        const usersWithBalance = await Promise.all(users.map(async (u) => {
            const accounts = await Account.find({ userId: u._id });
            const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
            return { ...u.toObject(), totalBalance };
        }));
        res.json(usersWithBalance);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Admin send money to user
app.post('/api/admin/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const { toAccountNumber, amount, currency, senderName, note } = req.body;
        
        const recipient = await User.findOne({ accountNumber: toAccountNumber });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

        let recipientAccount = await Account.findOne({ userId: recipient._id, currency });
        if (!recipientAccount) {
            recipientAccount = new Account({
                userId: recipient._id,
                currency,
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
            note,
            type: 'deposit'
        });
        await transaction.save();

        await sendTransactionEmail(recipient, transaction, 'Deposit');

        res.json({ success: true, message: `Sent ${currency} ${amount} to ${recipient.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send money' });
    }
});

// Get BBC codes for a user
app.get('/api/admin/bbc/:userId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const codes = await BBC.find({ userId: req.params.userId, isUsed: false }).select('code expiresAt');
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get BBC codes' });
    }
});

// Generate BBC codes for user
app.post('/api/admin/generate-bbc', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const { userId, quantity = 50 } = req.body;
        const codes = [];
        
        for (let i = 0; i < quantity; i++) {
            const code = generateBBCode();
            await new BBC({
                code,
                userId,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }).save();
            codes.push(code);
        }
        
        res.json({ success: true, codes });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate codes' });
    }
});

// Get BBC stats
app.get('/api/admin/bbc-stats', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const total = await BBC.countDocuments();
        const used = await BBC.countDocuments({ isUsed: true });
        const unused = await BBC.countDocuments({ isUsed: false });
        
        res.json({ total, used, unused });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Toggle user status (freeze/activate)
app.post('/api/admin/toggle-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isActive = !user.isActive;
        await user.save();

        res.json({ success: true, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});

// Create default admin
async function createAdmin() {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        const admin = new User({
            fullName: 'System Administrator',
            firstName: 'System',
            lastName: 'Admin',
            email: 'admin@primeheritage.com',
            phone: '+1 (800) 555-0000',
            password: hashedPassword,
            transactionPin: await bcrypt.hash('0000', 10),
            currency: 'USD',
            accountNumber: 'PHB-ADMIN-001',
            isAdmin: true
        });
        await admin.save();
        console.log('✅ Admin created: admin@primeheritage.com / Admin@123');
    }
}

createAdmin();
app.listen(3000, () => console.log('👑 Prime Heritage Bank running on http://localhost:3000'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
