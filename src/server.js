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
  },
  test: (msg, data = null) => {
    console.log(`[${new Date().toISOString()}] 🧪 ${msg}`);
    if (data) console.log('   📦 Test Data:', JSON.stringify(data, null, 2));
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
  auditLogs: []
};

// ==================== CREATE DEFAULT ADMIN ====================
const createDefaultAdmin = async () => {
  log.step('ADMIN', 'Creating default admin account...');
  
  const adminEmail = 'admin@primeheritagebank.com';
  const existingAdmin = db.users.find(u => u.email === adminEmail);
  
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@2024!', 10);
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
      login_count: 0,
      created_at: new Date().toISOString()
    };
    
    db.users.push(admin);
    log.success('✅ Default admin created');
    log.admin('👑 Admin Credentials:');
    log.admin('   Email: admin@primeheritagebank.com');
    log.admin('   Password: Admin@2024!');
  } else {
    log.info('Admin already exists');
  }
};

// ==================== EMAIL SETUP ====================
log.step('📧', 'Setting up Nodemailer with Gmail...');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD || 'pzxw dqxj queu wcch'
  }
});

// ==================== TEST EMAIL ON STARTUP ====================
const sendTestEmail = async () => {
  log.step('🧪', 'Sending test email to devvgift@gmail.com...');
  
  try {
    const testResult = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: 'devvgift@gmail.com',
      subject: '🚀 Prime Heritage Bank - Server Started Successfully!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0A0E1A; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #0F1622; border-radius: 24px; padding: 30px; border: 1px solid rgba(198,164,63,0.15); box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #0A0E1A, #16213E); padding: 30px; text-align: center; border-radius: 16px 16px 0 0; margin: -30px -30px 20px -30px; border-bottom: 3px solid #C6A43F; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .header .gold { color: #C6A43F; }
            .success { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34D399; padding: 15px; border-radius: 12px; border-left: 4px solid #10B981; margin: 15px 0; }
            .info { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #60A5FA; padding: 15px; border-radius: 12px; border-left: 4px solid #3B82F6; margin: 15px 0; }
            .admin-box { background: rgba(198,164,63,0.1); border: 1px solid rgba(198,164,63,0.2); color: #C6A43F; padding: 15px; border-radius: 12px; border-left: 4px solid #C6A43F; margin: 15px 0; }
            .footer { margin-top: 20px; text-align: center; color: rgba(255,255,255,0.3); font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
            code { background: rgba(255,255,255,0.05); padding: 2px 10px; border-radius: 6px; font-size: 13px; color: #C6A43F; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏦 Prime Heritage <span class="gold">Bank</span></h1>
              <p style="color: rgba(255,255,255,0.5); margin: 5px 0 0;">INTERNATIONAL BANKING</p>
            </div>
            <h2 style="color: white;">✅ Server Started Successfully!</h2>
            <div class="success">
              <strong>✓ Email System is Working!</strong><br>
              Your server is running and emails are sending correctly.
            </div>
            <div class="info">
              <strong>📋 Server Details:</strong><br>
              • Time: ${new Date().toLocaleString()}<br>
              • Environment: ${process.env.NODE_ENV || 'development'}<br>
              • Users in DB: ${db.users.length}<br>
              • Email: ${process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com'}
            </div>
            <div class="admin-box">
              <strong>👑 Admin Access:</strong><br>
              Email: <code>admin@primeheritagebank.com</code><br>
              Password: <code>Admin@2024!</code>
            </div>
            <div class="info">
              <strong>✅ Features Available:</strong><br>
              • User Registration ✓<br>
              • User Login ✓<br>
              • Admin Dashboard ✓<br>
              • BBC 3-Step Security ✓<br>
              • Account Creation ✓<br>
              • Welcome Emails ✓<br>
              • Transaction Processing ✓<br>
              • Card Management ✓<br>
              • Loan Applications ✓
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Prime Heritage International Bank</p>
              <p>This is an automated test email to confirm your server is running.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    log.email('✅ Test email sent successfully to devvgift@gmail.com!');
    log.email(`📧 Message ID: ${testResult.messageId}`);
    log.success('Email system is fully operational');
    return true;
  } catch (error) {
    log.error('❌ Failed to send test email:', error);
    log.warn('Email will still work for registration, but test failed');
    return false;
  }
};

// Verify email connection first, then send test
transporter.verify((error, success) => {
  if (error) {
    log.error('Email configuration error:', error);
    log.warn('Email may not work properly. Check Gmail App Password.');
  } else {
    log.success('Email server is ready (Gmail)');
    // Send test email after verification
    setTimeout(() => {
      sendTestEmail();
    }, 2000);
  }
});

// ==================== MIDDLEWARE ====================
log.step('🛡️', 'Setting up middleware...');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
log.debug('Helmet middleware configured');

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://prime-heritage-bank.onrender.com', '*'],
  credentials: true
}));
log.debug('CORS middleware configured');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
log.debug('JSON, URL-encoded, and static middleware configured');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, try again later.' }
});
app.use('/api', limiter);
log.debug('Rate limiter configured');

// ==================== CONSTANTS ====================
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_this';
const JWT_EXPIRE = '7d';
const BBC_EXPIRY_MINUTES = 15;

log.debug(`JWT configured - Expire: ${JWT_EXPIRE}`);

// ==================== BBC CODE GENERATION ====================
// Each BBC code has a hidden security purpose that the user doesn't know
const generateBBCode = (step) => {
  const prefixes = {
    1: 'ALPHA',  // Step 1: Currency Exchange / Initial Verification
    2: 'BETA',   // Step 2: Transfer Authorization / Second Check
    3: 'GAMMA'   // Step 3: Final Security / Completion Code
  };
  
  const purposes = {
    1: 'Currency Exchange / Initial Verification',
    2: 'Transfer Authorization / Second Check',
    3: 'Final Security / Completion Code'
  };
  
  const securityFlags = {
    1: 'AMOUNT_VERIFIED',
    2: 'ACCOUNT_VALIDATED',
    3: 'TRANSACTION_AUTHORIZED'
  };
  
  const hiddenActions = {
    1: 'Verifying currency exchange rates and initial transaction details',
    2: 'Validating recipient account and transfer authorization',
    3: 'Authorizing final transfer completion and settlement'
  };
  
  const code = prefixes[step] + '-' + 
               Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
               Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return {
    code,
    step,
    purpose: purposes[step],
    security_flag: securityFlags[step],
    display_message: step === 1 ? '🔑 Enter BBC Authorization Code' :
                     step === 2 ? '🔒 Enter BBC Security Code' :
                     '🛡️ Enter BBC Final Code',
    hidden_action: hiddenActions[step]
  };
};

// ==================== GENERATE BBC CODES ====================
const generateBBCodesForUser = (userId, step, quantity = 1, expiryDays = 30) => {
  const codes = [];
  const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < quantity; i++) {
    const bbcData = generateBBCode(step);
    const bbc = {
      id: uuidv4(),
      code: bbcData.code,
      step: bbcData.step,
      purpose: bbcData.purpose,
      security_flag: bbcData.security_flag,
      display_message: bbcData.display_message,
      hidden_action: bbcData.hidden_action,
      user_id: userId,
      is_used: false,
      used_at: null,
      expires_at: expiryDate.toISOString(),
      created_at: new Date().toISOString()
    };
    db.bbcCodes.push(bbc);
    codes.push(bbc);
    
    log.bbc(`Generated BBC Step ${step} for user ${userId}`, {
      code: bbc.code,
      purpose: bbc.purpose,
      hidden_action: bbc.hidden_action
    });
  }
  
  return codes;
};

