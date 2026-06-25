const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();

// ==================== LOGGING SETUP ====================
const log = {
  info: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] ℹ️ ${msg}`);
    if (data) console.log('   📦 Data:', JSON.stringify(data, null, 2));
  },
  success: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] ✅ ${msg}`);
    if (data) console.log('   📦 Data:', JSON.stringify(data, null, 2));
  },
  error: (msg, error = null) => {
    console.log(`[${new Date().toISOString()}] ❌ ${msg}`);
    if (error) {
      console.log('   📦 Error:', error.message || error);
      if (error.stack) console.log('   📦 Stack:', error.stack);
    }
  },
  warn: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] ⚠️ ${msg}`);
    if (data) console.log('   📦 Data:', JSON.stringify(data, null, 2));
  },
  debug: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] 🔍 ${msg}`);
    if (data) console.log('   📦 Data:', JSON.stringify(data, null, 2));
  },
  step: (step, msg) => {
    console.log(`[${new Date().toISOString()}] 📍 ${step}: ${msg}`);
  },
  email: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] 📧 ${msg}`);
    if (data) console.log('   📦 Email Data:', JSON.stringify(data, null, 2));
  },
  bbc: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] 🔐 BBC: ${msg}`);
    if (data) console.log('   📦 BBC Data:', JSON.stringify(data, null, 2));
  },
  admin: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] 👑 ${msg}`);
    if (data) console.log('   📦 Admin Data:', JSON.stringify(data, null, 2));
  }
};

log.info('🚀 Starting Prime Heritage International Bank Server...');

// ==================== IN-MEMORY DATABASE ====================
const db = {
  users: [],
  accounts: [],
  transactions: [],
  cards: [],
  loans: [],
  supportTickets: [],
  bbcCodes: [],
  pendingTransactions: [],
  airtimeHistory: [],
  billHistory: [],
  dataHistory: [],
  withdrawHistory: [],
  auditLogs: [],
  receipts: []
};

// ==================== UTILITY FUNCTIONS ====================
const generateAccountNumber = () => {
  return 'IB' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const generateIBAN = () => {
  const countryCode = ['GB', 'DE', 'FR', 'US', 'NG', 'KE', 'ZA', 'AE', 'CH', 'SG'][Math.floor(Math.random() * 10)];
  return countryCode + Math.floor(Math.random() * 10 ** 10).toString().padStart(10, '0') + 
         Math.floor(Math.random() * 10 ** 8).toString().padStart(8, '0');
};

const generateReference = () => {
  return 'TXN-' + Date.now().toString(36).toUpperCase() + '-' + 
         Math.random().toString(36).substring(2, 6).toUpperCase();
};

const generateCardNumber = () => {
  let num = '4';
  for (let i = 0; i < 15; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
};

// ==================== BBC CODE GENERATION ====================
const generateBBCode = (step, type = 'transaction') => {
  const prefixes = { 1: 'ALPHA', 2: 'BETA', 3: 'GAMMA' };
  const displayMessages = {
    1: '🔑 Enter BBC Authorization Code',
    2: '🔒 Enter BBC Security Code',
    3: '🛡️ Enter BBC Final Code'
  };
  const hiddenPurposes = {
    transaction: {
      1: 'Verifying currency exchange rates and initial transaction details',
      2: 'Validating recipient account and transfer authorization',
      3: 'Authorizing final transfer completion and settlement'
    },
    airtime: {
      1: 'Verifying phone number and network availability',
      2: 'Validating airtime plan and pricing',
      3: 'Authorizing airtime credit to phone number'
    },
    bills: {
      1: 'Verifying biller and account details',
      2: 'Validating payment amount and currency conversion',
      3: 'Authorizing bill payment and generating receipt'
    },
    data: {
      1: 'Verifying data plan availability and network',
      2: 'Validating data bundle pricing and phone number',
      3: 'Authorizing data bundle activation'
    },
    withdraw: {
      1: 'Verifying bank account details and routing',
      2: 'Validating withdrawal amount and processing fees',
      3: 'Authorizing bank transfer and settlement'
    }
  };
  const securityFlags = {
    1: 'INITIAL_VERIFICATION',
    2: 'ACCOUNT_VALIDATED',
    3: 'TRANSACTION_AUTHORIZED'
  };
  const code = prefixes[step] + '-' + 
               Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
               Math.random().toString(36).substring(2, 6).toUpperCase();
  return {
    code,
    step,
    display_message: displayMessages[step],
    hidden_purpose: hiddenPurposes[type]?.[step] || hiddenPurposes.transaction[step],
    security_flag: securityFlags[step],
    type: type
  };
};

const generateBBCodesForTransaction = (transactionId, userId, type = 'transaction') => {
  const bbcCodes = [];
  for (let step = 1; step <= 3; step++) {
    const bbcData = generateBBCode(step, type);
    const bbc = {
      id: uuidv4(),
      code: bbcData.code,
      step: bbcData.step,
      display_message: bbcData.display_message,
      hidden_purpose: bbcData.hidden_purpose,
      security_flag: bbcData.security_flag,
      type: bbcData.type,
      transaction_id: transactionId,
      user_id: userId,
      is_used: false,
      used_at: null,
      expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      created_at: new Date().toISOString()
    };
    db.bbcCodes.push(bbc);
    bbcCodes.push(bbc);
  }
  return bbcCodes;
};

// ==================== CREATE DEFAULT ADMIN ====================
const createDefaultAdmin = async () => {
  log.step('👑', 'Creating default admin account...');
  
  const adminEmail = 'devgift@gmail.com';
  const existingAdmin = db.users.find(u => u.email === adminEmail);
  
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Igwe', 10);
    const hashedPin = await bcrypt.hash('1234', 10);
    
    const admin = {
      id: uuidv4(),
      full_name: 'System Administrator',
      first_name: 'System',
      last_name: 'Admin',
      email: adminEmail,
      phone: '+1234567890',
      password: hashedPassword,
      transaction_pin: hashedPin,
      passport_number: 'ADMIN001',
      nationality: 'Global',
      country_of_residence: 'Global',
      date_of_birth: '1990-01-01',
      account_level: 'admin',
      is_active: true,
      is_verified: true,
      is_admin: true,
      is_super_admin: true,
      is_unlimited: true,
      login_count: 0,
      created_at: new Date().toISOString()
    };
    
    db.users.push(admin);
    
    const adminAccount = {
      id: uuidv4(),
      user_id: admin.id,
      currency: 'USD',
      account_number: generateAccountNumber(),
      iban: generateIBAN(),
      swift_code: 'IB' + 'USD' + Math.floor(Math.random() * 10000),
      balance: 9999999999.99,
      is_primary: true,
      account_type: 'admin',
      is_active: true,
      created_at: new Date().toISOString()
    };
    db.accounts.push(adminAccount);
    
    log.success('✅ Default admin created');
    log.admin('👑 Admin Credentials:');
    log.admin('   Email: devgift@gmail.com');
    log.admin('   Password: Igwe');
    log.admin('   💰 Balance: UNLIMITED');
  }
};

// ==================== EMAIL SETUP ====================
log.step('📧', 'Setting up Nodemailer with Gmail...');



const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: emailSecure,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

log.debug(`📧 Email Config: Host=${process.env.EMAIL_HOST || 'smtp.gmail.com'}, Port=${parseInt(process.env.EMAIL_PORT) || 465}, Secure=${emailSecure}`);

// ==================== ULTRA-PREMIUM EMAIL TEMPLATES ====================

// ---------- WELCOME EMAIL (DOPE & PROFESSIONAL) ----------
const getWelcomeTemplate = (userData) => {
  const { full_name, email, account_level } = userData;
  const year = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Prime Heritage Bank</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #060A14;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      max-width: 620px;
      margin: 40px auto;
      background: #0B1120;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(198,164,63,0.08);
      position: relative;
    }
    .email-wrapper::before {
      content: '';
      position: absolute;
      top: -60%;
      right: -40%;
      width: 80%;
      height: 80%;
      background: radial-gradient(circle, rgba(198,164,63,0.04) 0%, transparent 70%);
      pointer-events: none;
    }
    .header {
      background: linear-gradient(165deg, #060A14 0%, #0F1A2E 50%, #0B1120 100%);
      padding: 48px 44px 32px;
      text-align: center;
      position: relative;
      border-bottom: 2px solid rgba(198,164,63,0.12);
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 15%;
      right: 15%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #C6A43F, #E8D07A, #C6A43F, transparent);
      background-size: 200% 100%;
      animation: shimmer 4s ease-in-out infinite;
    }
    @keyframes shimmer { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    .header .logo-icon { font-size: 52px; display: block; margin-bottom: 8px; filter: drop-shadow(0 4px 20px rgba(198,164,63,0.2)); }
    .header h1 { font-family: 'Playfair Display', serif; color: #FFFFFF; font-size: 30px; font-weight: 900; letter-spacing: 1.5px; margin: 0; }
    .header h1 .gold { background: linear-gradient(135deg, #C6A43F, #E8D07A, #C6A43F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200% 200%; animation: goldShine 4s ease-in-out infinite; }
    @keyframes goldShine { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    .header .tagline { color: rgba(255,255,255,0.2); font-size: 10px; letter-spacing: 6px; text-transform: uppercase; margin-top: 6px; font-weight: 300; }
    .header .badge { display: inline-block; margin-top: 14px; padding: 5px 22px; background: rgba(198,164,63,0.1); border: 1px solid rgba(198,164,63,0.2); border-radius: 50px; color: #C6A43F; font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; font-weight: 600; }
    .body-content { padding: 44px 44px 32px; background: #0B1120; position: relative; }
    .greeting { font-size: 26px; font-weight: 700; color: #FFFFFF; margin-bottom: 6px; font-family: 'Playfair Display', serif; }
    .greeting .highlight { background: linear-gradient(135deg, #C6A43F, #E8D07A); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .greeting .wave { display: inline-block; animation: wave 2.5s infinite; }
    @keyframes wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(18deg); } 75% { transform: rotate(-8deg); } }
    .message-text { color: rgba(255,255,255,0.7); line-height: 1.9; font-size: 15px; margin: 14px 0 24px; font-weight: 300; }
    .message-text strong { color: #FFFFFF; font-weight: 600; }
    .divider-line { height: 1px; background: linear-gradient(90deg, transparent, rgba(198,164,63,0.15), transparent); margin: 24px 0; }
    .account-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 22px 26px; margin: 20px 0 24px; }
    .account-card .card-title { color: rgba(255,255,255,0.25); font-size: 9px; text-transform: uppercase; letter-spacing: 2.5px; margin-bottom: 14px; font-weight: 600; }
    .account-card .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 13px; }
    .account-card .row:last-child { border-bottom: none; }
    .account-card .label { color: rgba(255,255,255,0.35); font-weight: 400; }
    .account-card .value { color: #FFFFFF; font-weight: 500; font-family: 'Inter', monospace; }
    .account-card .value.golden { color: #C6A43F; }
    .account-card .value.status { color: #34D399; }
    .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
    .feature-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 16px; padding: 16px 14px; text-align: center; transition: all 0.3s; }
    .feature-item:hover { border-color: rgba(198,164,63,0.15); background: rgba(198,164,63,0.02); }
    .feature-item .icon { font-size: 28px; display: block; margin-bottom: 6px; }
    .feature-item .label { font-weight: 600; color: #FFFFFF; font-size: 12px; display: block; }
    .feature-item .desc { color: rgba(255,255,255,0.3); font-size: 10px; margin-top: 2px; }
    .btn-wrap { text-align: center; margin: 28px 0 8px; }
    .btn-primary { display: inline-block; background: linear-gradient(135deg, #C6A43F, #A8882E); color: #060A14; padding: 16px 52px; text-decoration: none; border-radius: 60px; font-weight: 700; font-size: 15px; font-family: 'Inter', sans-serif; letter-spacing: 0.3px; box-shadow: 0 8px 32px rgba(198,164,63,0.3); transition: all 0.3s ease; border: none; cursor: pointer; }
    .btn-primary:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 12px 48px rgba(198,164,63,0.45); }
    .btn-secondary { display: inline-block; background: transparent; color: rgba(255,255,255,0.5); padding: 12px 36px; text-decoration: none; border-radius: 60px; font-weight: 500; font-size: 13px; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.06); margin-top: 10px; transition: all 0.3s ease; }
    .btn-secondary:hover { border-color: rgba(198,164,63,0.3); color: #C6A43F; }
    .footer-section { background: rgba(255,255,255,0.01); padding: 28px 44px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.03); }
    .footer-section .brand-name { color: rgba(255,255,255,0.4); font-weight: 600; font-size: 13px; letter-spacing: 1px; }
    .footer-section p { color: rgba(255,255,255,0.15); font-size: 10px; margin: 4px 0; line-height: 1.8; font-weight: 300; }
    .footer-section .social-icons { margin: 12px 0 8px; display: flex; justify-content: center; gap: 14px; }
    .footer-section .social-icons span { color: rgba(255,255,255,0.08); font-size: 18px; transition: all 0.3s; }
    .footer-section .social-icons span:hover { color: #C6A43F; }
    .footer-section .disclaimer { font-size: 9px; color: rgba(255,255,255,0.06); margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.03); }
    @media (max-width: 520px) {
      .email-wrapper { margin: 20px 12px; border-radius: 24px; }
      .header { padding: 32px 20px 24px; }
      .header h1 { font-size: 24px; }
      .body-content { padding: 28px 20px 20px; }
      .greeting { font-size: 22px; }
      .features-grid { grid-template-columns: 1fr; }
      .account-card { padding: 16px 18px; }
      .account-card .row { flex-direction: column; gap: 2px; padding: 10px 0; }
      .btn-primary { padding: 14px 32px; font-size: 14px; width: 100%; }
      .btn-secondary { width: 100%; }
      .footer-section { padding: 20px; }
    }
    @media (prefers-color-scheme: light) {
      body { background: #f0f2f5; }
      .email-wrapper { background: #ffffff; box-shadow: 0 30px 60px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.04); }
      .header { background: linear-gradient(165deg, #ffffff, #f8f6f0); border-bottom: 2px solid rgba(198,164,63,0.15); }
      .header h1 { color: #0A0E1A; }
      .header .tagline { color: rgba(0,0,0,0.2); }
      .body-content { background: #ffffff; }
      .greeting { color: #0A0E1A; }
      .message-text { color: rgba(0,0,0,0.65); }
      .message-text strong { color: #0A0E1A; }
      .account-card { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.05); }
      .account-card .value { color: #0A0E1A; }
      .account-card .label { color: rgba(0,0,0,0.4); }
      .feature-item { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.04); }
      .feature-item .label { color: #0A0E1A; }
      .btn-secondary { color: rgba(0,0,0,0.4); border-color: rgba(0,0,0,0.06); }
      .btn-secondary:hover { border-color: #C6A43F; color: #C6A43F; }
      .footer-section { border-color: rgba(0,0,0,0.04); }
      .footer-section .brand-name { color: rgba(0,0,0,0.4); }
      .footer-section p { color: rgba(0,0,0,0.15); }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <span class="logo-icon">🏛️</span>
      <h1>Prime Heritage <span class="gold">Bank</span></h1>
      <div class="tagline">International Banking Excellence</div>
      <div class="badge">✦ Private Banking ✦</div>
    </div>
    <div class="body-content">
      <div class="greeting"><span class="wave">👋</span> Welcome, <span class="highlight">${full_name}</span></div>
      <div class="message-text">
        <strong>Your global banking journey begins now.</strong><br>
        We are honored to welcome you to Prime Heritage International Bank. Your account has been meticulously prepared with the highest standards of security and service excellence.
      </div>
      <div class="divider-line"></div>
      <div class="account-card">
        <div class="card-title">📋 Account Summary</div>
        <div class="row"><span class="label">Account Holder</span><span class="value">${full_name}</span></div>
        <div class="row"><span class="label">Email Address</span><span class="value">${email}</span></div>
        <div class="row"><span class="label">Account Level</span><span class="value golden">${account_level || 'Standard'}</span></div>
        <div class="row"><span class="label">Status</span><span class="value status">✓ Active</span></div>
      </div>
      <div class="features-grid">
        <div class="feature-item"><span class="icon">🌍</span><span class="label">Multi-Currency</span><span class="desc">USD • EUR • GBP • NGN</span></div>
        <div class="feature-item"><span class="icon">💳</span><span class="label">Global Cards</span><span class="desc">Visa • Mastercard • AMEX</span></div>
        <div class="feature-item"><span class="icon">🔐</span><span class="label">BBC Security</span><span class="desc">3-Step Verification</span></div>
        <div class="feature-item"><span class="icon">⚡</span><span class="label">Instant Transfers</span><span class="desc">SWIFT • SEPA • ACH</span></div>
      </div>
      <div class="btn-wrap">
        <a href="${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}/dashboard.html" class="btn-primary">🚀 Access Your Dashboard</a>
        <br>
        <a href="${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}/login.html" class="btn-secondary">🔐 Secure Sign In</a>
      </div>
    </div>
    <div class="footer-section">
      <div class="brand-name">✦ Prime Heritage International Bank ✦</div>
      <p>Global Banking • Privacy Assured • Excellence Delivered</p>
      <div class="social-icons"><span>📱</span><span>🌐</span><span>🔒</span><span>⚡</span></div>
      <p>© ${year} Prime Heritage International Bank. All rights reserved.</p>
      <p style="font-size: 9px;">This email was sent to <strong style="color: rgba(255,255,255,0.2);">${email}</strong></p>
      <div class="disclaimer">This is an automated operational message. Please do not reply directly.</div>
    </div>
  </div>
</body>
</html>
  `;
};

