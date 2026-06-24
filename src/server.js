const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// ==================== SUPABASE SETUP ====================
const supabase = createClient(
  'https://locubftytnfyxacfberj.supabase.co',
  'sb_publishable_AsPMmqBAtex3C_zfofY8sw_GGJ_nxyk'
);

// ==================== EMAIL SETUP ====================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'primeheritageinternationalbank@gmail.com',
    pass: 'pzxw dqxj queu wcch' // App Password
  }
});

// Verify email connection
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// ==================== MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// ==================== CONSTANTS ====================
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
const JWT_EXPIRE = '7d';
const BBC_EXPIRY_MINUTES = 15;

// ==================== UTILITY FUNCTIONS ====================
const generateAccountNumber = () => {
  return 'IB' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const generateIBAN = () => {
  const countryCode = ['GB', 'DE', 'FR', 'US', 'NG', 'KE', 'ZA', 'AE', 'CH', 'SG'][Math.floor(Math.random() * 10)];
  return countryCode + Math.floor(Math.random() * 10 ** 10).toString().padStart(10, '0') + 
         Math.floor(Math.random() * 10 ** 8).toString().padStart(8, '0');
};

const generateBBCode = (step) => {
  const prefix = ['ALPHA', 'BETA', 'GAMMA'][step - 1];
  return prefix + '-' + Math.random().toString(36).substring(2, 6).toUpperCase() + 
         '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
};

const generateCardNumber = () => {
  let num = '4';
  for (let i = 0; i < 15; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
};

const generateReference = () => {
  return 'TXN-' + Date.now().toString(36).toUpperCase() + '-' + 
         Math.random().toString(36).substring(2, 6).toUpperCase();
};

// ==================== DOPE WELCOME EMAIL TEMPLATE ====================
const generateWelcomeEmail = (userData) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to International Bank</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .email-container {
          max-width: 600px;
          width: 100%;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.6s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 30px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: shimmer 3s infinite;
        }
        
        @keyframes shimmer {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .logo {
          font-size: 32px;
          font-weight: 800;
          color: white;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
          position: relative;
          z-index: 1;
          letter-spacing: -0.5px;
        }
        
        .logo span {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }
        
        .welcome-badge {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          padding: 8px 20px;
          border-radius: 50px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          margin-top: 15px;
          letter-spacing: 1px;
          text-transform: uppercase;
          position: relative;
          z-index: 1;
        }
        
        .content {
          padding: 40px 30px 30px;
        }
        
        .greeting {
          font-size: 28px;
          font-weight: 800;
          color: #1a1a2e;
          margin-bottom: 8px;
        }
        
        .greeting span {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .sub-greeting {
          color: #6c757d;
          font-size: 16px;
          margin-bottom: 25px;
          font-weight: 300;
        }
        
        .welcome-message {
          color: #2d3436;
          line-height: 1.8;
          font-size: 15px;
          margin-bottom: 30px;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 25px 0 30px;
        }
        
        .feature-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 12px;
          border-left: 4px solid #667eea;
          transition: all 0.3s ease;
        }
        
        .feature-item:hover {
          transform: translateX(5px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.1);
        }
        
        .feature-item .icon {
          font-size: 20px;
          display: block;
          margin-bottom: 5px;
        }
        
        .feature-item .label {
          font-weight: 600;
          color: #1a1a2e;
          font-size: 13px;
        }
        
        .feature-item .desc {
          color: #6c757d;
          font-size: 12px;
          margin-top: 2px;
        }
        
        .account-info {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0 25px;
          border: 1px solid #dee2e6;
        }
        
        .account-info h4 {
          color: #1a1a2e;
          font-size: 14px;
          margin-bottom: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .account-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        
        .account-row:last-child {
          border-bottom: none;
        }
        
        .account-label {
          color: #6c757d;
          font-size: 13px;
        }
        
        .account-value {
          color: #1a1a2e;
          font-weight: 600;
          font-size: 13px;
        }
        
        .security-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          padding: 15px 20px;
          border-radius: 12px;
          margin: 20px 0 25px;
        }
        
        .security-box h4 {
          color: #856404;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .security-box p {
          color: #856404;
          font-size: 13px;
          margin: 0;
        }
        
        .btn-primary {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 35px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          text-align: center;
          width: 100%;
          border: none;
          cursor: pointer;
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
        }
        
        .footer {
          background: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          border-top: 1px solid #dee2e6;
        }
        
        .footer p {
          color: #6c757d;
          font-size: 13px;
          margin: 5px 0;
        }
        
        .footer .social-links {
          margin: 10px 0;
        }
        
        .footer .social-links a {
          color: #667eea;
          text-decoration: none;
          margin: 0 10px;
          font-weight: 600;
          font-size: 14px;
        }
        
        .footer .social-links a:hover {
          color: #764ba2;
        }
        
        @media (max-width: 480px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
          
          .greeting {
            font-size: 24px;
          }
          
          .content {
            padding: 30px 20px 20px;
          }
          
          .header {
            padding: 30px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="header">
          <div class="logo">
            <span>🏦 Prime Heritage International Bank</span>
          </div>
          <div class="welcome-badge">
            🎉 Welcome Aboard!
          </div>
        </div>
        
        <!-- Content -->
        <div class="content">
          <div class="greeting">
            Hello, <span>${userData.full_name}</span>! 👋
          </div>
          <div class="sub-greeting">
            Your global banking journey begins now
          </div>
          
          <div class="welcome-message">
            We're thrilled to have you join <strong>Prime Heritage International Bank</strong> — 
            your gateway to seamless cross-border banking. Your account has been 
            successfully created with premium features to support your international 
            financial needs.
          </div>
          
          <!-- Features Grid -->
          <div class="features-grid">
            <div class="feature-item">
              <span class="icon">🌍</span>
              <div class="label">Multi-Currency</div>
              <div class="desc">USD, EUR, GBP, NGN</div>
            </div>
            <div class="feature-item">
              <span class="icon">💳</span>
              <div class="label">Global Cards</div>
              <div class="desc">Visa & Mastercard</div>
            </div>
            <div class="feature-item">
              <span class="icon">🔒</span>
              <div class="label">BBC Security</div>
              <div class="desc">3-Step verification</div>
            </div>
            <div class="feature-item">
              <span class="icon">⚡</span>
              <div class="label">Instant Transfers</div>
              <div class="desc">SWIFT & SEPA ready</div>
            </div>
          </div>
          
          <!-- Account Information -->
          <div class="account-info">
            <h4>📋 Your Account Details</h4>
            <div class="account-row">
              <span class="account-label">Account Level</span>
              <span class="account-value">${userData.account_level.toUpperCase()}</span>
            </div>
            <div class="account-row">
              <span class="account-label">Status</span>
              <span class="account-value" style="color: #28a745;">${userData.is_verified ? '✅ Verified' : '⏳ Pending Verification'}</span>
            </div>
            <div class="account-row">
              <span class="account-label">Member Since</span>
              <span class="account-value">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          
          <!-- Security Notice -->
          <div class="security-box">
            <h4>🔐 Security Alert</h4>
            <p>Never share your transaction PIN or BBC codes with anyone. 
            Prime Heritage International Bank will never ask for your password or PIN via email or phone.</p>
          </div>
          
          <!-- Action Button -->
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn-primary">
            🚀 Go to Dashboard
          </a>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="social-links">
            <a href="#">Twitter</a>
            <a href="#">LinkedIn</a>
            <a href="#">Instagram</a>
            <a href="#">YouTube</a>
          </div>
          <p>📧 primeheritageinternationalbank@gmail.com</p>
          <p>🌐 www.primeheritagebank.com</p>
          <p style="font-size: 11px; color: #adb5bd; margin-top: 10px;">
            © ${new Date().getFullYear()} Prime Heritage International Bank. All rights reserved.
          </p>
          <p style="font-size: 11px; color: #adb5bd;">
            This email was sent to ${userData.email}. If you didn't create this account, 
            please contact us immediately.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ==================== SEND WELCOME EMAIL ====================
const sendWelcomeEmail = async (userData) => {
  try {
    const htmlContent = generateWelcomeEmail(userData);
    
    const mailOptions = {
      from: `"Prime Heritage International Bank" <primeheritageinternationalbank@gmail.com>`,
      to: userData.email,
      subject: '🎉 Welcome to Prime Heritage International Bank - Your Global Banking Journey Begins!',
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent to:', userData.email);
    console.log('📧 Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated', code: 'ACCOUNT_INACTIVE' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Authentication failed', code: 'AUTH_FAILED' });
  }
};

const adminMiddleware = async (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required', code: 'ADMIN_REQUIRED' });
  }
  next();
};

// ==================== VALIDATION HELPERS ====================
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^\+?[\d\s-]{10,}$/.test(phone);
const validatePassword = (password) => password.length >= 8;
const validateAmount = (amount) => amount > 0 && !isNaN(amount);

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { 
      full_name, first_name, last_name, email, phone, 
      password, transaction_pin, passport_number, nationality,
      country_of_residence, date_of_birth 
    } = req.body;

    // Validation
    if (!full_name || !first_name || !last_name || !email || !phone || !password || !transaction_pin) {
      return res.status(400).json({ error: 'All required fields must be filled', code: 'MISSING_FIELDS' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format', code: 'INVALID_EMAIL' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number', code: 'INVALID_PHONE' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' });
    }

    if (transaction_pin.length !== 4 || !/^\d{4}$/.test(transaction_pin)) {
      return res.status(400).json({ error: 'Transaction PIN must be 4 digits', code: 'INVALID_PIN' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered', code: 'EMAIL_EXISTS' });
    }

    // Check phone
    const { data: existingPhone } = await supabase
      .from('users')
      .select('phone')
      .eq('phone', phone)
      .single();

    if (existingPhone) {
      return res.status(400).json({ error: 'Phone number already registered', code: 'PHONE_EXISTS' });
    }

    // Hash password and PIN
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(transaction_pin, 10);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name,
        first_name,
        last_name,
        email,
        phone,
        password: hashedPassword,
        transaction_pin: hashedPin,
        passport_number,
        nationality,
        country_of_residence,
        date_of_birth,
        account_level: 'standard',
        is_active: true,
        is_verified: false,
        is_admin: false,
        login_count: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Create default accounts
    const currencies = ['USD', 'EUR', 'GBP', 'NGN'];
    for (const currency of currencies) {
      await supabase
        .from('accounts')
        .insert({
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
        });
    }

    // Send welcome email
    await sendWelcomeEmail(user);

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Welcome email sent!',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        account_level: user.account_level,
        is_verified: user.is_verified,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', code: 'REGISTRATION_FAILED' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required', code: 'MISSING_CREDENTIALS' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated', code: 'ACCOUNT_INACTIVE' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    // Update login info
    await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        login_count: user.login_count + 1
      })
      .eq('id', user.id);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

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
        country_of_residence: user.country_of_residence,
        nationality: user.nationality
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', code: 'LOGIN_FAILED' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, first_name, last_name, email, phone, passport_number, nationality, country_of_residence, date_of_birth, is_active, is_admin, is_verified, account_level, last_login, login_count, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user', code: 'GET_USER_FAILED' });
  }
});

// ==================== ACCOUNT ROUTES ====================

// Get all accounts
app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('currency');

    if (error) throw error;

    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts', code: 'GET_ACCOUNTS_FAILED' });
  }
});

