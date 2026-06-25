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

// ==================== CREATE DEFAULT ADMIN ====================
const createDefaultAdmin = async () => {
  log.step('ADMIN', 'Creating default admin account...');
  
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
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD || 'pzxw dqxj queu wcch'
  }
});

// ==================== RECEIPT GENERATOR ====================
const generateReceiptHTML = (transaction, user) => {
  const typeIcons = {
    transfer: '💸',
    airtime: '📱',
    bill_payment: '📄',
    data_bundle: '🌐',
    withdrawal: '🏦',
    admin_transfer: '👑'
  };
  
  const typeNames = {
    transfer: 'Money Transfer',
    airtime: 'Airtime Purchase',
    bill_payment: 'Bill Payment',
    data_bundle: 'Data Bundle',
    withdrawal: 'Bank Withdrawal',
    admin_transfer: 'Admin Transfer'
  };
  
  const statusColors = {
    completed: '#10B981',
    pending: '#F59E0B',
    failed: '#EF4444'
  };
  
  const statusIcons = {
    completed: '✅',
    pending: '⏳',
    failed: '❌'
  };
  
  const transactionDate = new Date(transaction.created_at || transaction.completed_at || Date.now());
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transaction Receipt</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0A0E1A;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .receipt-container {
          max-width: 500px;
          width: 100%;
          background: #0F1622;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(198, 164, 63, 0.15);
          box-shadow: 0 25px 60px rgba(0,0,0,0.5);
        }
        .receipt-header {
          background: linear-gradient(135deg, #0A0E1A, #16213E);
          padding: 30px 30px 20px;
          text-align: center;
          border-bottom: 2px solid rgba(198, 164, 63, 0.2);
          position: relative;
        }
        .receipt-header::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #C6A43F, #D4B85A, #C6A43F);
          background-size: 200% 100%;
          animation: shimmer 2s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .receipt-header .logo {
          font-size: 48px;
          display: block;
          margin-bottom: 8px;
        }
        .receipt-header h1 {
          color: #FFFFFF;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .receipt-header h1 .gold {
          background: linear-gradient(135deg, #C6A43F, #D4B85A);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .receipt-header .subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .receipt-header .receipt-id {
          display: inline-block;
          margin-top: 12px;
          padding: 4px 16px;
          background: rgba(198, 164, 63, 0.12);
          border: 1px solid rgba(198, 164, 63, 0.2);
          border-radius: 50px;
          color: #C6A43F;
          font-size: 11px;
          font-weight: 600;
          font-family: monospace;
        }
        .receipt-body {
          padding: 28px 30px 30px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 50px;
          font-size: 13px;
          font-weight: 600;
          background: rgba(16, 185, 129, 0.12);
          color: #10B981;
          border: 1px solid rgba(16, 185, 129, 0.2);
          margin-bottom: 20px;
        }
        .transaction-type {
          text-align: center;
          padding: 16px 0;
          margin-bottom: 20px;
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .transaction-type .icon {
          font-size: 40px;
          display: block;
          margin-bottom: 6px;
        }
        .transaction-type .type-label {
          color: #C6A43F;
          font-weight: 700;
          font-size: 18px;
        }
        .transaction-type .type-sub {
          color: rgba(255,255,255,0.3);
          font-size: 12px;
        }
        .amount-section {
          text-align: center;
          padding: 20px 0;
          margin-bottom: 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .amount-section .amount {
          font-size: 36px;
          font-weight: 800;
          color: #FFFFFF;
        }
        .amount-section .amount .currency {
          color: #C6A43F;
        }
        .amount-section .amount-label {
          color: rgba(255,255,255,0.3);
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: rgba(255,255,255,0.4);
          font-size: 13px;
        }
        .detail-value {
          color: #FFFFFF;
          font-weight: 500;
          font-size: 13px;
          text-align: right;
        }
        .detail-value .gold-text {
          color: #C6A43F;
        }
        .detail-value.mono {
          font-family: monospace;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        .receipt-footer {
          padding: 20px 30px 30px;
          border-top: 1px solid rgba(255,255,255,0.05);
          text-align: center;
        }
        .receipt-footer .thank-you {
          color: #C6A43F;
          font-size: 16px;
          font-weight: 700;
        }
        .receipt-footer .tagline {
          color: rgba(255,255,255,0.2);
          font-size: 11px;
          margin-top: 4px;
        }
        .receipt-footer .qr-placeholder {
          margin: 12px auto 0;
          width: 60px;
          height: 60px;
          background: rgba(198, 164, 63, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(198, 164, 63, 0.2);
        }
        .receipt-footer .qr-placeholder i {
          font-size: 24px;
          color: #C6A43F;
          opacity: 0.4;
        }
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 120px;
          opacity: 0.02;
          pointer-events: none;
          font-weight: 900;
          color: #C6A43F;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="receipt-header">
          <span class="logo">🏦</span>
          <h1>Prime Heritage <span class="gold">Bank</span></h1>
          <div class="subtitle">International Banking</div>
          <div class="receipt-id">#${transaction.reference || 'N/A'}</div>
          <div class="watermark">RECEIPT</div>
        </div>
        
        <div class="receipt-body">
          <div class="status-badge">
            ${statusIcons[transaction.status] || '✅'} ${(transaction.status || 'completed').toUpperCase()}
          </div>
          
          <div class="transaction-type">
            <span class="icon">${typeIcons[transaction.type] || '💳'}</span>
            <div class="type-label">${typeNames[transaction.type] || 'Transaction'}</div>
            <div class="type-sub">${new Date(transactionDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date(transactionDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          
          <div class="amount-section">
            <div class="amount-label">Amount</div>
            <div class="amount"><span class="currency">${transaction.currency || 'USD'}</span> ${(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">From</span>
            <span class="detail-value mono">${transaction.from_account_number || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">To</span>
            <span class="detail-value mono">${transaction.to_account_number || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">${transaction.description || transaction.purpose || 'N/A'}</span>
          </div>
          ${transaction.sender_name ? `
          <div class="detail-row">
            <span class="detail-label">Sender</span>
            <span class="detail-value gold-text">${transaction.sender_name}</span>
          </div>` : ''}
          <div class="detail-row">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value mono gold-text">${transaction.id || 'N/A'}</span>
          </div>
          <div class="detail-row" style="border-bottom: none;">
            <span class="detail-label">Status</span>
            <span class="detail-value" style="color: ${statusColors[transaction.status] || '#10B981'};">${(transaction.status || 'completed').toUpperCase()}</span>
          </div>
        </div>
        
        <div class="receipt-footer">
          <div class="thank-you">Thank you for banking with us</div>
          <div class="tagline">Prime Heritage International Bank • Global Banking Excellence</div>
          <div class="qr-placeholder">
            <i class="fas fa-qrcode"></i>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ==================== SEND RECEIPT EMAIL ====================
const sendReceiptEmail = async (transaction, user) => {
  try {
    const html = generateReceiptHTML(transaction, user);
    const subject = `🧾 Receipt for ${transaction.type || 'Transaction'} - ${transaction.reference || 'N/A'}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: user.email,
      subject: subject,
      html: html,
      attachments: [{
        filename: `receipt-${transaction.reference || 'transaction'}.html`,
        content: html,
        contentType: 'text/html'
      }]
    });
    log.email('✅ Receipt email sent to:', user.email);
    return true;
  } catch (error) {
    log.error('Receipt email failed:', error);
    return false;
  }
};

// ==================== REST OF THE SERVER CODE ====================
// (All the previous routes - register, login, BBC transactions, admin routes, etc.)
// ... [Keep all the previous code here]

// ==================== GET RECEIPT ====================
app.get('/api/receipt/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Find transaction
    const transaction = db.transactions.find(t => 
      t.reference === reference && 
      (t.from_user_id === req.user.id || t.to_user_id === req.user.id)
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    const user = db.users.find(u => u.id === req.user.id);
    const html = generateReceiptHTML(transaction, user);
    
    res.json({
      success: true,
      html: html,
      transaction: transaction
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
    
    const user = db.users.find(u => u.id === transaction.from_user_id || u.id === transaction.to_user_id);
    const html = generateReceiptHTML(transaction, user);
    
    res.json({
      success: true,
      html: html,
      transaction: transaction,
      user: user ? { email: user.email, full_name: user.full_name } : null
    });
  } catch (error) {
    log.error('Admin get receipt error:', error);
    res.status(500).json({ error: 'Failed to get receipt' });
  }
});

// ==================== GENERATE RECEIPT FOR TRANSACTION ====================
const generateAndSendReceipt = async (transaction, userId) => {
  try {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      await sendReceiptEmail(transaction, user);
      // Store receipt in database
      db.receipts.push({
        id: uuidv4(),
        transaction_id: transaction.id,
        reference: transaction.reference,
        user_id: userId,
        generated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    log.error('Generate receipt error:', error);
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

// ==================== API: HEALTH ====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    users: db.users.length,
    accounts: db.accounts.length,
    transactions: db.transactions.length,
    receipts: db.receipts.length,
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

    sendWelcomeEmail(user);

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

// ==================== API: GET CARDS ====================
app.get('/api/cards', authMiddleware, async (req, res) => {
  try {
    const cards = db.cards.filter(c => c.user_id === req.user.id);
    const maskedCards = cards.map(card => ({
      ...card,
      card_number: '****' + card.last4,
      cvv: '***'
    }));
    res.json({ success: true, cards: maskedCards });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// ==================== API: CREATE CARD ====================
app.post('/api/cards', authMiddleware, async (req, res) => {
  try {
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
    res.status(201).json({
      success: true,
      message: 'Card created successfully',
      card: { ...card, card_number: '****' + card.last4, cvv: '***' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// ==================== API: GET LOANS ====================
app.get('/api/loans', authMiddleware, async (req, res) => {
  try {
    const loans = db.loans.filter(l => l.user_id === req.user.id);
    res.json({ success: true, loans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loans' });
  }
});

// ==================== API: APPLY LOAN ====================
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
    res.status(201).json({
      success: true,
      message: 'Loan application submitted',
      loan
    });
  } catch (error) {
    res.status(500).json({ error: 'Loan application failed' });
  }
});

// ==================== API: SUPPORT ====================
app.post('/api/support', authMiddleware, async (req, res) => {
  try {
    const { subject, message, priority } = req.body;
    if (!subject || !message) {
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
    res.status(201).json({
      success: true,
      message: 'Support ticket created',
      ticket
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

app.get('/api/support', authMiddleware, async (req, res) => {
  try {
    const tickets = db.supportTickets.filter(t => t.user_id === req.user.id);
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

// ==================== ============================================
// ==================== BBC SECURED TRANSACTIONS ====================
// ==================== ============================================

// ==================== UTILITY FUNCTION FOR COMPLETING TRANSACTIONS ====================
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
      
      // Generate and send receipt
      await generateAndSendReceipt(completedTx, req.user.id);
      
      return { success: true, newBalance: fromAccount.balance, transaction: completedTx };
    }
    return { success: false, error: 'Account error' };
  } catch (error) {
    log.error('Complete transaction error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== 1. SEND MONEY (WITH BBC) ====================
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

// ==================== 2. AIRTIME (WITH BBC) ====================
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

// ==================== 3. BILL PAYMENT (WITH BBC) ====================
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

// ==================== 4. DATA BUNDLE (WITH BBC) ====================
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

// ==================== 5. WITHDRAWAL (WITH BBC) ====================
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
        bbcCount: db.bbcCodes.filter(b => b.user_id === user.id).length,
        receiptCount: db.receipts.filter(r => r.user_id === user.id).length
      };
    });
    res.json(usersWithDetails);
  } catch (error) {
    log.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
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
    db.receipts = db.receipts.filter(r => r.user_id !== userId);
    db.users.splice(userIndex, 1);
    
    log.admin(`User deleted: ${user.email}`);
    res.json({ success: true, message: `User ${user.full_name} deleted` });
  } catch (error) {
    log.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/admin/toggle-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot modify your own status' });
    }
    user.is_active = !user.is_active;
    log.admin(`User ${user.email} status toggled to: ${user.is_active ? 'Active' : 'Frozen'}`);
    res.json({ success: true, message: `User ${user.is_active ? 'activated' : 'frozen'}` });
  } catch (error) {
    log.error('Admin toggle status error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

app.get('/api/admin/bbc/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bbcCodes = db.bbcCodes.filter(b => b.user_id === req.params.userId);
    res.json(bbcCodes);
  } catch (error) {
    log.error('Admin get BBC codes error:', error);
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
    
    log.admin(`Generated ${codes.length} BBC codes for user ${user.email}`);
    res.json({ success: true, message: `Generated ${codes.length} BBC codes`, codes });
  } catch (error) {
    log.error('Admin generate BBC error:', error);
    res.status(500).json({ error: 'Failed to generate BBC codes' });
  }
});

// ==================== ADMIN SEND MONEY ====================
app.post('/api/admin/send', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { toAccountNumber, amount, currency, senderName, note } = req.body;
    
    log.admin(`Admin sending money: ${amount} ${currency} to ${toAccountNumber} from ${senderName}`);
    
    const toAccount = db.accounts.find(a => a.account_number === toAccountNumber);
    if (!toAccount) {
      return res.status(404).json({ error: 'Recipient account not found' });
    }
    
    const recipient = db.users.find(u => u.id === toAccount.user_id);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }
    
    const adminAccount = db.accounts.find(a => 
      a.user_id === req.user.id && a.currency === currency
    );
    
    let fromAccount = adminAccount;
    if (!fromAccount) {
      const newAccount = {
        id: uuidv4(),
        user_id: req.user.id,
        currency: currency,
        account_number: generateAccountNumber(),
        iban: generateIBAN(),
        swift_code: 'IB' + currency + Math.floor(Math.random() * 10000),
        balance: 9999999999.99,
        is_primary: false,
        account_type: 'admin',
        is_active: true,
        created_at: new Date().toISOString()
      };
      db.accounts.push(newAccount);
      fromAccount = newAccount;
      log.admin(`Created new ${currency} account for admin`);
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
      from_account_number: fromAccount.account_number,
      to_account_number: toAccount.account_number,
      description: note || `Transfer from ${senderName || 'System Administrator'}`,
      sender_name: senderName || 'System Administrator',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    
    db.transactions.push(transaction);
    
    // Admin doesn't lose money - unlimited!
    toAccount.balance += amount;
    
    db.auditLogs.push({
      id: uuidv4(),
      admin_id: req.user.id,
      admin_email: req.user.email,
      action: 'admin_send',
      recipient_email: recipient.email,
      amount,
      currency,
      sender_name: senderName || 'System Administrator',
      reference,
      timestamp: new Date().toISOString()
    });
    
    // Generate receipt for admin transfer
    await generateAndSendReceipt(transaction, recipient.id);
    
    log.admin(`✅ Admin transfer completed: ${amount} ${currency} to ${recipient.email} (${senderName})`);
    
    res.json({
      success: true,
      message: `Sent ${amount} ${currency} to ${recipient.full_name} (${recipient.email}) from ${senderName || 'System Administrator'}`,
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
      totalWithdrawals: db.withdrawHistory.length,
      totalReceipts: db.receipts.length
    };
    res.json(stats);
  } catch (error) {
    log.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==================== TEST EMAIL ====================
const sendTestEmail = async () => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'primeheritageinternationalbank@gmail.com',
      to: 'devgift@gmail.com',
      subject: '🚀 Prime Heritage Bank - Server Started!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0A0E1A; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #0F1622; border-radius: 24px; padding: 30px; border: 1px solid rgba(198,164,63,0.15); }
            .header { background: linear-gradient(135deg, #0A0E1A, #16213E); padding: 30px; text-align: center; border-radius: 16px 16px 0 0; margin: -30px -30px 20px -30px; border-bottom: 3px solid #C6A43F; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .header .gold { color: #C6A43F; }
            .success { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34D399; padding: 15px; border-radius: 12px; border-left: 4px solid #10B981; margin: 15px 0; }
            .info { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #60A5FA; padding: 15px; border-radius: 12px; border-left: 4px solid #3B82F6; margin: 15px 0; }
            .admin-box { background: rgba(198,164,63,0.1); border: 1px solid rgba(198,164,63,0.2); color: #C6A43F; padding: 15px; border-radius: 12px; border-left: 4px solid #C6A43F; margin: 15px 0; }
            .footer { margin-top: 20px; text-align: center; color: rgba(255,255,255,0.3); font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏦 Prime Heritage <span class="gold">Bank</span></h1>
              <p style="color: rgba(255,255,255,0.5); margin: 5px 0 0;">INTERNATIONAL BANKING</p>
            </div>
            <h2 style="color: white;">✅ Server Started Successfully!</h2>
            <div class="success"><strong>✓ Email System is Working!</strong><br>Your server is running and emails are sending correctly.</div>
            <div class="info">
              <strong>📋 Server Details:</strong><br>
              • Time: ${new Date().toLocaleString()}<br>
              • Environment: ${process.env.NODE_ENV || 'production'}<br>
              • URL: https://prime-heritage-bank.onrender.com<br>
              • Receipt System: ✅ Active
            </div>
            <div class="admin-box">
              <strong>👑 Admin Access:</strong><br>
              Email: <code>devgift@gmail.com</code><br>
              Password: <code>Igwe</code><br>
              <strong>💰 Balance: UNLIMITED</strong>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Prime Heritage International Bank</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    log.email('✅ Test email sent to devgift@gmail.com');
  } catch (error) {
    log.error('Test email failed:', error);
  }
};

transporter.verify((error) => {
  if (error) {
    log.error('Email error:', error);
  } else {
    log.success('Email server ready');
    setTimeout(sendTestEmail, 2000);
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

createDefaultAdmin().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('🏦 Prime Heritage International Bank Server');
    console.log('='.repeat(70));
    console.log(`📍 URL: https://prime-heritage-bank.onrender.com`);
    console.log(`👑 Admin: devgift@gmail.com / Igwe`);
    console.log(`💰 Admin Balance: UNLIMITED`);
    console.log(`👥 Users: ${db.users.length}`);
    console.log(`📊 Accounts: ${db.accounts.length}`);
    console.log(`🧾 Receipt System: ✅ Active`);
    console.log(`🔐 BBC Security: 3-Step Hidden Verification Active`);
    console.log(`📧 Test email sent to devgift@gmail.com`);
    console.log(`💡 New users start with $0 balance`);
    console.log(`👑 Admin can send any amount (unlimited)`);
    console.log('='.repeat(70) + '\n');
  });
});

module.exports = app;
