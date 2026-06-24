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
  process.env.SUPABASE_URL || 'https://locubftytnfyxacfberj.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_AsPMmqBAtex3C_zfofY8sw_GGJ_nxyk'
);

// ==================== EMAIL SETUP ====================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD || 'pzxw dqxj queu wcch'
  }
});

// Verify email connection
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready');
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

// ==================== WELCOME EMAIL TEMPLATE ====================
const generateWelcomeEmail = (userData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Prime Heritage Bank</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .greeting { font-size: 22px; color: #333; margin-bottom: 10px; }
        .message { color: #666; line-height: 1.6; margin-bottom: 20px; }
        .features { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .feature { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
        .feature .icon { font-size: 20px; }
        .feature .label { font-weight: bold; color: #333; }
        .feature .desc { color: #666; font-size: 12px; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏦 Prime Heritage International Bank</h1>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${userData.full_name}! 👋</div>
          <div class="message">
            Welcome to Prime Heritage International Bank! Your global banking journey begins now.
            We're thrilled to have you join our community of international banking.
          </div>
          <div class="features">
            <div class="feature">
              <div class="icon">🌍</div>
              <div class="label">Multi-Currency</div>
              <div class="desc">USD, EUR, GBP, NGN</div>
            </div>
            <div class="feature">
              <div class="icon">💳</div>
              <div class="label">Global Cards</div>
              <div class="desc">Visa & Mastercard</div>
            </div>
            <div class="feature">
              <div class="icon">🔒</div>
              <div class="label">BBC Security</div>
              <div class="desc">3-Step verification</div>
            </div>
            <div class="feature">
              <div class="icon">⚡</div>
              <div class="label">Instant Transfers</div>
              <div class="desc">SWIFT & SEPA ready</div>
            </div>
          </div>
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">🚀 Go to Dashboard</a>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Prime Heritage International Bank. All rights reserved.</p>
          <p>This email was sent to ${userData.email}</p>
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
      from: '"Prime Heritage International Bank" <primeheritageinternationalbank@gmail.com>',
      to: userData.email,
      subject: '🎉 Welcome to Prime Heritage International Bank!',
      html: htmlContent
    };
    await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent to:', userData.email);
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
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// ==================== AUTH ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Prime Heritage International Bank API is running!'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
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
      'GET /api/support'
    ]
  });
});

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration request received:', req.body.email);
    
    const { 
      full_name, first_name, last_name, email, phone, 
      password, transaction_pin, passport_number, nationality,
      country_of_residence, date_of_birth 
    } = req.body;

    // Validation
    if (!full_name || !first_name || !last_name || !email || !phone || !password || !transaction_pin) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
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

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    console.log('✅ User created:', user.id);

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

    // Send welcome email (don't wait for it)
    sendWelcomeEmail(user).catch(console.error);

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome email sent.',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        account_level: user.account_level,
        is_verified: user.is_verified
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login request for:', req.body.email);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET USER PROFILE
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
    res.status(500).json({ error: 'Failed to get user' });
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
    res.status(500).json({ error: 'Failed to get accounts' });
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
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Create transaction
app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const {
      type, amount, currency, from_account_number, to_account_number,
      to_account_iban, to_account_swift, to_country, to_bank_name,
      to_bank_address, purpose, transaction_pin
    } = req.body;

    // Validation
    if (!type || !amount || !currency || !from_account_number || !to_account_number || !to_country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify PIN
    const validPin = await bcrypt.compare(transaction_pin, req.user.transaction_pin);
    if (!validPin) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }

    // Get source account
    const { data: fromAccount, error: fromError } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_number', from_account_number)
      .eq('user_id', req.user.id)
      .single();

    if (fromError || !fromAccount) {
      return res.status(404).json({ error: 'Source account not found' });
    }

    if (fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
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
      requires_bbc_verification: bbcCodesForUser.length > 0
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

// Verify BBC code
app.post('/api/transactions/:reference/verify-bbc', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    const { bbc_code } = req.body;

    if (!bbc_code) {
      return res.status(400).json({ error: 'BBC code required' });
    }

    const { data: transaction, error: txError } = await supabase
      .from('international_transactions')
      .select('*')
      .eq('reference', reference)
      .eq('from_user_id', req.user.id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { data: bbc, error: bbcError } = await supabase
      .from('bbc_codes')
      .select('*')
      .eq('code', bbc_code)
      .eq('user_id', req.user.id)
      .eq('is_used', false)
      .single();

    if (bbcError || !bbc) {
      return res.status(400).json({ error: 'Invalid or expired BBC code' });
    }

    if (new Date(bbc.expires_at) < new Date()) {
      return res.status(400).json({ error: 'BBC code expired' });
    }

    await supabase
      .from('bbc_codes')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', bbc.id);

    const stepField = `bbc_step_${bbc.step}_used`;
    await supabase
      .from('international_transactions')
      .update({ [stepField]: true })
      .eq('reference', reference);

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
      message: `BBC code step ${bbc.step} verified`,
      step: bbc.step,
      all_completed: allStepsCompleted,
      transaction_status: allStepsCompleted ? 'completed' : 'pending_bbc'
    });
  } catch (error) {
    console.error('Verify BBC error:', error);
    res.status(500).json({ error: 'BBC verification failed' });
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
    res.status(500).json({ error: 'Failed to get cards' });
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
    res.status(500).json({ error: 'Failed to create card' });
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
      return res.status(404).json({ error: 'Card not found' });
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
      message: `Card ${updatedCard.is_active ? 'activated' : 'deactivated'}`,
      card: {
        ...updatedCard,
        card_number: '****' + updatedCard.last4,
        cvv: '***'
      }
    });
  } catch (error) {
    console.error('Toggle card error:', error);
    res.status(500).json({ error: 'Failed to toggle card' });
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
    res.status(500).json({ error: 'Failed to get loans' });
  }
});