// Get account by ID
app.get('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND' });
    }

    res.json({ success: true, account });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to get account', code: 'GET_ACCOUNT_FAILED' });
  }
});

// Create new account
app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { currency, account_type } = req.body;

    if (!currency || !account_type) {
      return res.status(400).json({ error: 'Currency and account type required', code: 'MISSING_FIELDS' });
    }

    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        user_id: req.user.id,
        currency,
        account_number: generateAccountNumber(),
        iban: generateIBAN(),
        swift_code: 'IB' + currency + Math.floor(Math.random() * 10000),
        balance: 0,
        is_primary: false,
        account_type,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account', code: 'CREATE_ACCOUNT_FAILED' });
  }
});

// ==================== TRANSACTION ROUTES ====================

// Get all transactions
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { data: transactions, error } = await supabase
      .from('international_transactions')
      .select('*')
      .or(`from_user_id.eq.${req.user.id},to_user_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions', code: 'GET_TRANSACTIONS_FAILED' });
  }
});

// Get transaction by reference
app.get('/api/transactions/:reference', authMiddleware, async (req, res) => {
  try {
    const { data: transaction, error } = await supabase
      .from('international_transactions')
      .select('*')
      .eq('reference', req.params.reference)
      .or(`from_user_id.eq.${req.user.id},to_user_id.eq.${req.user.id}`)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
    }

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to get transaction', code: 'GET_TRANSACTION_FAILED' });
  }
});

// Create transaction with BBC codes
app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const {
      type, amount, currency, from_account_number, to_account_number,
      to_account_iban, to_account_swift, to_country, to_bank_name,
      to_bank_address, purpose, transaction_pin
    } = req.body;

    // Validation
    if (!type || !amount || !currency || !from_account_number || !to_account_number || !to_country) {
      return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    if (!validateAmount(amount)) {
      return res.status(400).json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
    }

    if (!transaction_pin) {
      return res.status(400).json({ error: 'Transaction PIN required', code: 'PIN_REQUIRED' });
    }

    // Verify PIN
    const validPin = await bcrypt.compare(transaction_pin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN', code: 'INVALID_PIN' });
    }

    // Get source account
    const { data: fromAccount, error: fromError } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_number', from_account_number)
      .eq('user_id', req.user.id)
      .single();

    if (fromError || !fromAccount) {
      return res.status(404).json({ error: 'Source account not found', code: 'ACCOUNT_NOT_FOUND' });
    }

    if (fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
    }

    // Generate BBC codes for international transactions
    let bbcCodesForUser = [];
    if (type === 'swift' || type === 'wire' || type === 'international') {
      for (let step = 1; step <= 3; step++) {
        const code = generateBBCode(step);
        const { data: bbc, error: bbcError } = await supabase
          .from('bbc_codes')
          .insert({
            code,
            user_id: req.user.id,
            step,
            is_used: false,
            expires_at: new Date(Date.now() + BBC_EXPIRY_MINUTES * 60000).toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (bbcError) throw bbcError;
        bbcCodesForUser.push({
          step: bbc.step,
          code: bbc.code,
          expires_at: bbc.expires_at
        });
      }
    }

    // Create transaction
    const reference = generateReference();
    const { data: transaction, error } = await supabase
      .from('international_transactions')
      .insert({
        reference,
        type,
        amount,
        currency,
        from_user_id: req.user.id,
        from_account_number: fromAccount.account_number,
        from_account_iban: fromAccount.iban,
        from_account_swift: fromAccount.swift_code,
        from_country: req.user.country_of_residence || 'Unknown',
        to_account_number,
        to_account_iban: to_account_iban || 'N/A',
        to_account_swift: to_account_swift || 'N/A',
        to_country,
        to_bank_name: to_bank_name || 'Unknown Bank',
        to_bank_address: to_bank_address || 'N/A',
        purpose: purpose || 'International transfer',
        status: bbcCodesForUser.length > 0 ? 'pending_bbc' : 'processing',
        swift_code: to_account_swift || 'N/A',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Deduct balance
    await supabase
      .from('accounts')
      .update({ balance: fromAccount.balance - amount })
      .eq('id', fromAccount.id);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction,
      bbc_codes: bbcCodesForUser,
      requires_bbc_verification: bbcCodesForUser.length > 0,
      bbc_verification_steps: bbcCodesForUser.length
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Transaction failed', code: 'TRANSACTION_FAILED' });
  }
});

// Verify BBC code
app.post('/api/transactions/:reference/verify-bbc', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    const { bbc_code } = req.body;

    if (!bbc_code) {
      return res.status(400).json({ error: 'BBC code required', code: 'BBC_CODE_REQUIRED' });
    }

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from('international_transactions')
      .select('*')
      .eq('reference', reference)
      .eq('from_user_id', req.user.id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
    }

    // Get BBC code
    const { data: bbc, error: bbcError } = await supabase
      .from('bbc_codes')
      .select('*')
      .eq('code', bbc_code)
      .eq('user_id', req.user.id)
      .eq('is_used', false)
      .single();

    if (bbcError || !bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code', code: 'INVALID_BBC_CODE' });
    }

    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired', code: 'BBC_CODE_EXPIRED' });
    }

    // Mark BBC as used
    await supabase
      .from('bbc_codes')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', bbc.id);

    // Update transaction step
    const stepField = `bbc_step_${bbc.step}_used`;
    await supabase
      .from('international_transactions')
      .update({ [stepField]: true })
      .eq('reference', reference);

    // Check if all steps completed
    const { data: updatedTx } = await supabase
      .from('international_transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    const allStepsCompleted = updatedTx.bbc_step_1_used && 
                             updatedTx.bbc_step_2_used && 
                             updatedTx.bbc_step_3_used;

    if (allStepsCompleted) {
      await supabase
        .from('international_transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('reference', reference);
    }

    res.json({
      success: true,
      message: `BBC code step ${bbc.step} verified successfully`,
      step: bbc.step,
      all_completed: allStepsCompleted,
      transaction_status: allStepsCompleted ? 'completed' : 'pending_bbc',
      remaining_steps: allStepsCompleted ? 0 : 3 - bbc.step
    });
  } catch (error) {
    console.error('Verify BBC error:', error);
    res.status(500).json({ error: 'BBC verification failed', code: 'BBC_VERIFICATION_FAILED' });
  }
});

// ==================== CARD ROUTES ====================

// Get all cards
app.get('/api/cards', authMiddleware, async (req, res) => {
  try {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const maskedCards = cards.map(card => ({
      ...card,
      card_number: '****' + card.last4,
      cvv: '***'
    }));

    res.json({ success: true, cards: maskedCards });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards', code: 'GET_CARDS_FAILED' });
  }
});

// Create card
app.post('/api/cards', authMiddleware, async (req, res) => {
  try {
    const { type, network, currency, daily_limit, monthly_limit } = req.body;

    const cardNumber = generateCardNumber();
    const last4 = cardNumber.slice(-4);
    const expiryMonth = Math.floor(Math.random() * 12) + 1;
    const expiryYear = new Date().getFullYear() + 3;
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    const { data: card, error } = await supabase
      .from('cards')
      .insert({
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
      })
      .select()
      .single();

    if (error) throw error;

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
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card', code: 'CREATE_CARD_FAILED' });
  }
});

// Toggle card status
app.put('/api/cards/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: card, error: getError } = await supabase
      .from('cards')
      .select('is_active')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (getError || !card) {
      return res.status(404).json({ error: 'Card not found', code: 'CARD_NOT_FOUND' });
    }

    const { data: updatedCard, error } = await supabase
      .from('cards')
      .update({ is_active: !card.is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Card ${updatedCard.is_active ? 'activated' : 'deactivated'} successfully`,
      card: {
        ...updatedCard,
        card_number: '****' + updatedCard.last4,
        cvv: '***'
      }
    });
  } catch (error) {
    console.error('Toggle card error:', error);
    res.status(500).json({ error: 'Failed to toggle card', code: 'TOGGLE_CARD_FAILED' });
  }
});