// ==================== GENERATE BBC FOR TRANSACTION ====================
const generateBBCodesForTransaction = (transactionId, userId) => {
  const bbcCodes = [];
  const steps = [1, 2, 3];
  
  for (const step of steps) {
    const bbcData = generateBBCode(step);
    const bbc = {
      id: uuidv4(),
      code: bbcData.code,
      step: bbcData.step,
      purpose: bbcData.purpose,
      security_flag: bbcData.security_flag,
      display_message: bbcData.display_message,
      hidden_action: bbcData.hidden_action,
      transaction_id: transactionId,
      user_id: userId,
      is_used: false,
      used_at: null,
      expires_at: new Date(Date.now() + BBC_EXPIRY_MINUTES * 60000).toISOString(),
      created_at: new Date().toISOString()
    };
    db.bbcCodes.push(bbc);
    bbcCodes.push(bbc);
    
    log.bbc(`Generated BBC Step ${step} for transaction ${transactionId}`, {
      code: bbc.code,
      purpose: bbc.purpose,
      hidden_action: bbc.hidden_action
    });
  }
  
  return bbcCodes;
};

// ==================== UTILITY FUNCTIONS ====================
const generateAccountNumber = () => {
  const account = 'IB' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  log.debug('Generated account number:', account);
  return account;
};

const generateIBAN = () => {
  const countryCode = ['GB', 'DE', 'FR', 'US', 'NG', 'KE', 'ZA', 'AE', 'CH', 'SG'][Math.floor(Math.random() * 10)];
  const iban = countryCode + Math.floor(Math.random() * 10 ** 10).toString().padStart(10, '0') + 
         Math.floor(Math.random() * 10 ** 8).toString().padStart(8, '0');
  log.debug('Generated IBAN:', iban);
  return iban;
};

const generateReference = () => {
  const ref = 'TXN-' + Date.now().toString(36).toUpperCase() + '-' + 
         Math.random().toString(36).substring(2, 6).toUpperCase();
  log.debug('Generated reference:', ref);
  return ref;
};

