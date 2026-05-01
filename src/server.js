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
    iban: { type: String, unique: true },
    swiftCode: String,
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    currency: String, accountNumber: String, iban: String,
    balance: { type: Number, default: 0 },
    accountType: { type: String, default: 'checking' }
});

const TransactionSchema = new mongoose.Schema({
    fromUserId: mongoose.Schema.Types.ObjectId,
    fromAccountNumber: String, fromName: String,
    toUserId: mongoose.Schema.Types.ObjectId,
    toAccountNumber: String, toName: String,
    amount: Number, currency: String,
    type: { type: String, enum: ['transfer', 'deposit', 'withdrawal', 'airtime', 'data', 'bill', 'loan'], default: 'transfer' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    reference: { type: String, unique: true },
    note: String,
    phoneNumber: String, network: String, dataPlan: String, dataSize: String,
    billType: String, provider: String, billAccountNumber: String,
    bankName: String, bankAccountNumber: String, routingNumber: String,
    createdAt: { type: Date, default: Date.now }
});

const CardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cardNumber: String, last4: String,
    expiryMonth: Number, expiryYear: Number,
    cvv: String, type: String, status: { type: String, default: 'active' },
    dailyLimit: { type: Number, default: 5000 }
});

const LoanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number, purpose: String,
    interestRate: Number, tenureMonths: Number,
    monthlyPayment: Number, totalPayable: Number,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'active', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const AirtimePurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    phoneNumber: String, network: String, amount: Number,
    countryCode: String, reference: String,
    createdAt: { type: Date, default: Date.now }
});

const DataPlanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    phoneNumber: String, network: String,
    planName: String, dataSize: String, amount: Number,
    reference: String, createdAt: { type: Date, default: Date.now }
});

const BillPaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    billType: String, provider: String, accountNumber: String,
    amount: Number, reference: String, createdAt: { type: Date, default: Date.now }
});

const SupportMessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String, email: String, subject: String, message: String,
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