// ==================== LOAN ROUTES ====================

// Get all loans
app.get('/api/loans', authMiddleware, async (req, res) => {
  try {
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, loans });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({ error: 'Failed to get loans', code: 'GET_LOANS_FAILED' });
  }
});

// Apply for loan
app.post('/api/loans', authMiddleware, async (req, res) => {
  try {
    const { amount, currency, purpose, tenure_months, interest_rate } = req.body;

    if (!amount || !currency || !purpose || !tenure_months) {
      return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    if (!validateAmount(amount)) {
      return res.status(400).json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
    }

    const rate = interest_rate || 12;
    const monthlyPayment = (amount * (rate / 100 / 12) * Math.pow(1 + rate / 100 / 12, tenure_months)) / 
                          (Math.pow(1 + rate / 100 / 12, tenure_months) - 1);
    const totalPayable = monthlyPayment * tenure_months;

    const { data: loan, error } = await supabase
      .from('loans')
      .insert({
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
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      loan
    });
  } catch (error) {
    console.error('Apply loan error:', error);
    res.status(500).json({ error: 'Loan application failed', code: 'LOAN_APPLICATION_FAILED' });
  }
});

// ==================== EXCHANGE RATE ROUTES ====================

// Get exchange rate
app.get('/api/exchange-rate/:from/:to', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.params;

    const { data: rate, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', from.toUpperCase())
      .eq('to_currency', to.toUpperCase())
      .single();

    if (error || !rate) {
      return res.status(404).json({ error: 'Exchange rate not found', code: 'RATE_NOT_FOUND' });
    }

    const lastUpdated = new Date(rate.last_updated);
    const now = new Date();
    const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);

    res.json({
      success: true,
      rate: rate.rate,
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      last_updated: rate.last_updated,
      is_stale: hoursDiff > 1
    });
  } catch (error) {
    console.error('Get exchange rate error:', error);
    res.status(500).json({ error: 'Failed to get exchange rate', code: 'GET_RATE_FAILED' });
  }
});

