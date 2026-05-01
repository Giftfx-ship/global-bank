require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'prime_heritage_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

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
    currency: String, accountNumber: { type: String, unique: true },
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
    note: String,
    bankName: String, bankAccountNumber: String, accountHolder: String,
    step1Code: String, step2Code: String, step3Code: String,
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cardNumber: String, last4: String,
    expiryMonth: Number, expiryYear: Number,
    cvv: String, type: String, status: { type: String, default: 'active' }
});

const BBCSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    step: { type: Number, default: 1 },
    isUsed: { type: Boolean, default: false },
    usedForTransaction: String,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
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
const BBC = mongoose.model('BBC', BBCSchema);
const SupportMessage = mongoose.model('SupportMessage', SupportMessageSchema);

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

// ========== AUTH ROUTES ==========

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
            currency, accountNumber
        });
        await user.save();

        // Create accounts for all currencies
        const currencies = ['USD', 'EUR', 'GBP'];
        for (const cur of currencies) {
            await new Account({
                userId: user._id,
                currency: cur,
                accountNumber: generateAccountNumber(cur),
                balance: 0,
                accountType: cur === currency ? 'checking' : 'savings'
            }).save();
        }

        // Create virtual card
        const cardNum = generateCardNumber();
        await new Card({
            userId: user._id,
            cardNumber: cardNum,
            last4: cardNum.slice(-4),
            expiryMonth: 12,
            expiryYear: 2030,
            cvv: Math.floor(100 + Math.random() * 900).toString()
        }).save();

        // Generate 3 steps of BBC codes (50 each step)
        for (let step = 1; step <= 3; step++) {
            for (let i = 0; i < 50; i++) {
                await new BBC({
                    code: generateBBCode(),
                    userId: user._id,
                    step: step,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }).save();
            }
        }

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
        res.status(500).json({ error: 'Registration failed' });
    }
});

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

// ========== 3-STEP BBC WITHDRAWAL ==========

// Step 1: Initiate withdrawal with PIN
app.post('/api/withdraw/step1', async (req, res) => {
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

        // Check for STEP 1 BBC code
        const step1Bbc = await BBC.findOne({ userId: user._id, step: 1, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!step1Bbc) return res.status(403).json({ error: 'No BBC codes available. Contact admin.' });

        // Create temporary transaction record
        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id,
            amount, currency: user.currency, type: 'withdrawal',
            reference, status: 'pending',
            bankName, bankAccountNumber, accountHolder,
            step1Code: step1Bbc.code
        });
        await transaction.save();

        res.json({
            success: true,
            step: 1,
            reference,
            message: 'Step 1: BBC Code 1 required for verification',
            requiresBBC: true
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to initiate withdrawal' });
    }
});

// Step 2: Verify BBC Code 1
app.post('/api/withdraw/step2', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode1 } = req.body;

        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // Verify BBC Code 1
        const bbc1 = await BBC.findOne({ code: bbcCode1, userId: user._id, step: 1, isUsed: false });
        if (!bbc1) return res.status(403).json({ error: 'Invalid BBC Code 1' });

        // Mark BBC as used
        bbc1.isUsed = true;
        await bbc1.save();

        transaction.step1Code = bbcCode1;
        await transaction.save();

        // Get step 2 BBC code ready
        const step2Bbc = await BBC.findOne({ userId: user._id, step: 2, isUsed: false, expiresAt: { $gt: new Date() } });
        
        res.json({
            success: true,
            step: 2,
            reference,
            message: 'Step 2: BBC Code 2 required for authorization',
            requiresBBC2: true,
            bbc2Hint: step2Bbc ? `BBC Code 2 is ready. Enter the code provided by admin.` : 'No BBC Code 2 available. Contact admin.'
        });

    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Step 3: Verify BBC Code 2
app.post('/api/withdraw/step3', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode2 } = req.body;

        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // Verify BBC Code 2
        const bbc2 = await BBC.findOne({ code: bbcCode2, userId: user._id, step: 2, isUsed: false });
        if (!bbc2) return res.status(403).json({ error: 'Invalid BBC Code 2' });

        bbc2.isUsed = true;
        await bbc2.save();

        transaction.step2Code = bbcCode2;
        await transaction.save();

        // Get step 3 BBC code ready
        const step3Bbc = await BBC.findOne({ userId: user._id, step: 3, isUsed: false, expiresAt: { $gt: new Date() } });
        
        res.json({
            success: true,
            step: 3,
            reference,
            message: 'Step 3: Final BBC Code 3 required to complete withdrawal',
            requiresBBC3: true
        });

    } catch (error) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Step 4: Final - Verify BBC Code 3 and complete withdrawal
app.post('/api/withdraw/step4', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode3 } = req.body;

        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // Verify BBC Code 3
        const bbc3 = await BBC.findOne({ code: bbcCode3, userId: user._id, step: 3, isUsed: false });
        if (!bbc3) return res.status(403).json({ error: 'Invalid BBC Code 3' });

        // Process withdrawal
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        userAccount.balance -= transaction.amount;
        await userAccount.save();

        bbc3.isUsed = true;
        await bbc3.save();

        transaction.step3Code = bbcCode3;
        transaction.status = 'completed';
        await transaction.save();

        res.json({
            success: true,
            message: 'Withdrawal completed successfully!',
            reference,
            amount: transaction.amount,
            currency: transaction.currency,
            bankName: transaction.bankName,
            newBalance: userAccount.balance
        });

    } catch (error) {
        res.status(500).json({ error: 'Withdrawal failed' });
    }
});

