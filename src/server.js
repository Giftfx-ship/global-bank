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

// ========== HELPERS ==========

function generateAccountNumber(currency) {
    const countryCode = currency === 'USD' ? 'US' : currency === 'EUR' ? 'EU' : 'GB';
    const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `${countryCode}${random}`;
}

function generateIBAN(currency, accountNumber) {
    const countryCode = currency === 'USD' ? 'US' : currency === 'EUR' ? 'DE' : 'GB';
    const checksum = Math.floor(Math.random() * 90 + 10);
    return `${countryCode}${checksum}${accountNumber}`;
}

function generateSWIFTCode(currency) {
    const bankCode = 'PHBG';
    const countryCode = currency === 'USD' ? 'US' : currency === 'EUR' ? 'DE' : 'GB';
    return `${bankCode}${countryCode}33`;
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
            password: hashedPassword, transactionPin: hashedPin
