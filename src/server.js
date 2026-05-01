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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Email Transporter
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
    isUsed: { type: Boolean, default: false },
    expiresAt: Date
});

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const BBC = mongoose.model('BBC', BBCSchema);

// Helper Functions
function generateAccountNumber(currency) {
    const prefix = currency === 'USD' ? 'PHB-USA-' : currency === 'EUR' ? 'PHB-EU-' : 'PHB-UK-';
    return prefix + Math.floor(Math.random() * 9000 + 1000);
}

function generateCardNumber() {
    return '5532' + Math.random().toString().slice(2, 14);
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
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

// Welcome Email
async function sendWelcomeEmail(user, accountNumber, cardLast4) {
    const html = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0A1A2F, #0D2B3E); border-radius: 24px; overflow: hidden; border: 1px solid #D4AF37;">
            <div style="background: linear-gradient(135deg, #D4AF37, #B8860B); padding: 40px; text-align: center;">
                <div style="font-size: 48px;">👑</div>
                <h1 style="color: #0A1A2F; margin: 0;">Prime Heritage Bank</h1>
                <p style="color: #0A1A2F;">Welcome to Premium Banking</p>
            </div>
            <div style="padding: 40px; color: #E2E8F0;">
                <h2>Welcome, ${user.fullName}!</h2>
                <p>Your Heritage account has been successfully created.</p>
                <div style="background: rgba(212,175,55,0.1); border-radius: 16px; padding: 20px; margin: 20px 0; border: 1px solid rgba(212,175,55,0.3);">
                    <p><strong style="color: #D4AF37;">Account Number:</strong> ${accountNumber}</p>
                    <p><strong style="color: #D4AF37;">Currency:</strong> ${user.currency}</p>
                    <p><strong style="color: #D4AF37;">Virtual Card:</strong> •••• •••• •••• ${cardLast4}</p>
                </div>
                <a href="https://prime-heritage-bank.onrender.com" style="background: linear-gradient(135deg, #D4AF37, #B8860B); color: #0A1A2F; padding: 14px 28px; text-decoration: none; border-radius: 40px; display: inline-block; font-weight: bold;">Access Your Account →</a>
            </div>
            <div style="background: #0A1A2F; padding: 20px; text-align: center; border-top: 1px solid rgba(212,175,55,0.2);">
                <p style="color: #666; font-size: 12px;">🏦 Educational Simulation - No Real Money</p>
            </div>
        </div>
    `;
    return await sendEmail(user.email, 'Welcome to Prime Heritage Bank 👑', html);
}

// Receipt Email
async function sendReceiptEmail(user, transaction) {
    const html = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #0A1A2F, #0D2B3E); padding: 30px; text-align: center;">
                <div style="font-size: 40px;">🧾</div>
                <h2 style="color: #D4AF37;">Transaction Receipt</h2>
            </div>
            <div style="padding: 30px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="font-size: 36px; color: #D4AF37; font-weight: bold;">${transaction.currency} ${transaction.amount.toLocaleString()}</div>
                    <div style="color: #666;">Transaction Complete</div>
                </div>
                <div style="border-top: 2px dashed #E2E8F0; padding: 20px 0;">
                    <p><strong>Reference:</strong> ${transaction.reference}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>From:</strong> ${transaction.fromName || 'Prime Heritage Bank'}</p>
                    <p><strong>To:</strong> ${transaction.toName}</p>
                    <p><strong>Note:</strong> ${transaction.note || 'No note'}</p>
                </div>
                <div style="background: #F8FAFC; padding: 20px; border-radius: 16px; text-align: center;">
                    <p style="color: #666;">Thank you for banking with</p>
                    <p style="color: #D4AF37; font-weight: bold;">Prime Heritage Bank</p>
                </div>
            </div>
        </div>
    `;
    return await sendEmail(user.email, `Receipt for ${transaction.currency} ${transaction.amount}`, html);
}

// ========== API ROUTES ==========

// Create Admin
async function createAdmin() {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        const admin = new User({
            fullName: 'Heritage Admin', firstName: 'Heritage', lastName: 'Admin',
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

        // Create account
        const account = new Account({
            userId: user._id, currency, accountNumber: generateAccountNumber(currency),
            balance: 0, accountType: 'checking'
        });
        await account.save();

        // Create card
        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id, cardNumber: cardNum, last4: cardNum.slice(-4),
            expiryMonth: 12, expiryYear: 2030, cvv: Math.floor(100 + Math.random() * 900).toString()
        });
        await card.save();

        // Generate BBC codes
        for (let i = 0; i < 50; i++) {
            await new BBC({ code: generateBBCode(), userId: user._id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).save();
        }

        await sendWelcomeEmail(user, accountNumber, card.last4);

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email, accountNumber, currency, isAdmin: false } });

    } catch (error) {
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

    } catch (error) {
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
        const { toAccountNumber, amount, note, transactionPin, senderNameDisplay } = req.body;

        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        // Check BBC code
        const bbc = await BBC.findOne({ userId: user._id, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!bbc) return res.status(403).json({ error: 'Authorization required. Contact bank admin.' });

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
            fromUserId: user._id, fromAccountNumber: userAccount.accountNumber, fromName: user.fullName,
            toUserId: recipient._id, toAccountNumber: recipientAccount.accountNumber, toName: recipient.fullName,
            amount, currency: user.currency, reference, note, senderNameDisplay: senderNameDisplay || user.fullName
        });
        await transaction.save();

        // Send receipt email
        await sendReceiptEmail(user, transaction);
        await sendReceiptEmail(recipient, transaction);

        res.json({ success: true, transaction: { reference, amount, toName: recipient.fullName, newBalance: userAccount.balance } });

    } catch (error) {
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
        const { bankName, accountHolder, bankAccountNumber, amount, transactionPin, bbcCode } = req.body;

        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        // Verify BBC code
        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!bbc) return res.status(403).json({ error: 'Invalid or expired BBC code' });

        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

        userAccount.balance -= amount;
        await userAccount.save();

        bbc.isUsed = true;
        await bbc.save();

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, fromAccountNumber: userAccount.accountNumber, fromName: user.fullName,
            amount, currency: user.currency, type: 'withdrawal', reference,
            note: `Withdrawal to ${bankName} - ${bankAccountNumber}`,
            bankName, bankAccountNumber, toName: accountHolder
        });
        await transaction.save();

        // Send withdrawal confirmation email
        await sendEmail(user.email, `Withdrawal Confirmation - ${reference}`, `
            <div style="font-family: Georgia, serif;">
                <h2>Withdrawal Initiated</h2>
                <p>Amount: ${user.currency} ${amount}</p>
                <p>To: ${bankName} - ${bankAccountNumber}</p>
                <p>Reference: ${reference}</p>
                <p>Funds will reflect in 1-2 business days.</p>
            </div>
        `);

        res.json({ success: true, message: 'Withdrawal initiated', reference, newBalance: userAccount.balance });

    } catch (error) {
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

        await sendEmail(user.email, 'Airtime Purchase', `<p>${network} airtime of ${user.currency} ${amount} sent to ${phoneNumber}. Reference: ${reference}</p>`);

        res.json({ success: true, message: 'Airtime purchased', reference, newBalance: userAccount.balance });

    } catch (error) {
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

    await sendEmail(recipient.email, 'Funds Received', `<p>${senderName} sent you ${currency} ${amount}. Reference: ${reference}</p>`);

    res.json({ success: true, message: `Sent ${amount} ${currency} to ${recipient.fullName}` });
});

app.post('/api/admin/generate-codes', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { userId, quantity = 50 } = req.body;
    const codes = [];
    for (let i = 0; i < quantity; i++) {
        const code = generateBBCode();
        await new BBC({ code, userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).save();
        codes.push(code);
    }
    res.json({ success: true, codes });
});

app.get('/api/admin/bbc-stats', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const total = await BBC.countDocuments();
    const used = await BBC.countDocuments({ isUsed: true });
    const unused = await BBC.countDocuments({ isUsed: false });
    res.json({ total, used, unused });
});

createAdmin();
app.listen(3000, () => console.log('👑 Prime Heritage Bank running on http://localhost:3000'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