// Get all exchange rates
app.get('/api/exchange-rates', authMiddleware, async (req, res) => {
  try {
    const { data: rates, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('from_currency');

    if (error) throw error;

    res.json({ success: true, rates });
  } catch (error) {
    console.error('Get exchange rates error:', error);
    res.status(500).json({ error: 'Failed to get exchange rates', code: 'GET_RATES_FAILED' });
  }
});

// ==================== SUPPORT ROUTES ====================

// Create support ticket
app.post('/api/support', authMiddleware, async (req, res) => {
  try {
    const { subject, message, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message required', code: 'MISSING_FIELDS' });
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: req.user.id,
        name: req.user.full_name,
        email: req.user.email,
        subject,
        message,
        priority: priority || 'medium',
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to create support ticket', code: 'CREATE_TICKET_FAILED' });
  }
});

// Get user's support tickets
app.get('/api/support', authMiddleware, async (req, res) => {
  try {
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({ error: 'Failed to get support tickets', code: 'GET_TICKETS_FAILED' });
  }
});

// ==================== ADMIN ROUTES ====================

// Admin: Get all users
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, is_active, is_verified, account_level, created_at, last_login, login_count')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users', code: 'GET_USERS_FAILED' });
  }
});

// Admin: Update user status
app.put('/api/admin/users/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, is_verified, account_level } = req.body;

    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (is_verified !== undefined) updates.is_verified = is_verified;
    if (account_level) updates.account_level = account_level;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user', code: 'UPDATE_USER_FAILED' });
  }
});