// ---------- RECEIPT EMAIL (DOPE & PROFESSIONAL) ----------
const getReceiptTemplate = (transaction, user) => {
  const receiptUrl = `${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}/receipt.html?ref=${transaction.reference}`;
  const year = new Date().getFullYear();
  const txDate = new Date(transaction.created_at || Date.now());
  const dateStr = txDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt | Prime Heritage Bank</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #060A14;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      max-width: 620px;
      margin: 40px auto;
      background: #0B1120;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(198,164,63,0.08);
      position: relative;
    }
    .email-wrapper::before {
      content: '';
      position: absolute;
      top: -60%;
      right: -40%;
      width: 80%;
      height: 80%;
      background: radial-gradient(circle, rgba(198,164,63,0.03) 0%, transparent 70%);
      pointer-events: none;
    }
    .header {
      background: linear-gradient(165deg, #060A14 0%, #0F1A2E 50%, #0B1120 100%);
      padding: 36px 44px 28px;
      text-align: center;
      border-bottom: 2px solid rgba(198,164,63,0.12);
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 15%;
      right: 15%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #C6A43F, #E8D07A, #C6A43F, transparent);
      background-size: 200% 100%;
      animation: shimmer 4s ease-in-out infinite;
    }
    @keyframes shimmer { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    .header .logo-icon { font-size: 40px; display: block; margin-bottom: 4px; }
    .header h1 { font-family: 'Playfair Display', serif; color: #FFFFFF; font-size: 24px; font-weight: 700; letter-spacing: 1.5px; }
    .header h1 .gold { background: linear-gradient(135deg, #C6A43F, #E8D07A); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header .subtitle { color: rgba(255,255,255,0.15); font-size: 9px; letter-spacing: 5px; text-transform: uppercase; margin-top: 2px; font-weight: 300; }
    .body-content { padding: 32px 44px 24px; background: #0B1120; }
    .receipt-id { display: inline-block; padding: 5px 20px; background: rgba(198,164,63,0.08); border: 1px solid rgba(198,164,63,0.12); border-radius: 50px; color: #C6A43F; font-size: 11px; font-weight: 600; font-family: 'Inter', monospace; letter-spacing: 0.5px; }
    .status-badge { display: inline-block; padding: 4px 16px; border-radius: 50px; font-size: 10px; font-weight: 600; background: rgba(16,185,129,0.1); color: #34D399; border: 1px solid rgba(16,185,129,0.15); margin: 10px 0 16px; }
    .amount-section { text-align: center; padding: 16px 0; margin: 12px 0; border-top: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); }
    .amount-section .amount-label { color: rgba(255,255,255,0.2); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; }
    .amount-section .amount { font-size: 38px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px; }
    .amount-section .amount .currency { color: #C6A43F; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: rgba(255,255,255,0.3); font-size: 11px; font-weight: 400; }
    .detail-value { color: #FFFFFF; font-weight: 500; font-size: 12px; text-align: right; }
    .detail-value .gold-text { color: #C6A43F; }
    .detail-value.mono { font-family: 'Inter', monospace; font-size: 11px; letter-spacing: 0.3px; }
    .btn-wrap { text-align: center; margin: 22px 0 6px; }
    .view-btn { display: inline-block; background: linear-gradient(135deg, #C6A43F, #A8882E); color: #060A14; padding: 14px 44px; text-decoration: none; border-radius: 60px; font-weight: 700; font-size: 14px; font-family: 'Inter', sans-serif; box-shadow: 0 8px 32px rgba(198,164,63,0.25); transition: all 0.3s ease; border: none; cursor: pointer; }
    .view-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 12px 48px rgba(198,164,63,0.4); }
    .footer-section { background: rgba(255,255,255,0.01); padding: 24px 44px 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.03); }
    .footer-section .brand-name { color: rgba(255,255,255,0.3); font-weight: 500; font-size: 12px; letter-spacing: 0.5px; }
    .footer-section p { color: rgba(255,255,255,0.12); font-size: 10px; margin: 3px 0; line-height: 1.6; }
    @media (max-width: 520px) {
      .email-wrapper { margin: 20px 12px; border-radius: 24px; }
      .header { padding: 28px 20px 20px; }
      .header h1 { font-size: 20px; }
      .body-content { padding: 24px 20px 16px; }
      .amount-section .amount { font-size: 28px; }
      .detail-row { flex-direction: column; gap: 2px; padding: 10px 0; }
      .detail-value { text-align: left; }
      .view-btn { padding: 12px 28px; font-size: 13px; width: 100%; }
      .footer-section { padding: 16px 20px; }
    }
    @media (prefers-color-scheme: light) {
      body { background: #f0f2f5; }
      .email-wrapper { background: #ffffff; box-shadow: 0 30px 60px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.04); }
      .header { background: linear-gradient(165deg, #ffffff, #f8f6f0); border-bottom: 2px solid rgba(198,164,63,0.15); }
      .header h1 { color: #0A0E1A; }
      .body-content { background: #ffffff; }
      .amount-section .amount { color: #0A0E1A; }
      .detail-value { color: #0A0E1A; }
      .detail-label { color: rgba(0,0,0,0.35); }
      .footer-section { border-color: rgba(0,0,0,0.04); }
      .footer-section .brand-name { color: rgba(0,0,0,0.3); }
      .footer-section p { color: rgba(0,0,0,0.12); }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <span class="logo-icon">🏛️</span>
      <h1>Prime Heritage <span class="gold">Bank</span></h1>
      <div class="subtitle">International Banking</div>
    </div>
    <div class="body-content">
      <div style="text-align:center;margin-bottom:8px;"><span class="receipt-id">#${transaction.reference || 'N/A'}</span></div>
      <div style="text-align:center;"><span class="status-badge">✅ COMPLETED</span></div>
      <div class="amount-section">
        <div class="amount-label">Total Amount</div>
        <div class="amount"><span class="currency">${transaction.currency || 'USD'}</span> ${(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="detail-row"><span class="detail-label">Transaction Type</span><span class="detail-value">${transaction.type || 'Transaction'}</span></div>
      <div class="detail-row"><span class="detail-label">Description</span><span class="detail-value">${transaction.description || transaction.purpose || 'N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${timeStr}</span></div>
      <div class="detail-row"><span class="detail-label">Reference</span><span class="detail-value mono">${transaction.reference || 'N/A'}</span></div>
      <div class="btn-wrap"><a href="${receiptUrl}" class="view-btn">🧾 View Full Receipt</a></div>
      <div style="text-align:center;font-size:10px;color:rgba(255,255,255,0.12);margin-top:10px;">This is an automated receipt for your transaction.</div>
    </div>
    <div class="footer-section">
      <div class="brand-name">✦ Prime Heritage International Bank ✦</div>
      <p>© ${year} Prime Heritage International Bank</p>
      <p style="font-size:9px;">Sent to ${user.email}</p>
    </div>
  </div>
</body>
</html>
  `;
};

// ---------- TEST EMAIL ----------
const getTestTemplate = () => {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Started</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #060A14; padding: 20px; color: #FFFFFF; }
    .container { max-width: 560px; margin: 0 auto; background: #0B1120; border-radius: 28px; padding: 32px; border: 1px solid rgba(198,164,63,0.06); box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, #060A14, #0F1A2E); padding: 28px; text-align: center; border-radius: 16px 16px 0 0; margin: -32px -32px 20px -32px; border-bottom: 2px solid rgba(198,164,63,0.12); }
    .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header .gold { color: #C6A43F; }
    .header .sub { color: rgba(255,255,255,0.2); font-size: 10px; letter-spacing: 4px; text-transform: uppercase; margin-top: 4px; }
    .success-box { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.12); color: #34D399; padding: 16px 20px; border-radius: 14px; border-left: 3px solid #10B981; margin: 16px 0; }
    .info-box { background: rgba(59,130,246,0.04); border: 1px solid rgba(59,130,246,0.08); color: #60A5FA; padding: 16px 20px; border-radius: 14px; border-left: 3px solid #3B82F6; margin: 14px 0; }
    .admin-box { background: rgba(198,164,63,0.06); border: 1px solid rgba(198,164,63,0.1); color: #C6A43F; padding: 16px 20px; border-radius: 14px; border-left: 3px solid #C6A43F; margin: 14px 0; }
    .admin-box code { background: rgba(198,164,63,0.08); padding: 2px 12px; border-radius: 6px; font-size: 12px; color: #C6A43F; font-weight: 600; }
    .footer { margin-top: 20px; text-align: center; color: rgba(255,255,255,0.08); font-size: 10px; border-top: 1px solid rgba(255,255,255,0.02); padding-top: 18px; letter-spacing: 0.5px; }
    .emoji-big { font-size: 42px; display: block; margin-bottom: 4px; }
    @media (max-width: 480px) { .container { padding: 20px; margin: 10px; } .header { margin: -20px -20px 16px -20px; padding: 20px; } .header h1 { font-size: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="emoji-big">🏛️</span>
      <h1>Prime Heritage <span class="gold">Bank</span></h1>
      <div class="sub">International Banking Excellence</div>
    </div>
    <h2 style="font-weight:700;font-size:20px;margin-bottom:4px;">✅ Server Started Successfully!</h2>
    <div class="success-box"><strong>✓ Email System is Working!</strong><br>Your server is running and emails are sending correctly.</div>
    <div class="info-box"><strong>📋 Server Details:</strong><br>• Time: ${new Date().toLocaleString()}<br>• Environment: production<br>• URL: ${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}</div>
    <div class="admin-box"><strong>👑 Admin Access:</strong><br>Email: <code>devgift@gmail.com</code><br>Password: <code>Igwe</code></div>
    <div class="footer">© ${year} Prime Heritage International Bank</div>
  </div>
</body>
</html>
  `;
};

// ==================== SEND EMAIL FUNCTIONS ====================

const sendWelcomeEmail = async (userData) => {
  try {
    const html = getWelcomeTemplate(userData);
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: userData.email,
      subject: '🎉 Welcome to Prime Heritage International Bank',
      html: html
    });
    log.email('✅ Welcome email sent to:', userData.email);
    log.email(`📧 Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    log.error('❌ Welcome email failed:', error);
    return false;
  }
};

const sendReceiptEmail = async (transaction, user) => {
  try {
    const html = getReceiptTemplate(transaction, user);
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: user.email,
      subject: `🧾 Receipt for ${transaction.type || 'Transaction'} - ${transaction.reference || 'N/A'}`,
      html: html
    });
    log.email('✅ Receipt email sent to:', user.email);
    log.email(`📧 Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    log.error('❌ Receipt email failed:', error);
    return false;
  }
};

const sendTestEmail = async () => {
  try {
    const html = getTestTemplate();
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: 'devgift@gmail.com',
      subject: '🚀 Prime Heritage Bank - Server Started!',
      html: html
    });
    log.email('✅ Test email sent to devgift@gmail.com');
    log.email(`📧 Message ID: ${result.messageId}`);
  } catch (error) {
    log.error('Test email failed:', error);
  }
};

transporter.verify((error, success) => {
  if (error) {
    log.error('Email configuration error:', error);
    log.warn('⚠️ Email may not work properly. Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS');
  } else {
    log.success('Email server is ready');
    log.email(`📧 Connected to: ${process.env.EMAIL_HOST || 'smtp.gmail.com'}:${parseInt(process.env.EMAIL_PORT) || 465}`);
    setTimeout(sendTestEmail, 2000);
  }
});

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== MIDDLEWARE ====================
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, try again later.' }
});
app.use('/api', limiter);

// ==================== CONSTANTS ====================
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_this';
const JWT_EXPIRE = '7d';

// ==================== COMPLETE TRANSACTION ====================
const completeTransaction = async (transaction, req, res) => {
  try {
    const fromAccount = db.accounts.find(a => a.account_number === transaction.from_account_number);
    const toAccount = db.accounts.find(a => a.account_number === transaction.to_account_number);
    
    if (fromAccount && toAccount) {
      if (!req.user.is_unlimited) {
        fromAccount.balance -= transaction.amount;
      }
      toAccount.balance += transaction.amount;
      
      const completedTx = {
        ...transaction,
        status: 'completed',
        completed_at: new Date().toISOString()
      };
      
      db.transactions.push(completedTx);
      db.pendingTransactions = db.pendingTransactions.filter(t => t.reference !== transaction.reference);
      
      const user = db.users.find(u => u.id === req.user.id);
      if (user) {
        sendReceiptEmail(completedTx, user).catch(err => {
          log.error('Background receipt email failed:', err);
        });
      }
      
      return { success: true, newBalance: fromAccount.balance, transaction: completedTx };
    }
    return { success: false, error: 'Account error' };
  } catch (error) {
    log.error('Complete transaction error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== SERVE HTML PAGES ====================
const servePage = (page) => {
  return (req, res) => {
    res.sendFile(path.join(__dirname, 'public', page));
  };
};

app.get('/', servePage('index.html'));
app.get('/admin', servePage('admin.html'));
app.get('/admin.html', servePage('admin.html'));
app.get('/dashboard', servePage('dashboard.html'));
app.get('/dashboard.html', servePage('dashboard.html'));
app.get('/receipt', servePage('receipt.html'));
app.get('/receipt.html', servePage('receipt.html'));
app.get('/send', servePage('send.html'));
app.get('/send.html', servePage('send.html'));
app.get('/airtime', servePage('airtime.html'));
app.get('/airtime.html', servePage('airtime.html'));
app.get('/bills', servePage('bills.html'));
app.get('/bills.html', servePage('bills.html'));
app.get('/data', servePage('data.html'));
app.get('/data.html', servePage('data.html'));
app.get('/withdraw', servePage('withdraw.html'));
app.get('/withdraw.html', servePage('withdraw.html'));
app.get('/cards', servePage('cards.html'));
app.get('/cards.html', servePage('cards.html'));
app.get('/loans', servePage('loans.html'));
app.get('/loans.html', servePage('loans.html'));
app.get('/profile', servePage('profile.html'));
app.get('/profile.html', servePage('profile.html'));
app.get('/support', servePage('support.html'));
app.get('/support.html', servePage('support.html'));

// ==================== API: HEALTH ====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    users: db.users.length,
    accounts: db.accounts.length,
    transactions: db.transactions.length,
    bbcCodes: db.bbcCodes.length
  });
});

// ==================== API: REGISTER ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    log.info('Registration request:', req.body.email);
    
    const { 
      full_name, first_name, last_name, email, phone, 
      password, transaction_pin, passport_number, nationality,
      country_of_residence, date_of_birth 
    } = req.body;

    if (!full_name || !first_name || !last_name || !email || !phone || !password || !transaction_pin) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(transaction_pin, 10);

    const user = {
      id: uuidv4(),
      full_name,
      first_name,
      last_name,
      email,
      phone,
      password: hashedPassword,
      transaction_pin: hashedPin,
      passport_number: passport_number || 'N/A',
      nationality: nationality || 'N/A',
      country_of_residence: country_of_residence || 'N/A',
      date_of_birth: date_of_birth || 'N/A',
      account_level: 'standard',
      is_active: true,
      is_verified: false,
      is_admin: false,
      is_super_admin: false,
      is_unlimited: false,
      login_count: 0,
      created_at: new Date().toISOString()
    };
    
    db.users.push(user);
    log.success('User created:', user.email);

    const currencies = ['USD', 'EUR', 'GBP', 'NGN'];
    for (const currency of currencies) {
      const account = {
        id: uuidv4(),
        user_id: user.id,
        currency,
        account_number: generateAccountNumber(),
        iban: generateIBAN(),
        swift_code: 'IB' + currency + Math.floor(Math.random() * 10000),
        balance: 0.00,
        is_primary: currency === 'USD',
        account_type: 'current',
        is_active: true,
        created_at: new Date().toISOString()
      };
      db.accounts.push(account);
    }

    sendWelcomeEmail(user).catch(err => {
      log.error('Welcome email failed:', err);
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    const userAccounts = db.accounts.filter(a => a.user_id === user.id);
    const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        account_level: user.account_level,
        is_verified: user.is_verified,
        is_admin: user.is_admin,
        accounts: userAccounts,
        totalBalance: 0.00,
        account_number: primaryAccount?.account_number || 'N/A',
        iban: primaryAccount?.iban || 'N/A',
        swift_code: primaryAccount?.swift_code || 'N/A',
        currency: primaryAccount?.currency || 'USD'
      }
    });
  } catch (error) {
    log.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ==================== API: LOGIN ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    log.info('Login request:', req.body.email);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.last_login = new Date().toISOString();
    user.login_count = (user.login_count || 0) + 1;

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    const userAccounts = db.accounts.filter(a => a.user_id === user.id);
    const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];
    const totalBalance = userAccounts.reduce((sum, a) => sum + a.balance, 0);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        account_level: user.account_level,
        is_verified: user.is_verified,
        is_active: user.is_active,
        is_admin: user.is_admin || false,
        is_super_admin: user.is_super_admin || false,
        is_unlimited: user.is_unlimited || false,
        accounts: userAccounts,
        totalBalance: totalBalance,
        account_number: primaryAccount?.account_number || 'N/A',
        iban: primaryAccount?.iban || 'N/A',
        swift_code: primaryAccount?.swift_code || 'N/A',
        currency: primaryAccount?.currency || 'USD'
      }
    });
  } catch (error) {
    log.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== API: GET PROFILE ====================
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userAccounts = db.accounts.filter(a => a.user_id === user.id);
    const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];
    const totalBalance = userAccounts.reduce((sum, a) => sum + a.balance, 0);
    
    const userData = {
      ...user,
      password: undefined,
      transaction_pin: undefined,
      accounts: userAccounts,
      totalBalance: totalBalance,
      is_unlimited: user.is_unlimited || false,
      is_admin: user.is_admin || false,
      is_super_admin: user.is_super_admin || false,
      account_number: primaryAccount?.account_number || 'N/A',
      iban: primaryAccount?.iban || 'N/A',
      swift_code: primaryAccount?.swift_code || 'N/A',
      currency: primaryAccount?.currency || 'USD',
      cards: db.cards.filter(c => c.user_id === user.id),
      transactions: db.transactions
        .filter(t => t.from_user_id === user.id || t.to_user_id === user.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50),
      loans: db.loans.filter(l => l.user_id === user.id),
      supportTickets: db.supportTickets.filter(s => s.user_id === user.id)
    };
    
    res.json({ success: true, user: userData });
  } catch (error) {
    log.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== API: GET ACCOUNTS ====================
app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const accounts = db.accounts.filter(a => a.user_id === req.user.id && a.is_active === true);
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// ==================== API: GET TRANSACTIONS ====================
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = db.transactions
      .filter(t => t.from_user_id === req.user.id || t.to_user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 100);
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ==================== API: GET ALL TRANSACTIONS ====================
app.get('/api/transactions/all', authMiddleware, async (req, res) => {
  try {
    const transactions = db.transactions
      .filter(t => t.from_user_id === req.user.id || t.to_user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const enrichedTransactions = transactions.map(tx => {
      const sender = db.users.find(u => u.id === tx.from_user_id);
      const recipient = db.users.find(u => u.id === tx.to_user_id);
      return {
        ...tx,
        sender_name: tx.sender_name || sender?.full_name || 'System',
        recipient_name: recipient?.full_name || 'Unknown'
      };
    });
    
    res.json({
      success: true,
      transactions: enrichedTransactions,
      count: enrichedTransactions.length
    });
  } catch (error) {
    log.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ==================== API: GET RECEIPT ====================
app.get('/api/receipt/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    
    const transaction = db.transactions.find(t => 
      t.reference === reference && 
      (t.from_user_id === req.user.id || t.to_user_id === req.user.id)
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    let role = 'recipient';
    if (transaction.from_user_id === req.user.id) {
      role = 'sender';
    } else if (transaction.to_user_id === req.user.id) {
      role = 'recipient';
    }
    
    const sender = db.users.find(u => u.id === transaction.from_user_id);
    const recipient = db.users.find(u => u.id === transaction.to_user_id);
    
    res.json({
      success: true,
      transaction: {
        ...transaction,
        sender_name: transaction.sender_name || sender?.full_name || 'N/A',
        recipient_name: recipient?.full_name || 'N/A'
      },
      role: role,
      sender: sender ? { full_name: sender.full_name, email: sender.email } : null,
      recipient: recipient ? { full_name: recipient.full_name, email: recipient.email } : null
    });
  } catch (error) {
    log.error('Get receipt error:', error);
    res.status(500).json({ error: 'Failed to get receipt' });
  }
});

// ==================== ADMIN API: GET RECEIPT ====================
app.get('/api/admin/receipt/:reference', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    
    const transaction = db.transactions.find(t => t.reference === reference);
    if (!transaction) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    const sender = db.users.find(u => u.id === transaction.from_user_id);
    const recipient = db.users.find(u => u.id === transaction.to_user_id);
    
    res.json({
      success: true,
      transaction: {
        ...transaction,
        sender_name: transaction.sender_name || sender?.full_name || 'N/A',
        recipient_name: recipient?.full_name || 'N/A'
      },
      role: 'admin',
      sender: sender ? { full_name: sender.full_name, email: sender.email } : null,
      recipient: recipient ? { full_name: recipient.full_name, email: recipient.email } : null
    });
  } catch (error) {
    log.error('Admin get receipt error:', error);
    res.status(500).json({ error: 'Failed to get receipt' });
  }
});

// ==================== ADMIN SEND MONEY ====================
app.post('/api/admin/send', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { toAccountNumber, amount, currency, senderName, note } = req.body;
    
    const toAccount = db.accounts.find(a => a.account_number === toAccountNumber);
    if (!toAccount) {
      return res.status(404).json({ error: 'Recipient account not found' });
    }
    
    const recipient = db.users.find(u => u.id === toAccount.user_id);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'admin_transfer',
      amount,
      currency,
      from_user_id: req.user.id,
      to_user_id: recipient.id,
      from_account_number: 'ADMIN-SYSTEM',
      to_account_number: toAccount.account_number,
      description: note || `Admin transfer from ${senderName || 'System Administrator'}`,
      sender_name: senderName || 'System Administrator',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    
    db.transactions.push(transaction);
    toAccount.balance = (toAccount.balance || 0) + amount;
    
    sendReceiptEmail(transaction, recipient).catch(err => {
      log.error('Receipt email failed:', err);
    });
    
    res.json({
      success: true,
      message: `Sent ${amount} ${currency} to ${recipient.full_name}`,
      transaction: {
        reference,
        amount,
        currency,
        recipient: recipient.full_name,
        recipientEmail: recipient.email,
        senderName: senderName || 'System Administrator'
      }
    });
  } catch (error) {
    log.error('Admin send money error:', error);
    res.status(500).json({ error: 'Failed to send money' });
  }
});

// ==================== BBC SECURED TRANSACTIONS ====================

// === SEND MONEY ===
app.post('/api/send/step1', authMiddleware, async (req, res) => {
  try {
    const { toAccountNumber, amount, description, transactionPin } = req.body;
    
    const validPin = await bcrypt.compare(transactionPin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    
    const toAccount = db.accounts.find(a => a.account_number === toAccountNumber);
    if (!toAccount) {
      return res.status(404).json({ error: 'Recipient account not found' });
    }
    
    const recipient = db.users.find(u => u.id === toAccount.user_id);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    const fromAccount = db.accounts.find(a => a.user_id === req.user.id && a.currency === 'USD');
    if (!fromAccount) {
      return res.status(404).json({ error: 'Your USD account not found' });
    }
    
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'transfer',
      amount,
      currency: 'USD',
      from_user_id: req.user.id,
      to_user_id: recipient.id,
      from_account_number: fromAccount.account_number,
      to_account_number: toAccount.account_number,
      description: description || 'Transfer',
      sender_name: req.user.full_name,
      status: 'pending_bbc',
      step: 1,
      created_at: new Date().toISOString()
    };
    
    db.pendingTransactions.push(transaction);
    
    const bbcCodes = generateBBCodesForTransaction(reference, req.user.id, 'transaction');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    
    res.json({
      success: true,
      message: firstBbc.display_message,
      reference,
      nextStep: 2,
      bbc_code: firstBbc.code
    });
  } catch (error) {
    log.error('Send step1 error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

app.post('/api/send/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.from_user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 1 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 2;
    
    const step2Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step2Bbc?.display_message || 'Enter BBC Security Code',
      nextStep: 3,
      bbc_code: step2Bbc?.code || null
    });
  } catch (error) {
    log.error('Send step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/send/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.from_user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 3;
    
    const step3Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step3Bbc?.display_message || 'Enter BBC Final Code',
      nextStep: 4,
      bbc_code: step3Bbc?.code || null
    });
  } catch (error) {
    log.error('Send step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/send/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.from_user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    
    const result = await completeTransaction(transaction, req, res);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Transfer completed successfully!',
        newBalance: result.newBalance,
        receipt: result.transaction.reference
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error('Send step4 error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

// === AIRTIME ===
app.post('/api/airtime/step1', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, countryCode, network, amount, transactionPin } = req.body;
    
    const validPin = await bcrypt.compare(transactionPin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    
    const fromAccount = db.accounts.find(a => a.user_id === req.user.id && a.currency === 'USD');
    if (!fromAccount) {
      return res.status(404).json({ error: 'Your USD account not found' });
    }
    
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'airtime',
      phoneNumber,
      countryCode: countryCode || '234',
      network,
      amount,
      user_id: req.user.id,
      from_account_number: fromAccount.account_number,
      sender_name: req.user.full_name,
      status: 'pending_bbc',
      step: 1,
      created_at: new Date().toISOString()
    };
    
    db.pendingTransactions.push(transaction);
    
    const bbcCodes = generateBBCodesForTransaction(reference, req.user.id, 'airtime');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    
    res.json({
      success: true,
      message: firstBbc.display_message,
      reference,
      nextStep: 2,
      bbc_code: firstBbc.code
    });
  } catch (error) {
    log.error('Airtime step1 error:', error);
    res.status(500).json({ error: 'Airtime purchase failed' });
  }
});

app.post('/api/airtime/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 1 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 2;
    
    const step2Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step2Bbc?.display_message || 'Enter BBC Security Code',
      nextStep: 3,
      bbc_code: step2Bbc?.code || null
    });
  } catch (error) {
    log.error('Airtime step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/airtime/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 3;
    
    const step3Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step3Bbc?.display_message || 'Enter BBC Final Code',
      nextStep: 4,
      bbc_code: step3Bbc?.code || null
    });
  } catch (error) {
    log.error('Airtime step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/airtime/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    
    const result = await completeTransaction(transaction, req, res);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Airtime purchased successfully!',
        newBalance: result.newBalance,
        receipt: result.transaction.reference
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error('Airtime step4 error:', error);
    res.status(500).json({ error: 'Airtime purchase failed' });
  }
});

// === BILLS ===
app.post('/api/bills/step1', authMiddleware, async (req, res) => {
  try {
    const { billType, provider, accountNumber, amount, transactionPin, country } = req.body;
    
    const validPin = await bcrypt.compare(transactionPin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    
    const fromAccount = db.accounts.find(a => a.user_id === req.user.id && a.currency === 'USD');
    if (!fromAccount) {
      return res.status(404).json({ error: 'Your USD account not found' });
    }
    
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'bill_payment',
      billType,
      provider,
      accountNumber,
      amount,
      country: country || 'US',
      user_id: req.user.id,
      from_account_number: fromAccount.account_number,
      sender_name: req.user.full_name,
      status: 'pending_bbc',
      step: 1,
      created_at: new Date().toISOString()
    };
    
    db.pendingTransactions.push(transaction);
    
    const bbcCodes = generateBBCodesForTransaction(reference, req.user.id, 'bills');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    
    res.json({
      success: true,
      message: firstBbc.display_message,
      reference,
      nextStep: 2,
      bbc_code: firstBbc.code
    });
  } catch (error) {
    log.error('Bills step1 error:', error);
    res.status(500).json({ error: 'Bill payment failed' });
  }
});

app.post('/api/bills/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 1 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 2;
    
    const step2Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step2Bbc?.display_message || 'Enter BBC Security Code',
      nextStep: 3,
      bbc_code: step2Bbc?.code || null
    });
  } catch (error) {
    log.error('Bills step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/bills/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 3;
    
    const step3Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step3Bbc?.display_message || 'Enter BBC Final Code',
      nextStep: 4,
      bbc_code: step3Bbc?.code || null
    });
  } catch (error) {
    log.error('Bills step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/bills/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    
    const result = await completeTransaction(transaction, req, res);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Bill payment successful!',
        newBalance: result.newBalance,
        receipt: result.transaction.reference
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error('Bills step4 error:', error);
    res.status(500).json({ error: 'Bill payment failed' });
  }
});

// === DATA ===
app.post('/api/data/step1', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, countryCode, network, planName, dataSize, amount, transactionPin } = req.body;
    
    const validPin = await bcrypt.compare(transactionPin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    
    const fromAccount = db.accounts.find(a => a.user_id === req.user.id && a.currency === 'USD');
    if (!fromAccount) {
      return res.status(404).json({ error: 'Your USD account not found' });
    }
    
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'data_bundle',
      phoneNumber,
      countryCode: countryCode || '234',
      network,
      planName,
      dataSize,
      amount,
      user_id: req.user.id,
      from_account_number: fromAccount.account_number,
      sender_name: req.user.full_name,
      status: 'pending_bbc',
      step: 1,
      created_at: new Date().toISOString()
    };
    
    db.pendingTransactions.push(transaction);
    
    const bbcCodes = generateBBCodesForTransaction(reference, req.user.id, 'data');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    
    res.json({
      success: true,
      message: firstBbc.display_message,
      reference,
      nextStep: 2,
      bbc_code: firstBbc.code
    });
  } catch (error) {
    log.error('Data step1 error:', error);
    res.status(500).json({ error: 'Data purchase failed' });
  }
});

