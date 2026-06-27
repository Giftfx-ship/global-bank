const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// ==================== NETLIFY EMAIL FUNCTION ====================
const NETLIFY_EMAIL_URL = process.env.NETLIFY_EMAIL_URL || 
  'https://primeheritagebank.netlify.app/.netlify/functions/send-email';

const sendEmailViaNetlify = async (to, subject, html) => {
  try {
    log.email(`📤 Sending email to: ${to}`);
    log.email(`📤 Subject: ${subject}`);
    
    const response = await fetch(NETLIFY_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    });
    
    const data = await response.json();
    log.email(`📤 Response: ${JSON.stringify(data)}`);
    
    if (data.success) {
      log.success(`✅ Email sent to: ${to}`);
      return true;
    } else {
      log.error('Netlify error:', data.error);
      return false;
    }
  } catch (error) {
    log.error('Netlify email error:', error);
    return false;
  }
};

// ==================== EMAIL FUNCTIONS ====================

const sendWelcomeEmail = async (userData) => {
  try {
    const html = getWelcomeHTML(userData);
    const result = await sendEmailViaNetlify(
      userData.email,
      '🎉 Welcome to Prime Heritage International Bank!',
      html
    );
    if (result) log.email('✅ Welcome email sent to: ' + userData.email);
    return result;
  } catch (error) {
    log.error('❌ Welcome email failed:', error);
    return false;
  }
};

const sendReceiptEmail = async (transaction, user) => {
  try {
    const html = getReceiptHTML(transaction, user);
    const result = await sendEmailViaNetlify(
      user.email,
      `🧾 Receipt for ${transaction.type || 'Transaction'} - ${transaction.reference || 'N/A'}`,
      html
    );
    if (result) log.email('✅ Receipt email sent to: ' + user.email);
    return result;
  } catch (error) {
    log.error('❌ Receipt email failed:', error);
    return false;
  }
};

const sendTestEmail = async () => {
  try {
    const html = getTestHTML();
    const result = await sendEmailViaNetlify(
      'devvgift@gmail.com',
      '🚀 Prime Heritage Bank - Server Started!',
      html
    );
    if (result) log.email('✅ Test email sent to devgift@gmail.com');
    return result;
  } catch (error) {
    log.error('Test email failed:', error);
    return false;
  }
};