// Apply for loan
app.post('/api/loans', authMiddleware, async (req, res) => {
  try {
    const { amount, currency, purpose, tenure_months, interest_rate } = req.body;

    if (!amount || !currency || !purpose || !tenure_months) {
      return res.status(400).json({ error: 'Missing required fields' });
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
      message: 'Loan application submitted',
      loan
    });
  } catch (error) {
    console.error('Apply loan error:', error);
    res.status(500).json({ error: 'Loan application failed' });
  }
});

// ==================== EXCHANGE RATE ROUTES ====================

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
    res.status(500).json({ error: 'Failed to get exchange rates' });
  }
});

// Get specific exchange rate
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
      return res.status(404).json({ error: 'Exchange rate not found' });
    }

    res.json({
      success: true,
      rate: rate.rate,
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      last_updated: rate.last_updated
    });
  } catch (error) {
    console.error('Get exchange rate error:', error);
    res.status(500).json({ error: 'Failed to get exchange rate' });
  }
});

// ==================== SUPPORT ROUTES ====================

// Create support ticket
app.post('/api/support', authMiddleware, async (req, res) => {
  try {
    const { subject, message, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message required' });
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
      message: 'Support ticket created',
      ticket
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to create support ticket' });
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
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
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
      'POST /api/transactions',
      'GET /api/cards',
      'POST /api/cards',
      'GET /api/loans',
      'POST /api/loans',
      'GET /api/exchange-rates',
      'GET /api/exchange-rate/:from/:to',
      'GET /api/support',
      'POST /api/support'
    ]
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Prime Heritage International Bank Server');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🗄️  Supabase: Connected ✅');
  console.log('📧 Email: primeheritageinternationalbank@gmail.com ✅');
  console.log('\n📋 Available Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/health`);
  console.log(`  GET  http://localhost:${PORT}/api/test`);
  console.log(`  POST http://localhost:${PORT}/api/auth/register`);
  console.log(`  POST http://localhost:${PORT}/api/auth/login`);
  console.log(`  GET  http://localhost:${PORT}/api/auth/me (requires token)`);
});

module.exports = app;