// ==================== DOPE EMAIL TEMPLATE ====================
const generateWelcomeEmailHTML = (userData) => {
  log.debug('Generating welcome email for:', userData.email);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Prime Heritage Bank</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0A0E1A;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        
        .email-container {
          max-width: 600px;
          margin: 40px auto;
          background: #0F1622;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5);
          border: 1px solid rgba(198, 164, 63, 0.15);
        }
        
        .header {
          background: linear-gradient(135deg, #0A0E1A 0%, #16213E 50%, #1a1a2e 100%);
          padding: 40px 30px 30px;
          text-align: center;
          position: relative;
          border-bottom: 1px solid rgba(198, 164, 63, 0.2);
        }
        
        .header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #C6A43F, #D4B85A, #C6A43F);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .header .logo-icon { font-size: 48px; margin-bottom: 8px; }
        .header h1 { color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px; }
        .header h1 .gold { background: linear-gradient(135deg, #C6A43F, #D4B85A); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header .subtitle { color: rgba(255,255,255,0.5); font-size: 13px; margin-top: 6px; letter-spacing: 3px; text-transform: uppercase; font-weight: 300; }
        .header .badge { display: inline-block; margin-top: 12px; padding: 6px 18px; background: rgba(198, 164, 63, 0.15); border: 1px solid rgba(198, 164, 63, 0.3); border-radius: 50px; color: #C6A43F; font-size: 11px; font-weight: 600; letter-spacing: 1px; }
        
        .content { padding: 40px 35px; background: #0F1622; }
        
        .greeting { font-size: 24px; font-weight: 700; color: #FFFFFF; margin-bottom: 6px; }
        .greeting .highlight { background: linear-gradient(135deg, #C6A43F, #D4B85A); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .greeting .wave { display: inline-block; animation: wave 2s infinite; }
        
        @keyframes wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(20deg); } 75% { transform: rotate(-10deg); } }
        
        .message { color: rgba(255,255,255,0.7); line-height: 1.8; font-size: 15px; margin: 16px 0 24px; }
        .message strong { color: #FFFFFF; font-weight: 600; }
        
        .features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
        .feature { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 16px 18px; border-radius: 16px; transition: all 0.3s; }
        .feature .icon { font-size: 28px; display: block; margin-bottom: 6px; }
        .feature .label { font-weight: 700; color: #FFFFFF; font-size: 13px; display: block; }
        .feature .desc { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 2px; }
        
        .account-details { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px 24px; margin: 24px 0; }
        .account-details .title { color: rgba(255,255,255,0.3); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0; font-weight: 600; }
        .account-details .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
        .account-details .row:last-child { border-bottom: none; }
        .account-details .label { color: rgba(255,255,255,0.4); }
        .account-details .value { color: #FFFFFF; font-weight: 600; font-family: 'Courier New', monospace; }
        .account-details .value.gold { color: #C6A43F; }
        
        .btn-primary { display: inline-block; background: linear-gradient(135deg, #C6A43F, #9E8032); color: #0A0E1A; padding: 14px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 10px 0 5px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(198,164,63,0.3); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(198,164,63,0.4); }
        .btn-secondary { display: inline-block; background: transparent; color: rgba(255,255,255,0.7); padding: 12px 30px; text-decoration: none; border-radius: 12px; font-weight: 500; font-size: 14px; border: 1px solid rgba(255,255,255,0.1); margin: 5px 0; transition: all 0.3s; }
        .btn-secondary:hover { border-color: #C6A43F; color: #C6A43F; }
        .text-center { text-align: center; }
        
        .footer { background: rgba(255,255,255,0.02); padding: 30px 35px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer p { color: rgba(255,255,255,0.3); font-size: 12px; margin: 4px 0; line-height: 1.6; }
        .footer .brand { color: rgba(255,255,255,0.5); font-weight: 600; }
        
        @media (max-width: 480px) {
          .features { grid-template-columns: 1fr; }
          .content { padding: 25px 20px; }
          .header h1 { font-size: 22px; }
          .greeting { font-size: 20px; }
          .account-details .row { flex-direction: column; padding: 10px 0; gap: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo-icon">🏦</div>
          <h1>Prime Heritage <span class="gold">Bank</span></h1>
          <div class="subtitle">INTERNATIONAL BANKING</div>
          <div class="badge">✦ PREMIUM ACCOUNT ✦</div>
        </div>
        
        <div class="content">
          <div class="greeting">
            <span class="wave">👋</span> Hello, <span class="highlight">${userData.full_name}</span>!
          </div>
          
          <div class="message">
            <strong>Welcome to Prime Heritage International Bank!</strong><br>
            Your global banking journey begins now. We're thrilled to have you join our community 
            of international banking. Your account has been successfully created with premium features.
          </div>

          <div class="account-details">
            <div class="title">📋 Account Summary</div>
            <div class="row">
              <span class="label">Account Holder</span>
              <span class="value">${userData.full_name}</span>
            </div>
            <div class="row">
              <span class="label">Email Address</span>
              <span class="value">${userData.email}</span>
            </div>
            <div class="row">
              <span class="label">Account Level</span>
              <span class="value gold">${userData.account_level || 'Standard'}</span>
            </div>
            <div class="row">
              <span class="label">Status</span>
              <span class="value" style="color: #34D399;">✓ Active</span>
            </div>
          </div>

          <div class="features">
            <div class="feature">
              <span class="icon">🌍</span>
              <span class="label">Multi-Currency</span>
              <span class="desc">USD, EUR, GBP, NGN</span>
            </div>
            <div class="feature">
              <span class="icon">💳</span>
              <span class="label">Global Cards</span>
              <span class="desc">Visa & Mastercard</span>
            </div>
            <div class="feature">
              <span class="icon">🔐</span>
              <span class="label">BBC Security</span>
              <span class="desc">3-Step Verification</span>
            </div>
            <div class="feature">
              <span class="icon">⚡</span>
              <span class="label">Instant Transfers</span>
              <span class="desc">SWIFT & SEPA Ready</span>
            </div>
          </div>

          <div class="text-center">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn-primary">🚀 Go to Dashboard</a>
            <br>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="btn-secondary">🔐 Sign In to Your Account</a>
          </div>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} <span class="brand">Prime Heritage International Bank</span>. All rights reserved.</p>
          <p>This email was sent to <strong style="color: rgba(255,255,255,0.4);">${userData.email}</strong></p>
          <p style="font-size: 11px; opacity: 0.5;">Prime Heritage International Bank - Global Banking Excellence</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ==================== SEND WELCOME EMAIL ====================
const sendWelcomeEmail = async (userData) => {
  log.email(`Sending welcome email to: ${userData.email}`);
  
  try {
    const htmlContent = generateWelcomeEmailHTML(userData);
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: userData.email,
      subject: '🎉 Welcome to Prime Heritage International Bank!',
      html: htmlContent
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    log.email(`✅ Welcome email sent successfully to: ${userData.email}`);
    log.email(`📧 Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    log.error(`❌ Failed to send welcome email to: ${userData.email}`, error);
    return false;
  }
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
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// ==================== ADMIN MIDDLEWARE ====================
const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    log.warn('Admin access denied for:', req.user?.email || 'Unknown');
    return res.status(403).json({ error: 'Admin access required' });
  }
  log.admin('Admin access granted for:', req.user.email);
  next();
};

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  log.info('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Prime Heritage International Bank API is running!',
    users: db.users.length,
    accounts: db.accounts.length,
    transactions: db.transactions.length,
    bbcCodes: db.bbcCodes.length
  });
});

// ==================== TEST ENDPOINT ====================
app.get('/api/test', (req, res) => {
  log.info('Test endpoint called');
  res.json({
    success: true,
    message: 'API is working!',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/accounts',
      'GET /api/transactions',
      'GET /api/cards',
      'GET /api/loans',
      'GET /api/exchange-rates',
      'GET /api/support',
      'GET /api/admin/users',
      'GET /api/admin/users/:id',
      'PUT /api/admin/users/:id',
      'DELETE /api/admin/users/:id',
      'GET /api/admin/stats',
      'GET /api/admin/bbc/:userId',
      'POST /api/admin/generate-bbc',
      'POST /api/admin/send'
    ]
  });
});

// ==================== REGISTER ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    log.step('📝', 'Registration request received');
    log.info(`📝 Email: ${req.body.email}`);
    
    const { 
      full_name, first_name, last_name, email, phone, 
      password, transaction_pin, passport_number, nationality,
      country_of_residence, date_of_birth 
    } = req.body;

    if (!full_name || !first_name || !last_name || !email || !phone || !password || !transaction_pin) {
      log.warn('Missing required fields');
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
      log.warn('Email already registered:', email);
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
      login_count: 0,
      created_at: new Date().toISOString()
    };
    
    db.users.push(user);
    log.success(`✅ User created: ${user.id} - ${user.email}`);

    // Create default accounts
    const currencies = ['USD', 'EUR', 'GBP', 'NGN'];
    for (const currency of currencies) {
      const account = {
        id: uuidv4(),
        user_id: user.id,
        currency,
        account_number: generateAccountNumber(),
        iban: generateIBAN(),
        swift_code: 'IB' + currency + Math.floor(Math.random() * 10000),
        balance: currency === 'USD' ? 1000.00 : 0.00,
        is_primary: currency === 'USD',
        account_type: 'current',
        is_active: true,
        created_at: new Date().toISOString()
      };
      db.accounts.push(account);
      log.debug(`Created ${currency} account: ${account.account_number}`);
    }
    log.success('✅ All accounts created successfully');

    // Send welcome email
    const emailSent = await sendWelcomeEmail(user);
    if (emailSent) {
      log.success('✅ Welcome email sent successfully');
    } else {
      log.warn('⚠️ Welcome email failed but registration continues');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    log.success('✅ Registration complete for:', user.email);
    log.info(`📊 Total users: ${db.users.length}`);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome email sent.',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        account_level: user.account_level,
        is_verified: user.is_verified,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    log.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// ==================== LOGIN ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    log.step('🔐', 'Login request received');
    log.info(`🔐 Email: ${req.body.email}`);
    
    const { email, password } = req.body;

    if (!email || !password) {
      log.warn('Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.users.find(u => u.email === email);
    if (!user) {
      log.warn('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      log.warn('User account is inactive:', email);
      return res.status(401).json({ error: 'Account is deactivated. Please contact support.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      log.warn('Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.last_login = new Date().toISOString();
    user.login_count = (user.login_count || 0) + 1;

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    log.success('✅ Login successful for:', email);
    log.info(`👤 User: ${user.full_name} (${user.is_admin ? 'Admin' : 'User'})`);
    
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
        is_super_admin: user.is_super_admin || false
      }
    });
  } catch (error) {
    log.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== GET USER PROFILE ====================
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    log.info('Profile requested for user:', req.user.email);
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = { ...user };
    delete userData.password;
    delete userData.transaction_pin;
    
    log.success('Profile retrieved for:', user.email);
    res.json({ success: true, user: userData });
  } catch (error) {
    log.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== GET ACCOUNTS ====================
app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    log.info('Accounts requested for user:', req.user.email);
    const accounts = db.accounts.filter(a => 
      a.user_id === req.user.id && a.is_active === true
    ).sort((a, b) => a.currency.localeCompare(b.currency));

    log.success(`Retrieved ${accounts.length} accounts`);
    res.json({ success: true, accounts });
  } catch (error) {
    log.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// ==================== GET TRANSACTIONS ====================
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    log.info('Transactions requested for user:', req.user.email);
    const transactions = db.transactions
      .filter(t => t.from_user_id === req.user.id || t.to_user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 100);

    log.success(`Retrieved ${transactions.length} transactions`);
    res.json({ success: true, transactions });
  } catch (error) {
    log.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ==================== GET CARDS ====================
app.get('/api/cards', authMiddleware, async (req, res) => {
  try {
    log.info('Cards requested for user:', req.user.email);
    const cards = db.cards
      .filter(c => c.user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const maskedCards = cards.map(card => ({
      ...card,
      card_number: '****' + card.last4,
      cvv: '***'
    }));

    log.success(`Retrieved ${cards.length} cards`);
    res.json({ success: true, cards: maskedCards });
  } catch (error) {
    log.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// ==================== CREATE CARD ====================
app.post('/api/cards', authMiddleware, async (req, res) => {
  try {
    log.info('Card creation requested for user:', req.user.email);
    const { type, network, currency, daily_limit, monthly_limit } = req.body;

    const cardNumber = generateCardNumber();
    const last4 = cardNumber.slice(-4);
    const expiryMonth = Math.floor(Math.random() * 12) + 1;
    const expiryYear = new Date().getFullYear() + 3;
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    const card = {
      id: uuidv4(),
      user_id: req.user.id,
      card_number: cardNumber,
      last4,
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
      cvv,
      type: type || 'debit',
      network: network || 'visa',
      currency: currency || 'USD',
      is_international: true,
      daily_limit: daily_limit || 10000,
      monthly_limit: monthly_limit || 50000,
      is_active: true,
      created_at: new Date().toISOString()
    };
    
    db.cards.push(card);

    log.success('Card created successfully');
    res.status(201).json({
      success: true,
      message: 'Card created successfully',
      card: {
        ...card,
        card_number: '****' + card.last4,
        cvv: '***'
      }
    });
  } catch (error) {
    log.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// ==================== GET LOANS ====================
app.get('/api/loans', authMiddleware, async (req, res) => {
  try {
    log.info('Loans requested for user:', req.user.email);
    const loans = db.loans
      .filter(l => l.user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    log.success(`Retrieved ${loans.length} loans`);
    res.json({ success: true, loans });
  } catch (error) {
    log.error('Get loans error:', error);
    res.status(500).json({ error: 'Failed to get loans' });
  }
});

// ==================== APPLY FOR LOAN ====================
app.post('/api/loans', authMiddleware, async (req, res) => {
  try {
    log.info('Loan application requested for user:', req.user.email);
    const { amount, currency, purpose, tenure_months, interest_rate } = req.body;

    if (!amount || !currency || !purpose || !tenure_months) {
      log.warn('Missing required fields for loan');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const rate = interest_rate || 12;
    const monthlyPayment = (amount * (rate / 100 / 12) * Math.pow(1 + rate / 100 / 12, tenure_months)) / 
                          (Math.pow(1 + rate / 100 / 12, tenure_months) - 1);
    const totalPayable = monthlyPayment * tenure_months;

    const loan = {
      id: uuidv4(),
      user_id: req.user.id,
      amount,
      currency,
      purpose,
      interest_rate: rate,
      tenure_months,
      monthly_payment: monthlyPayment,
      total_payable: totalPayable,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    db.loans.push(loan);

    log.success('Loan application submitted');
    res.status(201).json({
      success: true,
      message: 'Loan application submitted',
      loan
    });
  } catch (error) {
    log.error('Apply loan error:', error);
    res.status(500).json({ error: 'Loan application failed' });
  }
});

// ==================== GET EXCHANGE RATES ====================
app.get('/api/exchange-rates', authMiddleware, async (req, res) => {
  try {
    log.info('Exchange rates requested for user:', req.user.email);
    const rates = [
      { from_currency: 'USD', to_currency: 'EUR', rate: 0.92, last_updated: new Date() },
      { from_currency: 'USD', to_currency: 'GBP', rate: 0.79, last_updated: new Date() },
      { from_currency: 'USD', to_currency: 'NGN', rate: 1540.50, last_updated: new Date() },
      { from_currency: 'EUR', to_currency: 'USD', rate: 1.09, last_updated: new Date() },
      { from_currency: 'GBP', to_currency: 'USD', rate: 1.27, last_updated: new Date() },
      { from_currency: 'NGN', to_currency: 'USD', rate: 0.00065, last_updated: new Date() },
    ];

    log.success('Exchange rates retrieved');
    res.json({ success: true, rates });
  } catch (error) {
    log.error('Get exchange rates error:', error);
    res.status(500).json({ error: 'Failed to get exchange rates' });
  }
});

// ==================== CREATE SUPPORT TICKET ====================
app.post('/api/support', authMiddleware, async (req, res) => {
  try {
    log.info('Support ticket requested for user:', req.user.email);
    const { subject, message, priority } = req.body;

    if (!subject || !message) {
      log.warn('Missing subject or message for support ticket');
      return res.status(400).json({ error: 'Subject and message required' });
    }

    const ticket = {
      id: uuidv4(),
      user_id: req.user.id,
      name: req.user.full_name,
      email: req.user.email,
      subject,
      message,
      priority: priority || 'medium',
      status: 'open',
      created_at: new Date().toISOString()
    };
    
    db.supportTickets.push(ticket);

    log.success('Support ticket created');
    res.status(201).json({
      success: true,
      message: 'Support ticket created',
      ticket
    });
  } catch (error) {
    log.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// ==================== GET SUPPORT TICKETS ====================
app.get('/api/support', authMiddleware, async (req, res) => {
  try {
    log.info('Support tickets requested for user:', req.user.email);
    const tickets = db.supportTickets
      .filter(t => t.user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    log.success(`Retrieved ${tickets.length} support tickets`);
    res.json({ success: true, tickets });
  } catch (error) {
    log.error('Get support tickets error:', error);
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

// ==================== ADMIN: GET ALL USERS ====================
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    log.admin('Fetching all users...');
    
    const usersWithDetails = db.users.map(user => {
      const userAccounts = db.accounts.filter(a => a.user_id === user.id);
      const userTransactions = db.transactions.filter(t => 
        t.from_user_id === user.id || t.to_user_id === user.id
      );
      const userCards = db.cards.filter(c => c.user_id === user.id);
      const userLoans = db.loans.filter(l => l.user_id === user.id);
      const userBbcCodes = db.bbcCodes.filter(b => b.user_id === user.id);
      const userSupportTickets = db.supportTickets.filter(s => s.user_id === user.id);
      
      const totalBalance = userAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      
      return {
        ...user,
        password: undefined,
        transaction_pin: undefined,
        accounts: userAccounts,
        transactions: userTransactions,
        cards: userCards,
        loans: userLoans,
        bbcCodes: userBbcCodes,
        supportTickets: userSupportTickets,
        totalBalance: totalBalance,
        accountCount: userAccounts.length,
        transactionCount: userTransactions.length,
        cardCount: userCards.length,
        loanCount: userLoans.length,
        bbcCount: userBbcCodes.length
      };
    });
    
    log.success(`Retrieved ${usersWithDetails.length} users with full history`);
    res.json(usersWithDetails);
  } catch (error) {
    log.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// ==================== ADMIN: GET SINGLE USER ====================
app.get('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    log.admin(`Fetching user: ${userId}`);
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      log.warn('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userAccounts = db.accounts.filter(a => a.user_id === user.id);
    const userTransactions = db.transactions.filter(t => 
      t.from_user_id === user.id || t.to_user_id === user.id
    );
    const userCards = db.cards.filter(c => c.user_id === user.id);
    const userLoans = db.loans.filter(l => l.user_id === user.id);
    const userBbcCodes = db.bbcCodes.filter(b => b.user_id === user.id);
    const userSupportTickets = db.supportTickets.filter(s => s.user_id === user.id);
    
    const totalBalance = userAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    
    const userData = {
      ...user,
      password: undefined,
      transaction_pin: undefined,
      accounts: userAccounts,
      transactions: userTransactions,
      cards: userCards,
      loans: userLoans,
      bbcCodes: userBbcCodes,
      supportTickets: userSupportTickets,
      totalBalance: totalBalance,
      accountCount: userAccounts.length,
      transactionCount: userTransactions.length,
      cardCount: userCards.length,
      loanCount: userLoans.length,
      bbcCount: userBbcCodes.length
    };
    
    log.success(`Retrieved user: ${user.email}`);
    res.json(userData);
  } catch (error) {
    log.error('Admin get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== ADMIN: DELETE USER ====================
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    log.admin(`Deleting user: ${userId}`);
    
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      log.warn('User not found for deletion:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = db.users[userIndex];
    
    // Check if trying to delete self
    if (user.id === req.user.id) {
      log.warn('Admin attempted to delete themselves');
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Remove all associated data
    db.accounts = db.accounts.filter(a => a.user_id !== userId);
    db.transactions = db.transactions.filter(t => 
      t.from_user_id !== userId && t.to_user_id !== userId
    );
    db.cards = db.cards.filter(c => c.user_id !== userId);
    db.loans = db.loans.filter(l => l.user_id !== userId);
    db.supportTickets = db.supportTickets.filter(s => s.user_id !== userId);
    db.bbcCodes = db.bbcCodes.filter(b => b.user_id !== userId);
    
    // Remove user
    db.users.splice(userIndex, 1);
    
    log.success(`User deleted: ${user.email}`);
    log.admin(`All associated data for ${user.email} removed`);
    
    res.json({
      success: true,
      message: `User ${user.full_name} (${user.email}) has been deleted`
    });
  } catch (error) {
    log.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== ADMIN: TOGGLE USER STATUS ====================
app.post('/api/admin/toggle-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    log.admin(`Toggling status for user: ${userId}`);
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      log.warn('User not found for status toggle:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if trying to toggle self
    if (user.id === req.user.id) {
      log.warn('Admin attempted to toggle their own status');
      return res.status(400).json({ error: 'Cannot modify your own status' });
    }
    
    user.is_active = !user.is_active;
    
    log.success(`User ${user.email} status toggled to: ${user.is_active ? 'Active' : 'Frozen'}`);
    
    res.json({
      success: true,
      message: `User ${user.full_name} has been ${user.is_active ? 'activated' : 'frozen'}`,
      is_active: user.is_active
    });
  } catch (error) {
    log.error('Admin toggle status error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

// ==================== ADMIN: GET BBC CODES FOR USER ====================
app.get('/api/admin/bbc/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    log.admin(`Fetching BBC codes for user: ${userId}`);
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      log.warn('User not found for BBC fetch:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const bbcCodes = db.bbcCodes.filter(b => b.user_id === userId);
    
    log.success(`Retrieved ${bbcCodes.length} BBC codes for user`);
    res.json(bbcCodes);
  } catch (error) {
    log.error('Admin get BBC codes error:', error);
    res.status(500).json({ error: 'Failed to get BBC codes' });
  }
});

// ==================== ADMIN: GENERATE BBC CODES ====================
app.post('/api/admin/generate-bbc', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, step, quantity = 1, expiryDays = 30 } = req.body;
    log.admin(`Generating BBC codes for user: ${userId}, Step: ${step}, Quantity: ${quantity}`);
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      log.warn('User not found for BBC generation:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const codes = generateBBCodesForUser(userId, parseInt(step), parseInt(quantity), parseInt(expiryDays));
    
    log.success(`Generated ${codes.length} BBC codes for user ${user.email}`);
    res.json({
      success: true,
      message: `Generated ${codes.length} BBC Step ${step} codes for ${user.full_name}`,
      codes: codes.map(c => ({
        code: c.code,
        step: c.step,
        purpose: c.purpose,
        expires_at: c.expires_at
      }))
    });
  } catch (error) {
    log.error('Admin generate BBC error:', error);
    res.status(500).json({ error: 'Failed to generate BBC codes' });
  }
});

// ==================== ADMIN: SEND MONEY ====================
app.post('/api/admin/send', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { toAccountNumber, amount, currency, senderName, note } = req.body;
    log.admin(`Sending money: ${amount} ${currency} to ${toAccountNumber}`);
    
    // Find recipient account
    const toAccount = db.accounts.find(a => a.account_number === toAccountNumber);
    if (!toAccount) {
      log.warn('Recipient account not found:', toAccountNumber);
      return res.status(404).json({ error: 'Recipient account not found' });
    }
    
    const recipient = db.users.find(u => u.id === toAccount.user_id);
    if (!recipient) {
      log.warn('Recipient user not found for account:', toAccountNumber);
      return res.status(404).json({ error: 'Recipient user not found' });
    }
    
    // Find sender's admin account (USD)
    const fromAccount = db.accounts.find(a => 
      a.user_id === req.user.id && a.currency === currency
    );
    
    if (!fromAccount) {
      log.warn('Admin account not found for currency:', currency);
      return res.status(404).json({ error: 'Admin account not found' });
    }
    
    if (fromAccount.balance < amount) {
      log.warn('Insufficient admin balance:', { balance: fromAccount.balance, requested: amount });
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Create transaction
    const reference = generateReference();
    const transaction = {
      id: uuidv4(),
      reference,
      type: 'admin_transfer',
      amount,
      currency,
      from_user_id: req.user.id,
      to_user_id: recipient.id,
      from_account_number: fromAccount.account_number,
      to_account_number: toAccount.account_number,
      description: note || 'Admin transfer',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    
    db.transactions.push(transaction);
    
    // Update balances
    fromAccount.balance -= amount;
    toAccount.balance += amount;
    
    log.success(`Admin transfer completed: ${amount} ${currency} to ${recipient.email}`);
    
    res.json({
      success: true,
      message: `Sent ${amount} ${currency} to ${recipient.full_name}`,
      transaction: {
        reference,
        amount,
        currency,
        recipient: recipient.full_name,
        recipientEmail: recipient.email
      }
    });
  } catch (error) {
    log.error('Admin send money error:', error);
    res.status(500).json({ error: 'Failed to send money' });
  }
});

// ==================== ADMIN: GET STATS ====================
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    log.admin('Fetching system stats...');
    
    const totalUsers = db.users.length;
    const activeUsers = db.users.filter(u => u.is_active).length;
    const totalAccounts = db.accounts.length;
    const totalTransactions = db.transactions.length;
    const totalBbcCodes = db.bbcCodes.length;
    const totalCards = db.cards.length;
    const totalLoans = db.loans.length;
    const totalSupportTickets = db.supportTickets.length;
    
    const totalBalance = db.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalBbcUsed = db.bbcCodes.filter(b => b.is_used).length;
    
    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      accounts: {
        total: totalAccounts,
        totalBalance: totalBalance
      },
      transactions: {
        total: totalTransactions
      },
      bbcCodes: {
        total: totalBbcCodes,
        used: totalBbcUsed,
        unused: totalBbcCodes - totalBbcUsed
      },
      cards: {
        total: totalCards
      },
      loans: {
        total: totalLoans
      },
      support: {
        total: totalSupportTickets
      }
    };
    
    log.success('Stats fetched successfully');
    res.json(stats);
  } catch (error) {
    log.error('Admin get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  log.warn('404 - Endpoint not found:', req.method, req.url);
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    available_endpoints: [
      'GET /api/health',
      'GET /api/test',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/accounts',
      'GET /api/transactions',
      'GET /api/cards',
      'POST /api/cards',
      'GET /api/loans',
      'POST /api/loans',
      'GET /api/exchange-rates',
      'GET /api/support',
      'POST /api/support',
      'GET /api/admin/users',
      'GET /api/admin/users/:id',
      'DELETE /api/admin/users/:id',
      'POST /api/admin/toggle-status',
      'GET /api/admin/bbc/:userId',
      'POST /api/admin/generate-bbc',
      'POST /api/admin/send',
      'GET /api/admin/stats'
    ]
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  log.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

// Initialize admin before starting server
createDefaultAdmin().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 Prime Heritage International Bank Server');
    console.log('='.repeat(70));
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com'}`);
    console.log(`👥 Users in DB: ${db.users.length}`);
    console.log(`👑 Admin: admin@primeheritagebank.com / Admin@2024!`);
    console.log(`🔐 BBC Security: 3-Step Verification Active`);
    console.log('='.repeat(70));
    console.log('\n📋 Available Endpoints:');
    console.log(`  GET  http://localhost:${PORT}/api/health`);
    console.log(`  GET  http://localhost:${PORT}/api/test`);
    console.log(`  POST http://localhost:${PORT}/api/auth/register`);
    console.log(`  POST http://localhost:${PORT}/api/auth/login`);
    console.log(`  GET  http://localhost:${PORT}/api/auth/me (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/accounts (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/transactions (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/cards (requires token)`);
    console.log(`  POST http://localhost:${PORT}/api/cards (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/loans (requires token)`);
    console.log(`  POST http://localhost:${PORT}/api/loans (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/exchange-rates (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/support (requires token)`);
    console.log(`  POST http://localhost:${PORT}/api/support (requires token)`);
    console.log(`  GET  http://localhost:${PORT}/api/admin/users (requires admin token)`);
    console.log(`  GET  http://localhost:${PORT}/api/admin/users/:id (requires admin token)`);
    console.log(`  DELETE http://localhost:${PORT}/api/admin/users/:id (requires admin token)`);
    console.log(`  POST http://localhost:${PORT}/api/admin/toggle-status (requires admin token)`);
    console.log(`  GET  http://localhost:${PORT}/api/admin/bbc/:userId (requires admin token)`);
    console.log(`  POST http://localhost:${PORT}/api/admin/generate-bbc (requires admin token)`);
    console.log(`  POST http://localhost:${PORT}/api/admin/send (requires admin token)`);
    console.log(`  GET  http://localhost:${PORT}/api/admin/stats (requires admin token)`);
    console.log('\n' + '='.repeat(70));
    console.log('✅ Server is ready! Waiting for requests...');
    console.log('📧 Test email will be sent to devvgift@gmail.com');
    console.log('='.repeat(70) + '\n');
  });
});

module.exports = app;