// ==================== EMAIL TEMPLATES ====================
const getWelcomeHTML = (userData) => {
  const { full_name, email, account_level } = userData;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Prime Heritage Bank</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #080C18;
          margin: 0;
          padding: 40px 20px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #0E1525;
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(198,164,63,0.06);
          position: relative;
        }

        .email-wrapper::before {
          content: '';
          position: absolute;
          top: -40%;
          right: -30%;
          width: 70%;
          height: 70%;
          background: radial-gradient(circle, rgba(198,164,63,0.03) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ===== HEADER ===== */
        .header {
          background: linear-gradient(160deg, #080C18 0%, #111D35 45%, #0E1525 100%);
          padding: 44px 40px 30px;
          text-align: center;
          position: relative;
          border-bottom: 1px solid rgba(198,164,63,0.08);
        }

        .header::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 10%;
          right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(198,164,63,0.2), rgba(198,164,63,0.4), rgba(198,164,63,0.2), transparent);
          background-size: 200% 100%;
          animation: shimmer 4s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .header .crest {
          font-size: 38px;
          display: block;
          margin-bottom: 10px;
          letter-spacing: -2px;
          opacity: 0.9;
        }

        .header h1 {
          font-family: 'Playfair Display', serif;
          color: #FFFFFF;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 2px;
          margin: 0;
        }

        .header h1 .gold {
          background: linear-gradient(135deg, #C6A43F, #D4B85A, #C6A43F);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 200% 200%;
          animation: goldShine 4s ease-in-out infinite;
        }

        @keyframes goldShine {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .header .tagline {
          color: rgba(255,255,255,0.15);
          font-size: 9px;
          letter-spacing: 5px;
          text-transform: uppercase;
          margin-top: 6px;
          font-weight: 400;
        }

        .header .badge {
          display: inline-block;
          margin-top: 14px;
          padding: 4px 20px;
          background: rgba(198,164,63,0.06);
          border: 1px solid rgba(198,164,63,0.08);
          border-radius: 50px;
          color: rgba(198,164,63,0.5);
          font-size: 8px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 500;
        }

        /* ===== BODY ===== */
        .body-content {
          padding: 38px 40px 30px;
          background: #0E1525;
          position: relative;
        }

        .greeting {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 4px;
          letter-spacing: -0.3px;
        }

        .greeting .highlight {
          background: linear-gradient(135deg, #C6A43F, #E8D07A);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .greeting .wave {
          display: inline-block;
          animation: wave 2.5s infinite;
        }

        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(16deg); }
          75% { transform: rotate(-6deg); }
        }

        .greeting-sub {
          color: rgba(255,255,255,0.2);
          font-size: 11px;
          letter-spacing: 1px;
          font-weight: 300;
          margin-bottom: 16px;
        }

        .message-text {
          color: rgba(255,255,255,0.65);
          line-height: 1.9;
          font-size: 14px;
          font-weight: 300;
          margin-bottom: 24px;
        }

        .message-text strong {
          color: #FFFFFF;
          font-weight: 500;
        }

        .message-text .highlight-text {
          color: #C6A43F;
        }

        .divider-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(198,164,63,0.08), rgba(198,164,63,0.15), rgba(198,164,63,0.08), transparent);
          margin: 24px 0 28px;
        }

        /* ===== ACCOUNT CARD ===== */
        .account-card {
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 16px;
          padding: 22px 26px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .account-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(198,164,63,0.02), transparent);
          pointer-events: none;
        }

        .account-card .card-title {
          color: rgba(255,255,255,0.2);
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 2.5px;
          margin-bottom: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .account-card .card-title i {
          font-style: normal;
          font-size: 12px;
        }

        .account-card .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 0;
          border-bottom: 1px solid rgba(255,255,255,0.02);
          font-size: 13px;
        }

        .account-card .row:last-child {
          border-bottom: none;
        }

        .account-card .label {
          color: rgba(255,255,255,0.25);
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.3px;
        }

        .account-card .value {
          color: #FFFFFF;
          font-weight: 500;
          font-family: 'JetBrains Mono', 'Inter', monospace;
          font-size: 12px;
          letter-spacing: 0.3px;
        }

        .account-card .value.golden {
          color: #C6A43F;
        }

        .account-card .value.status {
          color: #34D399;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .account-card .value.status::before {
          content: '';
          display: inline-block;
          width: 5px;
          height: 5px;
          background: #34D399;
          border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        /* ===== FEATURES ===== */
        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 22px 0 28px;
        }

        .feature-item {
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 14px;
          padding: 14px 16px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .feature-item .icon {
          font-size: 22px;
          display: block;
          margin-bottom: 4px;
          opacity: 0.8;
        }

        .feature-item .label {
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          font-size: 11px;
          display: block;
          letter-spacing: 0.2px;
        }

        .feature-item .desc {
          color: rgba(255,255,255,0.2);
          font-size: 9px;
          margin-top: 2px;
          letter-spacing: 0.5px;
        }

        /* ===== BUTTONS ===== */
        .btn-wrap {
          text-align: center;
          margin: 26px 0 4px;
        }

        .btn-primary {
          display: inline-block;
          background: linear-gradient(135deg, #C6A43F, #A8882E);
          color: #080C18;
          padding: 16px 52px;
          text-decoration: none;
          border-radius: 60px;
          font-weight: 600;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.5px;
          box-shadow: 0 8px 32px rgba(198,164,63,0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: center;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 48px rgba(198,164,63,0.25);
        }

        .btn-primary:active {
          transform: translateY(0px);
        }

        .btn-secondary {
          display: inline-block;
          background: transparent;
          color: rgba(255,255,255,0.35);
          padding: 12px 36px;
          text-decoration: none;
          border-radius: 60px;
          font-weight: 500;
          font-size: 12px;
          font-family: 'Inter', sans-serif;
          border: 1px solid rgba(255,255,255,0.04);
          margin-top: 10px;
          transition: all 0.3s ease;
          width: 100%;
          text-align: center;
        }

        .btn-secondary:hover {
          border-color: rgba(198,164,63,0.2);
          color: #C6A43F;
        }

        .btn-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* ===== FOOTER ===== */
        .footer-section {
          background: rgba(255,255,255,0.005);
          padding: 28px 40px 24px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.02);
        }

        .footer-section .brand-name {
          color: rgba(255,255,255,0.25);
          font-weight: 500;
          font-size: 12px;
          letter-spacing: 2px;
          font-family: 'Playfair Display', serif;
        }

        .footer-section p {
          color: rgba(255,255,255,0.08);
          font-size: 9px;
          margin: 4px 0;
          line-height: 1.8;
          font-weight: 300;
          letter-spacing: 0.3px;
        }

        .footer-section .social-icons {
          margin: 14px 0 10px;
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .footer-section .social-icons span {
          color: rgba(255,255,255,0.04);
          font-size: 16px;
          transition: all 0.3s;
          cursor: default;
        }

        .footer-section .social-icons span:hover {
          color: rgba(198,164,63,0.2);
        }

        .footer-section .disclaimer {
          font-size: 8px;
          color: rgba(255,255,255,0.03);
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.02);
          letter-spacing: 0.5px;
        }

        .footer-section .email-ref {
          font-size: 8px;
          color: rgba(255,255,255,0.04);
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.3px;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 520px) {
          body { padding: 16px 12px; }
          .email-wrapper { border-radius: 20px; }
          .header { padding: 32px 20px 22px; }
          .header h1 { font-size: 22px; }
          .body-content { padding: 26px 20px 20px; }
          .greeting { font-size: 20px; }
          .features-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
          .feature-item { padding: 12px 10px; }
          .feature-item .icon { font-size: 18px; }
          .feature-item .label { font-size: 10px; }
          .account-card { padding: 16px 18px; }
          .account-card .row { flex-direction: column; align-items: flex-start; gap: 2px; padding: 9px 0; }
          .account-card .value { text-align: left; }
          .btn-primary { padding: 14px 28px; font-size: 13px; }
          .btn-secondary { padding: 10px 20px; font-size: 11px; }
          .footer-section { padding: 20px; }
          .header .crest { font-size: 32px; }
        }

        /* ===== LIGHT MODE ===== */
        @media (prefers-color-scheme: light) {
          body { background: #f4f6f9; }
          .email-wrapper {
            background: #ffffff;
            box-shadow: 0 30px 60px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02);
          }
          .header {
            background: linear-gradient(160deg, #ffffff 0%, #f8f6f0 45%, #ffffff 100%);
            border-bottom: 1px solid rgba(198,164,63,0.08);
          }
          .header h1 { color: #0A0E1A; }
          .header .tagline { color: rgba(0,0,0,0.08); }
          .header .badge { color: rgba(198,164,63,0.4); border-color: rgba(198,164,63,0.1); }
          .body-content { background: #ffffff; }
          .greeting { color: #0A0E1A; }
          .greeting-sub { color: rgba(0,0,0,0.15); }
          .message-text { color: rgba(0,0,0,0.55); }
          .message-text strong { color: #0A0E1A; }
          .account-card { background: rgba(0,0,0,0.01); border-color: rgba(0,0,0,0.03); }
          .account-card .value { color: #0A0E1A; }
          .account-card .label { color: rgba(0,0,0,0.25); }
          .account-card .card-title { color: rgba(0,0,0,0.15); }
          .feature-item { background: rgba(0,0,0,0.01); border-color: rgba(0,0,0,0.03); }
          .feature-item .label { color: rgba(0,0,0,0.6); }
          .feature-item .desc { color: rgba(0,0,0,0.15); }
          .btn-secondary { color: rgba(0,0,0,0.3); border-color: rgba(0,0,0,0.04); }
          .btn-secondary:hover { border-color: #C6A43F; color: #C6A43F; }
          .footer-section { border-color: rgba(0,0,0,0.02); }
          .footer-section .brand-name { color: rgba(0,0,0,0.2); }
          .footer-section p { color: rgba(0,0,0,0.06); }
          .footer-section .social-icons span { color: rgba(0,0,0,0.04); }
          .divider-line { background: linear-gradient(90deg, transparent, rgba(198,164,63,0.08), rgba(198,164,63,0.15), rgba(198,164,63,0.08), transparent); }
          .account-card::before { background: linear-gradient(135deg, rgba(198,164,63,0.03), transparent); }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- HEADER -->
        <div class="header">
          <span class="crest">✦</span>
          <h1>Prime Heritage <span class="gold">Bank</span></h1>
          <div class="tagline">International Private Banking</div>
          <div class="badge">✦ Established 2026 ✦</div>
        </div>

        <!-- BODY -->
        <div class="body-content">
          <div class="greeting">
            <span class="wave">👋</span> Welcome, <span class="highlight">${full_name}</span>
          </div>
          <div class="greeting-sub">Your Private Banking Journey Begins</div>

          <div class="message-text">
            <strong>We are honoured to welcome you to Prime Heritage International Bank.</strong><br>
            Your account has been established with the highest standards of <span class="highlight-text">security</span> and <span class="highlight-text">service excellence</span>. We are committed to delivering an unparalleled private banking experience.
          </div>

          <div class="divider-line"></div>

          <!-- ACCOUNT CARD -->
          <div class="account-card">
            <div class="card-title"><i>▸</i> Account Summary</div>
            <div class="row">
              <span class="label">Account Holder</span>
              <span class="value">${full_name}</span>
            </div>
            <div class="row">
              <span class="label">Email Address</span>
              <span class="value">${email}</span>
            </div>
            <div class="row">
              <span class="label">Account Level</span>
              <span class="value golden">${account_level || 'Standard'}</span>
            </div>
            <div class="row">
              <span class="label">Status</span>
              <span class="value status">Active</span>
            </div>
          </div>

          <!-- FEATURES -->
          <div class="features-grid">
            <div class="feature-item">
              <span class="icon">🌍</span>
              <span class="label">Multi-Currency</span>
              <span class="desc">USD • EUR • GBP • NGN</span>
            </div>
            <div class="feature-item">
              <span class="icon">💳</span>
              <span class="label">Global Cards</span>
              <span class="desc">Visa • Mastercard • AMEX</span>
            </div>
            <div class="feature-item">
              <span class="icon">🔐</span>
              <span class="label">BBC Security</span>
              <span class="desc">3-Step Verification</span>
            </div>
            <div class="feature-item">
              <span class="icon">⚡</span>
              <span class="label">Instant Transfers</span>
              <span class="desc">SWIFT • SEPA • ACH</span>
            </div>
          </div>

          <!-- BUTTONS -->
          <div class="btn-wrap">
            <div class="btn-group">
              <a href="${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}/dashboard.html" class="btn-primary">🚀 Access Your Dashboard</a>
              <a href="${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}/login.html" class="btn-secondary">🔐 Secure Sign In</a>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="footer-section">
          <div class="brand-name">✦ Prime Heritage International Bank ✦</div>
          <p>Global Banking • Privacy Assured • Excellence Delivered</p>
          <div class="social-icons">
            <span>📱</span>
            <span>🌐</span>
            <span>🔒</span>
            <span>⚡</span>
          </div>
          <p>© ${new Date().getFullYear()} Prime Heritage International Bank. All rights reserved.</p>
          <div class="email-ref">✉ ${email}</div>
          <div class="disclaimer">Transfers made easy. once agin welcome.</div>
        </div>
      </div>
    </body>
    </html>
  `;
};
const getReceiptHTML = (transaction, user) => {
  const receiptUrl = `${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}/receipt.html?ref=${transaction.reference}`;
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700;800&display=swap');
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
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .header .logo-icon { font-size: 40px; display: block; margin-bottom: 4px; }
        .header h1 {
          font-family: 'Playfair Display', serif;
          color: #FFFFFF;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }
        .header h1 .gold {
          background: linear-gradient(135deg, #C6A43F, #E8D07A);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .header .subtitle {
          color: rgba(255,255,255,0.12);
          font-size: 9px;
          letter-spacing: 5px;
          text-transform: uppercase;
          margin-top: 2px;
          font-weight: 300;
        }
        .body-content {
          padding: 32px 44px 24px;
          background: #0B1120;
        }
        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .receipt-id {
          display: inline-block;
          padding: 5px 20px;
          background: rgba(198,164,63,0.08);
          border: 1px solid rgba(198,164,63,0.12);
          border-radius: 50px;
          color: #C6A43F;
          font-size: 11px;
          font-weight: 600;
          font-family: 'Inter', monospace;
          letter-spacing: 0.5px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 16px;
          border-radius: 50px;
          font-size: 10px;
          font-weight: 600;
          background: rgba(16,185,129,0.08);
          color: #34D399;
          border: 1px solid rgba(16,185,129,0.12);
        }
        .amount-section {
          text-align: center;
          padding: 20px 0 18px;
          margin: 12px 0 16px;
          border-top: 1px solid rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .amount-section .amount-label {
          color: rgba(255,255,255,0.2);
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 500;
        }
        .amount-section .amount {
          font-size: 40px;
          font-weight: 800;
          color: #FFFFFF;
          letter-spacing: -0.5px;
          margin-top: 2px;
        }
        .amount-section .amount .currency {
          color: #C6A43F;
          font-size: 28px;
          margin-right: 4px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 24px;
          margin: 16px 0 8px;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .detail-item.full-width {
          grid-column: 1 / -1;
        }
        .detail-item .label {
          color: rgba(255,255,255,0.3);
          font-size: 11px;
          font-weight: 400;
        }
        .detail-item .value {
          color: #FFFFFF;
          font-weight: 500;
          font-size: 12px;
          text-align: right;
        }
        .detail-item .value.mono {
          font-family: 'Inter', monospace;
          font-size: 11px;
          letter-spacing: 0.3px;
        }
        .detail-item .value.gold-text { color: #C6A43F; }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          margin: 16px 0;
        }
        .btn-wrap {
          text-align: center;
          margin: 22px 0 6px;
        }
        .view-btn {
          display: inline-block;
          background: linear-gradient(135deg, #C6A43F, #A8882E);
          color: #060A14;
          padding: 14px 48px;
          text-decoration: none;
          border-radius: 60px;
          font-weight: 700;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 8px 32px rgba(198,164,63,0.25);
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
        }
        .view-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 48px rgba(198,164,63,0.4);
        }
        .footer-section {
          background: rgba(255,255,255,0.01);
          padding: 24px 44px 20px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.03);
        }
        .footer-section .brand-name {
          color: rgba(255,255,255,0.3);
          font-weight: 500;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        .footer-section p {
          color: rgba(255,255,255,0.12);
          font-size: 10px;
          margin: 3px 0;
          line-height: 1.6;
        }
        .footer-section .footer-meta {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 8px;
          font-size: 9px;
          color: rgba(255,255,255,0.06);
        }
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 120px;
          opacity: 0.015;
          pointer-events: none;
          font-weight: 900;
          color: #C6A43F;
          user-select: none;
          letter-spacing: 20px;
          font-family: 'Playfair Display', serif;
        }
        @media (max-width: 520px) {
          .email-wrapper { margin: 20px 12px; border-radius: 24px; }
          .header { padding: 28px 20px 20px; }
          .header h1 { font-size: 20px; }
          .body-content { padding: 24px 20px 16px; }
          .amount-section .amount { font-size: 30px; }
          .detail-grid { grid-template-columns: 1fr; }
          .detail-item { padding: 10px 0; }
          .detail-item .value { text-align: left; }
          .view-btn { padding: 12px 28px; font-size: 13px; width: 100%; }
          .footer-section { padding: 16px 20px; }
          .top-bar { flex-direction: column; gap: 8px; align-items: flex-start; }
        }
        @media (prefers-color-scheme: light) {
          body { background: #f0f2f5; }
          .email-wrapper { background: #ffffff; box-shadow: 0 30px 60px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.04); }
          .header { background: linear-gradient(165deg, #ffffff, #f8f6f0); border-bottom: 2px solid rgba(198,164,63,0.15); }
          .header h1 { color: #0A0E1A; }
          .body-content { background: #ffffff; }
          .amount-section .amount { color: #0A0E1A; }
          .detail-item .value { color: #0A0E1A; }
          .detail-item .label { color: rgba(0,0,0,0.35); }
          .footer-section { border-color: rgba(0,0,0,0.04); }
          .footer-section .brand-name { color: rgba(0,0,0,0.3); }
          .footer-section p { color: rgba(0,0,0,0.12); }
          .divider { background: linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent); }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="watermark">RECEIPT</div>
        <div class="header">
          <span class="logo-icon">🏛️</span>
          <h1>Prime Heritage <span class="gold">Bank</span></h1>
          <div class="subtitle">International Banking</div>
        </div>
        <div class="body-content">
          <div class="top-bar">
            <span class="receipt-id">#${transaction.reference || 'N/A'}</span>
            <span class="status-badge">✅ COMPLETED</span>
          </div>

          <div class="amount-section">
            <div class="amount-label">Total Amount</div>
            <div class="amount">
              <span class="currency">${transaction.currency || 'USD'}</span> 
              ${(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">📋 Transaction Type</span>
              <span class="value">${transaction.type || 'Transaction'}</span>
            </div>
            <div class="detail-item full-width">
              <span class="label">📝 Description</span>
              <span class="value">${transaction.description || transaction.purpose || 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="label">📅 Date</span>
              <span class="value">${dateStr}</span>
            </div>
            <div class="detail-item">
              <span class="label">⏰ Time</span>
              <span class="value">${timeStr}</span>
            </div>
            <div class="detail-item full-width">
              <span class="label">🔗 Reference</span>
              <span class="value mono gold-text">${transaction.reference || 'N/A'}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="btn-wrap">
            <a href="${receiptUrl}" class="view-btn">🧾 View Full Receipt</a>
          </div>
          <div style="text-align:center;font-size:10px;color:rgba(255,255,255,0.10);margin-top:10px;">
            This is an automated receipt for your transaction.
          </div>
        </div>
        <div class="footer-section">
          <div class="brand-name">✦ Prime Heritage International Bank ✦</div>
          <p>Global Banking • Privacy Assured • Excellence Delivered</p>
          <p>© ${new Date().getFullYear()} Prime Heritage International Bank</p>
          <p style="font-size:9px;">Sent to ${user.email}</p>
          <div class="footer-meta">
            <span>🔒 Secured Transaction</span>
            <span>🌍 Global Transfer</span>
            <span>📱 Mobile Ready</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
const getTestHTML = () => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Started | Prime Heritage Bank</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #060A14;
          padding: 20px;
          color: #FFFFFF;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 560px;
          margin: 0 auto;
          background: #0B1120;
          border-radius: 28px;
          padding: 32px;
          border: 1px solid rgba(198,164,63,0.08);
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
          position: relative;
          overflow: hidden;
        }
        .container::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(198,164,63,0.03) 0%, transparent 70%);
          pointer-events: none;
        }
        .header {
          background: linear-gradient(165deg, #060A14, #0F1A2E);
          padding: 32px;
          text-align: center;
          border-radius: 16px 16px 0 0;
          margin: -32px -32px 24px -32px;
          border-bottom: 2px solid rgba(198,164,63,0.12);
          position: relative;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 20%;
          right: 20%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #C6A43F, #E8D07A, #C6A43F, transparent);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .header .emoji-big { font-size: 48px; display: block; margin-bottom: 8px; }
        .header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .header .gold {
          background: linear-gradient(135deg, #C6A43F, #E8D07A);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .header .sub {
          color: rgba(255,255,255,0.15);
          font-size: 10px;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-top: 6px;
          font-weight: 300;
        }
        .body-content { padding: 8px 0 4px; }
        .title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
          letter-spacing: -0.3px;
        }
        .title .check { color: #34D399; margin-right: 8px; }
        .success-box {
          background: rgba(16,185,129,0.06);
          border: 1px solid rgba(16,185,129,0.1);
          color: #34D399;
          padding: 18px 22px;
          border-radius: 14px;
          border-left: 3px solid #10B981;
          margin: 16px 0;
        }
        .success-box strong { display: block; font-size: 14px; margin-bottom: 4px; }
        .success-box span { font-size: 13px; opacity: 0.8; }
        .info-box {
          background: rgba(59,130,246,0.04);
          border: 1px solid rgba(59,130,246,0.08);
          color: #60A5FA;
          padding: 16px 20px;
          border-radius: 14px;
          border-left: 3px solid #3B82F6;
          margin: 14px 0;
        }
        .info-box .row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 13px;
        }
        .info-box .row .label { opacity: 0.5; }
        .info-box .row .value { font-weight: 500; }
        .admin-box {
          background: rgba(198,164,63,0.06);
          border: 1px solid rgba(198,164,63,0.1);
          color: #C6A43F;
          padding: 16px 20px;
          border-radius: 14px;
          border-left: 3px solid #C6A43F;
          margin: 14px 0;
        }
        .admin-box .label { font-size: 12px; opacity: 0.6; display: block; margin-top: 4px; }
        .admin-box .credential {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 14px;
          font-weight: 500;
          border-bottom: 1px solid rgba(198,164,63,0.06);
        }
        .admin-box .credential:last-child { border-bottom: none; }
        .admin-box code {
          background: rgba(198,164,63,0.08);
          padding: 2px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: #C6A43F;
          font-weight: 600;
          font-family: 'Inter', monospace;
          letter-spacing: 0.5px;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          color: rgba(255,255,255,0.08);
          font-size: 10px;
          border-top: 1px solid rgba(255,255,255,0.02);
          padding-top: 20px;
          margin-top: 8px;
          letter-spacing: 0.5px;
        }
        .footer .brand { color: rgba(255,255,255,0.12); font-weight: 500; }
        .status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #34D399;
          border-radius: 50%;
          margin-right: 6px;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @media (max-width: 480px) {
          .container { padding: 20px; margin: 10px; }
          .header { margin: -20px -20px 16px -20px; padding: 24px 20px; }
          .header h1 { font-size: 22px; }
          .title { font-size: 18px; }
          .admin-box .credential { flex-direction: column; align-items: flex-start; gap: 4px; }
          .info-box .row { flex-direction: column; gap: 2px; }
        }
        @media (prefers-color-scheme: light) {
          body { background: #f0f2f5; }
          .container { background: #ffffff; box-shadow: 0 30px 60px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.04); }
          .header { background: linear-gradient(165deg, #ffffff, #f8f6f0); border-bottom: 2px solid rgba(198,164,63,0.15); }
          .header h1 { color: #0A0E1A; }
          .title { color: #0A0E1A; }
          .info-box { color: #3B82F6; background: rgba(59,130,246,0.04); }
          .admin-box { color: #C6A43F; background: rgba(198,164,63,0.06); }
          .admin-box code { color: #C6A43F; }
          .footer { color: rgba(0,0,0,0.08); }
          .footer .brand { color: rgba(0,0,0,0.12); }
          .divider { background: linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="emoji-big">🏛️</span>
          <h1>Prime Heritage <span class="gold">Bank</span></h1>
          <div class="sub">International Banking Excellence</div>
        </div>
        <div class="body-content">
          <div class="title">
            <span class="check">✅</span> Server Started Successfully!
          </div>

          <div class="success-box">
            <strong>✓ Email System is Live</strong>
            <span>Your server is running and emails are sending correctly via Netlify.</span>
          </div>

          <div class="info-box">
            <div class="row">
              <span class="label">🕐 Time</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
            <div class="row">
              <span class="label">🌍 Environment</span>
              <span class="value">Production</span>
            </div>
            <div class="row">
              <span class="label">🔗 URL</span>
              <span class="value" style="font-size:12px;">${process.env.FRONTEND_URL || 'https://prime-heritage-bank.onrender.com'}</span>
            </div>
          </div>

          <div class="admin-box">
            <div style="font-weight:600;margin-bottom:6px;">👑 Admin Access</div>
            <div class="credential">
              <span>Email</span>
              <code>devgift@gmail.com</code>
            </div>
            <div class="credential">
              <span>Password</span>
              <code>Igwe</code>
            </div>
            <span class="label"><span class="status-dot"></span> Balance: UNLIMITED</span>
          </div>

          <div class="divider"></div>

          <div style="text-align:center;font-size:13px;color:rgba(255,255,255,0.2);">
            All systems operational. Banking platform ready.
          </div>
        </div>
        <div class="footer">
          <span class="brand">✦ Prime Heritage International Bank ✦</span>
          <br>
          © ${new Date().getFullYear()} All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};

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
const BBC_EXPIRY_MINUTES = 15;

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
app.get('/airtime', servePage('airtime.html'));
app.get('/airtime.html', servePage('airtime.html'));
app.get('/bills', servePage('bills.html'));
app.get('/bills.html', servePage('bills.html'));
app.get('/cards', servePage('cards.html'));
app.get('/cards.html', servePage('cards.html'));
app.get('/dashboard', servePage('dashboard.html'));
app.get('/dashboard.html', servePage('dashboard.html'));
app.get('/data', servePage('data.html'));
app.get('/data.html', servePage('data.html'));
app.get('/loans', servePage('loans.html'));
app.get('/loans.html', servePage('loans.html'));
app.get('/profile', servePage('profile.html'));
app.get('/profile.html', servePage('profile.html'));
app.get('/send', servePage('send.html'));
app.get('/send.html', servePage('send.html'));
app.get('/support', servePage('support.html'));
app.get('/support.html', servePage('support.html'));
app.get('/withdraw', servePage('withdraw.html'));
app.get('/withdraw.html', servePage('withdraw.html'));
app.get('/receipt', servePage('receipt.html'));
app.get('/receipt.html', servePage('receipt.html'));

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

    // Send welcome email (non-blocking)
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
        is_admin: user.is_admin,
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

// ==================== API: GET ALL TRANSACTIONS (View All) ====================
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

// ==================== ADMIN GET RECEIPT ====================
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
    
    log.admin(`Sending money: ${amount} ${currency} to ${toAccountNumber} from ${senderName}`);
    
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

// ==================== SUPPORT ROUTES ====================

// Get support tickets for a user
app.get('/api/support/tickets', authMiddleware, (req, res) => {
  try {
    const tickets = db.supportTickets.filter(t => t.user_id === req.user.id);
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

// Create a new support ticket
app.post('/api/support/tickets', authMiddleware, (req, res) => {
  try {
    const { subject, message, category } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    
    const ticket = {
      id: uuidv4(),
      user_id: req.user.id,
      subject,
      message,
      category: category || 'General',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    db.supportTickets.push(ticket);
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// Get a single support ticket
app.get('/api/support/tickets/:id', authMiddleware, (req, res) => {
  try {
    const ticket = db.supportTickets.find(t => 
      t.id === req.params.id && t.user_id === req.user.id
    );
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

// Update support ticket status (admin only)
app.put('/api/admin/support/tickets/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { status, response } = req.body;
    const ticket = db.supportTickets.find(t => t.id === req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (status) ticket.status = status;
    if (response) {
      ticket.response = response;
      ticket.responded_at = new Date().toISOString();
      ticket.responded_by = req.user.id;
    }
    ticket.updated_at = new Date().toISOString();
    
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Get all support tickets (admin only)
app.get('/api/admin/support/tickets', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const tickets = db.supportTickets;
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tickets' });
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
        is_admin: user.is_admin,
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
    baseUrl: 'https://primeheritage-bank-intl.onrender.com'
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
    console.log(`📍 URL: https://primeheritage-bank-intl.onrender.com`);
    console.log(`👑 Admin: devgift@gmail.com / Igwe`);
    console.log(`💰 Admin Balance: UNLIMITED`);
    console.log(`👥 Users: ${db.users.length}`);
    console.log(`📊 Accounts: ${db.accounts.length}`);
    console.log(`📧 Email Templates: INLINE (No external files needed)`);
    console.log(`📧 Email Provider: Netlify Function`);
    console.log(`🔐 BBC Security: 3-Step Hidden Verification Active`);
    console.log(`💡 New users start with $0 balance`);
    console.log('='.repeat(70) + '\n');
    
    // Send test email on startup
    setTimeout(() => {
      sendTestEmail().catch(err => {
        log.error('Startup test email failed:', err);
      });
    }, 3000);
  });
};

startServer();

module.exports = app;
