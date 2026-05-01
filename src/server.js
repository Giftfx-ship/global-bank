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
    secret: process.env.SESSION_SECRET || 'heritage_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// ========== MODELS ==========

const UserSchema = new mongoose.Schema({
    fullName: String, firstName: String, lastName: String,
    email: { type: String, unique: true }, phone: String,
    password: String, transactionPin: String,
    currency: { type: String, enum: ['USD', 'EUR', 'GBP'] },
    accountNumber: { type: String, unique: true },
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    currency: String, accountNumber: String,
    balance: { type: Number, default: 0 },
    accountType: { type: String, default: 'checking' }
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
    note: String, senderNameDisplay: String,
    bankName: String, bankAccountNumber: String,
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    cardNumber: String, last4: String,
    expiryMonth: Number, expiryYear: Number,
    cvv: String, type: String, status: { type: String, default: 'active' }
});

const BBCSchema = new mongoose.Schema({
    code: String, userId: mongoose.Schema.Types.ObjectId,
    step: { type: Number, default: 1 },
    isUsed: { type: Boolean, default: false },
    usedForTransaction: String,
    expiresAt: Date
});

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const BBC = mongoose.model('BBC', BBCSchema);

// ========== HELPERS ==========

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

// Send Email
async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"Prime Heritage Bank" <${process.env.EMAIL_USER}>`,
            to, subject, html
        });
        return true;
    } catch(e) { return false; }
}

// ========== ROUTES ==========

// Create Admin
async function createAdmin() {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        const admin = new User({
            fullName: 'System Administrator', firstName: 'System', lastName: 'Admin',
            email: 'admin@primeheritage.com', phone: '+1 (800) 555-0000',
            password: hashedPassword, transactionPin: await bcrypt.hash('0000', 10),
            currency: 'USD', accountNumber: 'PHB-ADMIN-001', isAdmin: true
        });
        await admin.save();
        console.log('✅ Admin created: admin@primeheritage.com / Admin@123');
    }
}

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = await bcrypt.hash(transactionPin, 10);
        const accountNumber = generateAccountNumber(currency);

        const user = new User({
            fullName: `${firstName} ${lastName}`, firstName, lastName,
            email, phone, password: hashedPassword,
            transactionPin: hashedPin, currency, accountNumber
        });
        await user.save();

        const account = new Account({
            userId: user._id, currency, accountNumber: generateAccountNumber(currency),
            balance: 0, accountType: 'checking'
        });
        await account.save();

        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id, cardNumber: cardNum, last4: cardNum.slice(-4),
            expiryMonth: 12, expiryYear: 2030, cvv: Math.floor(100 + Math.random() * 900).toString()
        });
        await card.save();

        // Generate BBC codes for all 3 steps
        for (let i = 1; i <= 3; i++) {
            for (let j = 0; j < 50; j++) {
                await new BBC({
                    code: generateBBCode(),
                    userId: user._id,
                    step: i,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }).save();
            }
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email, accountNumber, currency, isAdmin: false } });

    } catch(e) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { accountNumber: identifier }] });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email: user.email, accountNumber: user.accountNumber, currency: user.currency, isAdmin: user.isAdmin } });

    } catch(e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get Profile
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const accounts = await Account.find({ userId: user._id });
        const cards = await Card.find({ userId: user._id });
        const transactions = await Transaction.find({ $or: [{ fromUserId: user._id }, { toUserId: user._id }] }).sort({ createdAt: -1 }).limit(20);
        const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
        res.json({ user, accounts, cards, transactions, totalBalance });
    } catch(e) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Send Money - 3 STEP HIDDEN BBC
app.post('/api/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { toAccountNumber, amount, note, transactionPin } = req.body;

        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        // Check STEP 1 BBC code exists
        let bbc1 = await BBC.findOne({ userId: user._id, step: 1, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!bbc1) return res.status(403).json({ error: 'Transaction authorization pending. Please wait.' });

        // Check STEP 2 BBC code exists
        let bbc2 = await BBC.findOne({ userId: user._id, step: 2, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!bbc2) return res.status(403).json({ error: 'Second authorization required. Please wait.' });

        // Check STEP 3 BBC code exists
        let bbc3 = await BBC.findOne({ userId: user._id, step: 3, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!bbc3) return res.status(403).json({ error: 'Final authorization required. Please wait.' });

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

        // Mark all 3 BBC codes as used
        bbc1.isUsed = true;
        bbc2.isUsed = true;
        bbc3.isUsed = true;
        await bbc1.save();
        await bbc2.save();
        await bbc3.save();

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, fromAccountNumber: userAccount.accountNumber, fromName: user.fullName,
            toUserId: recipient._id, toAccountNumber: recipientAccount.accountNumber, toName: recipient.fullName,
            amount, currency: user.currency, reference, note
        });
        await transaction.save();

        res.json({ success: true, transaction: { reference, amount, toName: recipient.fullName, newBalance: userAccount.balance } });

    } catch(e) {
        res.status(500).json({ error: 'Transaction failed' });
    }
});

// Withdraw
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
            fromUserId: user._id, amount, currency: user.currency, type: 'withdrawal',
            reference, note: `Withdrawal to ${bankName} - ${bankAccountNumber}`,
            bankName, bankAccountNumber, toName: accountHolder
        });
        await transaction.save();

        res.json({ success: true, reference, newBalance: userAccount.balance });

    } catch(e) {
        res.status(500).json({ error: 'Withdrawal failed' });
    }
});

// Airtime
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
            fromUserId: user._id, amount, currency: user.currency, type: 'airtime',
            reference, note: `${network} airtime to ${phoneNumber}`, toName: `${network} Airtime`
        });
        await transaction.save();

        res.json({ success: true, reference, newBalance: userAccount.balance });

    } catch(e) {
        res.status(500).json({ error: 'Airtime purchase failed' });
    }
});

// Admin Routes
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

app.post('/api/admin/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { toAccountNumber, amount, currency, senderName, note } = req.body;
    const recipient = await User.findOne({ accountNumber: toAccountNumber });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    let recipientAccount = await Account.findOne({ userId: recipient._id, currency });
    if (!recipientAccount) {
        recipientAccount = new Account({ userId: recipient._id, currency, accountNumber: generateAccountNumber(currency), balance: 0 });
        await recipientAccount.save();
    }

    recipientAccount.balance += amount;
    await recipientAccount.save();

    const reference = generateReference();
    const transaction = new Transaction({
        toUserId: recipient._id, toAccountNumber: recipientAccount.accountNumber, toName: recipient.fullName,
        fromName: senderName, amount, currency, reference, note, type: 'deposit'
    });
    await transaction.save();

    res.json({ success: true, message: `Sent ${currency} ${amount} to ${recipient.fullName}` });
});

app.get('/api/admin/bbc-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const pendingStep1 = await BBC.countDocuments({ isUsed: false, step: 1 });
    const pendingStep2 = await BBC.countDocuments({ isUsed: false, step: 2 });
    const pendingStep3 = await BBC.countDocuments({ isUsed: false, step: 3 });
    res.json({ pendingStep1, pendingStep2, pendingStep3 });
});

createAdmin();
app.listen(3000, () => console.log('👑 Prime Heritage Bank running on http://localhost:3000'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