const User = mongoose.model('User', UserSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Card = mongoose.model('Card', CardSchema);
const Loan = mongoose.model('Loan', LoanSchema);
const AirtimePurchase = mongoose.model('AirtimePurchase', AirtimePurchaseSchema);
const DataPlan = mongoose.model('DataPlan', DataPlanSchema);
const BillPayment = mongoose.model('BillPayment', BillPaymentSchema);
const SupportMessage = mongoose.model('SupportMessage', SupportMessageSchema);
const BBC = mongoose.model('BBC', BBCSchema);

// ========== DOPE ACCOUNT NUMBER GENERATOR ==========
// Format: PHB-USA-1234-5678-9012 or PHB-EU-1234-5678-9012 or PHB-UK-1234-5678-9012

function generateAccountNumber(currency) {
    const prefix = currency === 'USD' ? 'PHB-USA' : currency === 'EUR' ? 'PHB-EU' : 'PHB-UK';
    const part1 = Math.floor(Math.random() * 9000 + 1000);
    const part2 = Math.floor(Math.random() * 9000 + 1000);
    const part3 = Math.floor(Math.random() * 9000 + 1000);
    return `${prefix}-${part1}-${part2}-${part3}`;
}

function generateIBAN(currency, accountNumber) {
    // IBAN format: Country code + 2 check digits + account number (without dashes)
    const countryCode = currency === 'USD' ? 'US' : currency === 'EUR' ? 'DE' : 'GB';
    const checkDigits = Math.floor(Math.random() * 90 + 10);
    const cleanAccount = accountNumber.replace(/[^0-9]/g, '');
    return `${countryCode}${checkDigits}${cleanAccount}`;
}

function generateSWIFTCode(currency) {
    const bankCode = 'PHBG';
    const countryCode = currency === 'USD' ? 'US' : currency === 'EUR' ? 'DE' : 'GB';
    const location = '33';
    const branch = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${bankCode}${countryCode}${location}${branch}`;
}

function generateCardNumber() {
    let num = '4532';
    for (let i = 0; i < 12; i++) num += Math.floor(Math.random() * 10);
    return num;
}

function generateReference() {
    return 'PHB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function generateBBCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hasBBCodes(userId, step) {
    const count = await BBC.countDocuments({ userId, step, isUsed: false, expiresAt: { $gt: new Date() } });
    return count > 0;
}

async function useBBCode(userId, code, requiredStep) {
    const bbc = await BBC.findOne({
        code: code,
        userId: userId,
        step: requiredStep,
        isUsed: false,
        expiresAt: { $gt: new Date() }
    });
    if (!bbc) return null;
    bbc.isUsed = true;
    await bbc.save();
    return bbc;
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
        const iban = generateIBAN(currency, accountNumber);
        const swiftCode = generateSWIFTCode(currency);

        const user = new User({
            fullName: `${firstName} ${lastName}`, firstName, lastName, email, phone,
            password: hashedPassword, transactionPin: hashedPin,
            currency, accountNumber, iban, swiftCode
        });
        await user.save();

        const account = new Account({
            userId: user._id, currency, accountNumber, iban, balance: 0
        });
        await account.save();

        const cardNum = generateCardNumber();
        const card = new Card({
            userId: user._id, cardNumber: cardNum, last4: cardNum.slice(-4),
            expiryMonth: 12, expiryYear: 2030, cvv: Math.floor(100 + Math.random() * 900).toString()
        });
        await card.save();

        // NO BBC codes on registration - Admin must create them

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            success: true, 
            token, 
            user: { id: user._id, fullName: user.fullName, email, accountNumber, iban, swiftCode, currency, isAdmin: false }
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { accountNumber: identifier }, { iban: identifier }] });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        user.lastLogin = new Date();
        await user.save();
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email, accountNumber: user.accountNumber, iban: user.iban, swiftCode: user.swiftCode, currency: user.currency, isAdmin: user.isAdmin } });
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
        const transactions = await Transaction.find({ $or: [{ fromUserId: user._id }, { toUserId: user._id }] }).sort({ createdAt: -1 }).limit(30);
        const loans = await Loan.find({ userId: user._id });
        const airtimePurchases = await AirtimePurchase.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10);
        const dataPlans = await DataPlan.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10);
        const billPayments = await BillPayment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10);
        const tickets = await SupportMessage.find({ userId: user._id }).sort({ createdAt: -1 });
        const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        const hasBbc2 = await hasBBCodes(user._id, 2);
        const hasBbc3 = await hasBBCodes(user._id, 3);
        
        res.json({ 
            user, accounts, cards, transactions, loans, airtimePurchases, dataPlans, billPayments, tickets, totalBalance,
            bbcStatus: { step1: hasBbc1, step2: hasBbc2, step3: hasBbc3 }
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// ========== SEND MONEY - 3 STEP BBC ==========

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
        if (!hasBbc1) {
            return res.status(403).json({ error: 'No BBC Code 1 available. Contact admin.' });
        }
        
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

// ========== WITHDRAW - 3 STEP BBC ==========

app.post('/api/withdraw/step1', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { bankName, accountHolder, bankAccountNumber, routingNumber, amount, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        if (!hasBbc1) {
            return res.status(403).json({ error: 'No BBC Code 1 available. Contact admin.' });
        }
        
        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, amount, currency: user.currency, type: 'withdrawal',
            reference, status: 'pending', bankName, bankAccountNumber, routingNumber, toName: accountHolder
        });
        await transaction.save();
        
        res.json({ success: true, step: 1, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/withdraw/step2', async (req, res) => {
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

app.post('/api/withdraw/step3', async (req, res) => {
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

app.post('/api/withdraw/step4', async (req, res) => {
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
        userAccount.balance -= transaction.amount;
        await userAccount.save();
        
        transaction.status = 'completed';
        await transaction.save();
        
        res.json({ success: true, step: 4, reference, amount: transaction.amount, newBalance: userAccount.balance });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== AIRTIME - 3 STEP BBC ==========

app.post('/api/airtime/step1', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { phoneNumber, countryCode, network, amount, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        if (!hasBbc1) {
            return res.status(403).json({ error: 'No BBC Code 1 available. Contact admin.' });
        }
        
        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, amount, currency: user.currency, type: 'airtime',
            reference, status: 'pending', phoneNumber, network
        });
        await transaction.save();
        await new AirtimePurchase({ userId: user._id, phoneNumber: `${countryCode || '1'}${phoneNumber}`, network, amount, reference }).save();
        
        res.json({ success: true, step: 1, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
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
        
        const bbc = await useBBCode(user._id, bbcCode, 1);
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 1' });
        
        res.json({ success: true, step: 2, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
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
        
        const bbc = await useBBCode(user._id, bbcCode, 2);
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 2' });
        
        res.json({ success: true, step: 3, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
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
        
        const bbc = await useBBCode(user._id, bbcCode, 3);
        if (!bbc) return res.status(403).json({ error: 'Invalid BBC Code 3' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: transaction.currency });
        userAccount.balance -= transaction.amount;
        await userAccount.save();
        
        transaction.status = 'completed';
        await transaction.save();
        
        res.json({ success: true, step: 4, reference, amount: transaction.amount, newBalance: userAccount.balance });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== DATA PLANS - 3 STEP BBC ==========

app.post('/api/data/step1', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { phoneNumber, countryCode, network, planName, dataSize, amount, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        if (!hasBbc1) {
            return res.status(403).json({ error: 'No BBC Code 1 available. Contact admin.' });
        }
        
        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, amount, currency: user.currency, type: 'data',
            reference, status: 'pending', phoneNumber, network, dataPlan: planName, dataSize
        });
        await transaction.save();
        await new DataPlan({ userId: user._id, phoneNumber: `${countryCode || '1'}${phoneNumber}`, network, planName, dataSize, amount, reference }).save();
        
        res.json({ success: true, step: 1, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/data/step2', async (req, res) => {
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

app.post('/api/data/step3', async (req, res) => {
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

app.post('/api/data/step4', async (req, res) => {
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
        userAccount.balance -= transaction.amount;
        await userAccount.save();
        
        transaction.status = 'completed';
        await transaction.save();
        
        res.json({ success: true, step: 4, reference, amount: transaction.amount, newBalance: userAccount.balance });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ========== BILLS - 3 STEP BBC ==========

app.post('/api/bills/step1', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { billType, provider, accountNumber, amount, transactionPin } = req.body;
        
        const validPin = await bcrypt.compare(transactionPin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        const userAccount = await Account.findOne({ userId: user._id, currency: user.currency });
        if (!userAccount || userAccount.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
        
        const hasBbc1 = await hasBBCodes(user._id, 1);
        if (!hasBbc1) {
            return res.status(403).json({ error: 'No BBC Code 1 available. Contact admin.' });
        }
        
        const reference = generateReference();
        const transaction = new Transaction({
            fromUserId: user._id, amount, currency: user.currency, type: 'bill',
            reference, status: 'pending', billType, provider, billAccountNumber: accountNumber
        });
        await transaction.save();
        await new BillPayment({ userId: user._id, billType, provider, accountNumber, amount, reference }).save();
        
        res.json({ success: true, step: 1, reference });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/bills/step2', async (req, res) => {
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

app.post('/api/bills/step3', async (req, res) => {
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

app.post('/api/bills/step4', async (req, res) => {
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
        userAccount.balance -= transaction.amount;
        await userAccount.save();
        
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const { amount, purpose, tenureMonths } = req.body;
        const interestRate = 12;
        const monthlyPayment = (amount * (1 + interestRate / 100)) / tenureMonths;
        const totalPayable = monthlyPayment * tenureMonths;
        const loan = new Loan({
            userId: user._id, amount, purpose, interestRate, tenureMonths,
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

// ========== CARDS ==========

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

// ========== SUPPORT ==========

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

// ========== PROFILE ==========

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

app.get('/api/admin/bbc/:userId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);
    if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
    
    const codes = await BBC.find({ userId: req.params.userId }).select('code step isUsed expiresAt _id').sort({ createdAt: -1 });
    res.json(codes);
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
        const code = generateBBCode();
        await new BBC({
            code, userId, step,
            expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
        }).save();
        codes.push(code);
    }
    res.json({ success: true, codes });
});

app.post('/api/admin/bbc/update', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
        
        const { id, code, step, isUsed } = req.body;
        const bbc = await BBC.findById(id);
        if (!bbc) return res.status(404).json({ error: 'BBC code not found' });
        
        bbc.code = code;
        bbc.step = step;
        bbc.isUsed = isUsed;
        await bbc.save();
        
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Update failed' }); }
});

app.post('/api/admin/bbc/delete', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
        
        const { id } = req.body;
        await BBC.findByIdAndDelete(id);
        
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Delete failed' }); }
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

// Create default admin
async function createAdmin() {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        const accountNumber = generateAccountNumber('USD');
        const admin = new User({
            fullName: 'System Administrator', firstName: 'System', lastName: 'Admin',
            email: 'admin@primeheritage.com', phone: '+1 (800) 555-0000',
            password: hashedPassword, transactionPin: await bcrypt.hash('0000', 10),
            currency: 'USD', accountNumber, iban: generateIBAN('USD', accountNumber),
            swiftCode: generateSWIFTCode('USD'), isAdmin: true
        });
        await admin.save();
        console.log('✅ Admin created: admin@primeheritage.com / Admin@123');
    }
}

createAdmin();
app.listen(3000, () => console.log('👑 Prime Heritage Bank running on http://localhost:3000'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