app.post('/api/data/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 1 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 2;
    
    const step2Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step2Bbc?.display_message || 'Enter BBC Security Code',
      nextStep: 3,
      bbc_code: step2Bbc?.code || null
    });
  } catch (error) {
    log.error('Data step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/data/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 3;
    
    const step3Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step3Bbc?.display_message || 'Enter BBC Final Code',
      nextStep: 4,
      bbc_code: step3Bbc?.code || null
    });
  } catch (error) {
    log.error('Data step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/data/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    
    const result = await completeTransaction(transaction, req, res);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Data bundle purchased successfully!',
        newBalance: result.newBalance,
        receipt: result.transaction.reference
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error('Data step4 error:', error);
    res.status(500).json({ error: 'Data purchase failed' });
  }
});

// === WITHDRAW ===
app.post('/api/withdraw/step1', authMiddleware, async (req, res) => {
  try {
    const { bankName, accountHolder, bankAccountNumber, routingNumber, amount, transactionPin } = req.body;
    
    const validPin = await bcrypt.compare(transactionPin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    
    const fromAccount = db.accounts.find(a => a.user_id === req.user.id && a.currency === 'USD');
    if (!fromAccount) {
      return res.status(404).json({ error: 'Your USD account not found' });
    }
    
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'withdrawal',
      bankName,
      accountHolder,
      bankAccountNumber,
      routingNumber,
      amount,
      user_id: req.user.id,
      from_account_number: fromAccount.account_number,
      sender_name: req.user.full_name,
      status: 'pending_bbc',
      step: 1,
      created_at: new Date().toISOString()
    };
    
    db.pendingTransactions.push(transaction);
    
    const bbcCodes = generateBBCodesForTransaction(reference, req.user.id, 'withdraw');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    
    res.json({
      success: true,
      message: firstBbc.display_message,
      reference,
      nextStep: 2,
      bbc_code: firstBbc.code
    });
  } catch (error) {
    log.error('Withdraw step1 error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

app.post('/api/withdraw/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 1 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 2;
    
    const step2Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step2Bbc?.display_message || 'Enter BBC Security Code',
      nextStep: 3,
      bbc_code: step2Bbc?.code || null
    });
  } catch (error) {
    log.error('Withdraw step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/withdraw/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 2 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    transaction.step = 3;
    
    const step3Bbc = db.bbcCodes.find(b => 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    res.json({
      success: true,
      message: step3Bbc?.display_message || 'Enter BBC Final Code',
      nextStep: 4,
      bbc_code: step3Bbc?.code || null
    });
  } catch (error) {
    log.error('Withdraw step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/withdraw/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    
    const transaction = db.pendingTransactions.find(t => t.reference === reference && t.user_id === req.user.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const bbc = db.bbcCodes.find(b => 
      b.code === bbcCode && 
      b.transaction_id === reference && 
      b.step === 3 &&
      !b.is_used
    );
    
    if (!bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }
    
    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }
    
    bbc.is_used = true;
    bbc.used_at = new Date().toISOString();
    
    const result = await completeTransaction(transaction, req, res);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Withdrawal successful! Funds will be sent to your bank account.',
        newBalance: result.newBalance,
        receipt: result.transaction.reference
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error('Withdraw step4 error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

// ==================== ADMIN ROUTES ====================
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const usersWithDetails = db.users.map(user => {
      const userAccounts = db.accounts.filter(a => a.user_id === user.id);
      const totalBalance = userAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];
      
      return {
        id: user.id,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        is_active: user.is_active,
        is_admin: user.is_admin || false,
        is_unlimited: user.is_unlimited || false,
        account_level: user.account_level,
        is_verified: user.is_verified,
        login_count: user.login_count || 0,
        last_login: user.last_login || null,
        created_at: user.created_at,
        account_number: primaryAccount?.account_number || 'N/A',
        iban: primaryAccount?.iban || 'N/A',
        currency: primaryAccount?.currency || 'USD',
        totalBalance: totalBalance,
        accountCount: userAccounts.length,
        transactionCount: db.transactions.filter(t => t.from_user_id === user.id || t.to_user_id === user.id).length,
        cardCount: db.cards.filter(c => c.user_id === user.id).length,
        loanCount: db.loans.filter(l => l.user_id === user.id).length,
        bbcCount: db.bbcCodes.filter(b => b.user_id === user.id).length
      };
    });
    res.json(usersWithDetails);
  } catch (error) {
    log.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.post('/api/admin/toggle-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.is_admin) {
      return res.status(400).json({ error: 'Cannot modify admin account' });
    }
    user.is_active = !user.is_active;
    res.json({ success: true, message: `User ${user.is_active ? 'activated' : 'frozen'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = db.users[userIndex];
    if (user.is_admin) {
      return res.status(400).json({ error: 'Cannot delete admin account' });
    }
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    db.accounts = db.accounts.filter(a => a.user_id !== userId);
    db.transactions = db.transactions.filter(t => t.from_user_id !== userId && t.to_user_id !== userId);
    db.cards = db.cards.filter(c => c.user_id !== userId);
    db.loans = db.loans.filter(l => l.user_id !== userId);
    db.supportTickets = db.supportTickets.filter(s => s.user_id !== userId);
    db.bbcCodes = db.bbcCodes.filter(b => b.user_id !== userId);
    db.airtimeHistory = db.airtimeHistory.filter(a => a.user_id !== userId);
    db.billHistory = db.billHistory.filter(b => b.user_id !== userId);
    db.dataHistory = db.dataHistory.filter(d => d.user_id !== userId);
    db.withdrawHistory = db.withdrawHistory.filter(w => w.user_id !== userId);
    db.users.splice(userIndex, 1);
    res.json({ success: true, message: `User ${user.full_name} deleted` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/api/admin/bbc/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bbcCodes = db.bbcCodes.filter(b => b.user_id === req.params.userId);
    res.json(bbcCodes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get BBC codes' });
  }
});

app.post('/api/admin/generate-bbc', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, step, quantity = 1, expiryDays = 30 } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const codes = [];
    const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    
    for (let i = 0; i < quantity; i++) {
      const bbcData = generateBBCode(parseInt(step), 'transaction');
      const bbc = {
        id: uuidv4(),
        code: bbcData.code,
        step: bbcData.step,
        display_message: bbcData.display_message,
        hidden_purpose: bbcData.hidden_purpose,
        security_flag: bbcData.security_flag,
        type: bbcData.type,
        user_id: userId,
        is_used: false,
        used_at: null,
        expires_at: expiryDate.toISOString(),
        created_at: new Date().toISOString()
      };
      db.bbcCodes.push(bbc);
      codes.push(bbc);
    }
    
    res.json({ success: true, message: `Generated ${codes.length} BBC codes`, codes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate BBC codes' });
  }
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stats = {
      totalUsers: db.users.length,
      activeUsers: db.users.filter(u => u.is_active).length,
      totalAccounts: db.accounts.length,
      totalBalance: db.accounts.reduce((sum, a) => sum + a.balance, 0),
      totalTransactions: db.transactions.length,
      totalBBCodes: db.bbcCodes.length,
      totalCards: db.cards.length,
      totalLoans: db.loans.length,
      totalAirtime: db.airtimeHistory.length,
      totalBills: db.billHistory.length,
      totalData: db.dataHistory.length,
      totalWithdrawals: db.withdrawHistory.length
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    baseUrl: 'https://prime-heritage-bank.onrender.com'
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  log.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 10000;

const startServer = async () => {
  await createDefaultAdmin();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('🏦 Prime Heritage International Bank Server');
    console.log('='.repeat(70));
    console.log(`📍 URL: https://prime-heritage-bank.onrender.com`);
    console.log(`👑 Admin: devgift@gmail.com / Igwe`);
    console.log(`💰 Admin Balance: UNLIMITED`);
    console.log(`👥 Users: ${db.users.length}`);
    console.log(`📊 Accounts: ${db.accounts.length}`);
    console.log(`📧 Email Templates: INLINE (No external files needed)`);
    console.log(`🔐 BBC Security: 3-Step Hidden Verification Active`);
    console.log(`📧 Test email will be sent to devgift@gmail.com`);
    console.log(`💡 New users start with $0 balance`);
    console.log('='.repeat(70) + '\n');
  });
};

startServer();

module.exports = app;