// ========== SEND MONEY (3-Step BBC) ==========

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

        const recipient = await User.findOne({ accountNumber: toAccountNumber });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

        const step1Bbc = await BBC.findOne({ userId: user._id, step: 1, isUsed: false, expiresAt: { $gt: new Date() } });
        if (!step1Bbc) return res.status(403).json({ error: 'No BBC codes available' });

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id,
            fromAccountNumber: userAccount.accountNumber,
            toUserId: recipient._id,
            toName: recipient.fullName,
            amount, currency: user.currency, type: 'transfer',
            reference, status: 'pending', note,
            step1Code: step1Bbc.code
        });
        await transaction.save();

        res.json({ success: true, step: 1, reference, message: 'Step 1: Enter BBC Code 1' });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
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

        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, step: 1, isUsed: false });
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 1' });

        bbc.isUsed = true;
        await bbc.save();

        res.json({ success: true, step: 2, reference, message: 'Step 2: Enter BBC Code 2' });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
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

        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, step: 2, isUsed: false });
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 2' });

        bbc.isUsed = true;
        await bbc.save();

        res.json({ success: true, step: 3, reference, message: 'Step 3: Enter BBC Code 3 to complete' });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
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

        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, step: 3, isUsed: false });
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 3' });

        // Process transfer
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        const recipientAccount = await Account.findOne({ userId: transaction.toUserId, currency: user.currency });

        userAccount.balance -= transaction.amount;
        recipientAccount.balance += transaction.amount;
        await userAccount.save();
        await recipientAccount.save();

        bbc.isUsed = true;
        await bbc.save();

        transaction.status = 'completed';
        await transaction.save();

        res.json({ success: true, message: 'Transfer completed!', reference, amount: transaction.amount, newBalance: userAccount.balance });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// ========== AIRTIME (3-Step BBC) ==========

app.post('/api/airtime/step1', async (req, res) => {
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

        const step1Bbc = await BBC.findOne({ userId: user._id, step: 1, isUsed: false });
        if (!step1Bbc) return res.status(403).json({ error: 'No BBC codes available' });

        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id,
            amount, currency: user.currency, type: 'airtime',
            reference, status: 'pending', note: `${network} airtime to ${phoneNumber}`,
            step1Code: step1Bbc.code
        });
        await transaction.save();

        res.json({ success: true, step: 1, reference, message: 'Step 1: Enter BBC Code 1' });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/airtime/step2', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode } = req.body;

        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, step: 1, isUsed: false });
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 1' });

        bbc.isUsed = true;
        await bbc.save();

        res.json({ success: true, step: 2, reference, message: 'Step 2: Enter BBC Code 2' });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/airtime/step3', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode } = req.body;

        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, step: 2, isUsed: false });
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 2' });

        bbc.isUsed = true;
        await bbc.save();

        res.json({ success: true, step: 3, reference, message: 'Step 3: Enter BBC Code 3 to complete' });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/airtime/step4', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { reference, bbcCode } = req.body;

        const transaction = await Transaction.findOne({ reference, fromUserId: user._id, status: 'pending' });
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        const bbc = await BBC.findOne({ code: bbcCode, userId: user._id, step: 3, isUsed: false });
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 3' });

        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        userAccount.balance -= transaction.amount;
        await userAccount.save();

        bbc.isUsed = true;
        await bbc.save();

        transaction.status = 'completed';
        await transaction.save();

        res.json({ success: true, message: 'Airtime purchased!', reference, amount: transaction.amount, newBalance: userAccount.balance });

    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// ========== SUPPORT ROUTES ==========

app.post('/api/support', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { subject, message } = req.body;

        const support = new SupportMessage({
            userId: user._id,
            name: user.fullName,
            email: user.email,
            subject, message
        });
        await support.save();

        res.json({ success: true, message: 'Support ticket submitted! We will respond within 24 hours.' });

    } catch (error) {
        res.status(500).json({ error: 'Failed to submit ticket' });
    }
});

app.get('/api/support/tickets', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tickets = await SupportMessage.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get tickets' });
    }
});

// ========== PROFILE ROUTES ==========

app.post('/api/update-password', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { currentPassword, newPassword } = req.body;
        
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update password' });
    }
});

app.post('/api/update-pin', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { currentPin, newPin } = req.body;
        
        const valid = await bcrypt.compare(currentPin, user.transactionPin);
        if (!valid) return res.status(401).json({ error: 'Current PIN is incorrect' });
        
        user.transactionPin = await bcrypt.hash(newPin, 10);
        await user.save();
        res.json({ success: true, message: 'PIN updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update PIN' });
    }
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

app.get('/api/admin/bbc/:userId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const codes = await BBC.find({ userId: req.params.userId, isUsed: false }).select('code step expiresAt');
    res.json(codes);
});

app.post('/api/admin/generate-bbc', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { userId, step = 1, quantity = 10 } = req.body;
    const codes = [];
    for (let i = 0; i < quantity; i++) {
        const code = generateBBCode();
        await new BBC({ code, userId, step, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).save();
        codes.push(code);
    }
    res.json({ success: true, codes });
});

// Create default admin
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

createAdmin();
app.listen(3000, () => console.log('👑 Prime Heritage Bank running on http://localhost:3000'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