// Admin: Get all transactions
app.get('/api/admin/transactions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: transactions, error } = await supabase
      .from('international_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions', code: 'GET_TRANSACTIONS_FAILED' });
  }
});

// Admin: Update transaction status
app.put('/api/admin/transactions/:reference/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    const { status } = req.body;

    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', code: 'INVALID_STATUS' });
    }

    const { data: transaction, error } = await supabase
      .from('international_transactions')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('reference', reference)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction', code: 'UPDATE_TRANSACTION_FAILED' });
  }
});

// Admin: Generate BBC codes manually
app.post('/api/admin/transactions/:reference/generate-bbc', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    const { step } = req.body;

    if (!step || step < 1 || step > 3) {
      return res.status(400).json({ error: 'Valid step (1-3) required', code: 'INVALID_STEP' });
    }

    const { data: transaction, error: txError } = await supabase
      .from('international_transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
    }

    const code = generateBBCode(step);
    const { data: bbc, error: bbcError } = await supabase
      .from('bbc_codes')
      .insert({
        code,
        user_id: transaction.from_user_id,
        step,
        is_used: false,
        expires_at: new Date(Date.now() + BBC_EXPIRY_MINUTES * 60000).toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (bbcError) throw bbcError;

    res.json({
      success: true,
      message: `BBC code for step ${step} generated successfully`,
      bbc_code: bbc.code,
      expires_at: bbc.expires_at,
      step: bbc.step
    });
  } catch (error) {
    console.error('Generate BBC error:', error);
    res.status(500).json({ error: 'Failed to generate BBC code', code: 'GENERATE_BBC_FAILED' });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    email: 'primeheritageinternationalbank@gmail.com',
    supabase: 'connected'
  });
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 Prime Heritage International Bank Server running on port', PORT);
  console.log('📡 Environment:', process.env.NODE_ENV || 'development');
  console.log('🗄️  Supabase: Connected ✅');
  console.log('📧 Email: primeheritageinternationalbank@gmail.com ✅');
  console.log('🔐 JWT Secret:', JWT_SECRET ? 'Configured ✅' : 'Missing ❌');
  console.log('📍 API URL: http://localhost:' + PORT);
});

module.exports = app;
