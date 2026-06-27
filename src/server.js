const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mongoose = require('mongoose');
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

// ==================== MONGODB CONNECTION ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ggiftfxx_db_user:IAIIqkjGqUTaAZeo@cluster0.eud99al.mongodb.net/primeheritage?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
.then(() => log.success('✅ MongoDB connected successfully!'))
.catch(err => {
  log.error('❌ MongoDB connection error:', err);
  log.warn('⚠️ Continuing without MongoDB... Data will not persist!');
});

// ==================== IN-MEMORY DATABASE (Fallback) ====================
const memoryDB = {
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

// ==================== MONGODB SCHEMAS ====================

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  full_name: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  transaction_pin: { type: String, required: true },
  passport_number: { type: String, default: 'N/A' },
  nationality: { type: String, default: 'N/A' },
  country_of_residence: { type: String, default: 'N/A' },
  date_of_birth: { type: String, default: 'N/A' },
  account_level: { type: String, default: 'standard' },
  is_active: { type: Boolean, default: true },
  is_verified: { type: Boolean, default: false },
  is_admin: { type: Boolean, default: false },
  is_super_admin: { type: Boolean, default: false },
  is_unlimited: { type: Boolean, default: false },
  login_count: { type: Number, default: 0 },
  last_login: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

const accountSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true },
  currency: { type: String, required: true },
  account_number: { type: String, unique: true, required: true },
  iban: { type: String, unique: true, required: true },
  swift_code: { type: String },
  balance: { type: Number, default: 0 },
  is_primary: { type: Boolean, default: false },
  account_type: { type: String, default: 'current' },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  reference: { type: String, unique: true, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  from_user_id: { type: String },
  to_user_id: { type: String },
  from_account_number: { type: String },
  to_account_number: { type: String },
  description: { type: String },
  sender_name: { type: String },
  status: { type: String, default: 'pending' },
  step: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date }
});

const pendingTransactionSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  reference: { type: String, unique: true, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  from_user_id: { type: String },
  to_user_id: { type: String },
  from_account_number: { type: String },
  to_account_number: { type: String },
  description: { type: String },
  sender_name: { type: String },
  status: { type: String, default: 'pending_bbc' },
  step: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now }
});

const bbcCodeSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  code: { type: String, unique: true, required: true },
  step: { type: Number, required: true },
  display_message: { type: String, required: true },
  hidden_purpose: { type: String },
  security_flag: { type: String },
  type: { type: String, default: 'transaction' },
  transaction_id: { type: String },
  user_id: { type: String, required: true },
  is_used: { type: Boolean, default: false },
  used_at: { type: Date },
  expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now }
});

const cardSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true },
  card_number: { type: String, unique: true },
  last4: { type: String },
  expiry_month: { type: String },
  expiry_year: { type: String },
  card_type: { type: String, default: 'Visa' },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const loanSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  purpose: { type: String, default: 'Personal' },
  tenure_months: { type: Number, default: 36 },
  interest_rate: { type: Number, default: 12 },
  monthly_payment: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const supportTicketSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  user_id: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, default: 'General' },
  status: { type: String, default: 'open' },
  response: { type: String },
  responded_at: { type: Date },
  responded_by: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Account = mongoose.model('Account', accountSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const PendingTransaction = mongoose.model('PendingTransaction', pendingTransactionSchema);
const BBCCode = mongoose.model('BBCCode', bbcCodeSchema);
const Card = mongoose.model('Card', cardSchema);
const Loan = mongoose.model('Loan', loanSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

// ==================== DATABASE HELPERS ====================
const db = {
  users: {
    find: async (filter) => {
      try { return await User.find(filter || {}); } catch(e) { return memoryDB.users.filter(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    findOne: async (filter) => {
      try { return await User.findOne(filter); } catch(e) { return memoryDB.users.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await User.create(data); } catch(e) { memoryDB.users.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await User.updateOne(filter, update); } catch(e) {
        const user = memoryDB.users.find(u => {
          for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
        });
        if (user) { Object.assign(user, update); }
      }
    },
    delete: async (filter) => {
      try { return await User.deleteOne(filter); } catch(e) {
        const idx = memoryDB.users.findIndex(u => {
          for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.users.splice(idx, 1);
      }
    }
  },
  accounts: {
    find: async (filter) => {
      try { return await Account.find(filter || {}); } catch(e) { return memoryDB.accounts; }
    },
    findOne: async (filter) => {
      try { return await Account.findOne(filter); } catch(e) { return memoryDB.accounts.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await Account.create(data); } catch(e) { memoryDB.accounts.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await Account.updateOne(filter, update); } catch(e) {
        const acc = memoryDB.accounts.find(a => {
          for (const key in filter) { if (a[key] !== filter[key]) return false; } return true;
        });
        if (acc) { Object.assign(acc, update); }
      }
    },
    delete: async (filter) => {
      try { return await Account.deleteOne(filter); } catch(e) {
        const idx = memoryDB.accounts.findIndex(a => {
          for (const key in filter) { if (a[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.accounts.splice(idx, 1);
      }
    }
  },
  transactions: {
    find: async (filter) => {
      try { return await Transaction.find(filter || {}); } catch(e) { return memoryDB.transactions; }
    },
    findOne: async (filter) => {
      try { return await Transaction.findOne(filter); } catch(e) { return memoryDB.transactions.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await Transaction.create(data); } catch(e) { memoryDB.transactions.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await Transaction.updateOne(filter, update); } catch(e) {
        const tx = memoryDB.transactions.find(t => {
          for (const key in filter) { if (t[key] !== filter[key]) return false; } return true;
        });
        if (tx) { Object.assign(tx, update); }
      }
    },
    delete: async (filter) => {
      try { return await Transaction.deleteOne(filter); } catch(e) {
        const idx = memoryDB.transactions.findIndex(t => {
          for (const key in filter) { if (t[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.transactions.splice(idx, 1);
      }
    }
  },
  pendingTransactions: {
    find: async (filter) => {
      try { return await PendingTransaction.find(filter || {}); } catch(e) { return memoryDB.pendingTransactions; }
    },
    findOne: async (filter) => {
      try { return await PendingTransaction.findOne(filter); } catch(e) { return memoryDB.pendingTransactions.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await PendingTransaction.create(data); } catch(e) { memoryDB.pendingTransactions.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await PendingTransaction.updateOne(filter, update); } catch(e) {
        const tx = memoryDB.pendingTransactions.find(t => {
          for (const key in filter) { if (t[key] !== filter[key]) return false; } return true;
        });
        if (tx) { Object.assign(tx, update); }
      }
    },
    delete: async (filter) => {
      try { return await PendingTransaction.deleteOne(filter); } catch(e) {
        const idx = memoryDB.pendingTransactions.findIndex(t => {
          for (const key in filter) { if (t[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.pendingTransactions.splice(idx, 1);
      }
    },
    deleteMany: async (filter) => {
      try { return await PendingTransaction.deleteMany(filter); } catch(e) {
        memoryDB.pendingTransactions = memoryDB.pendingTransactions.filter(t => {
          for (const key in filter) { if (t[key] === filter[key]) return false; } return true;
        });
      }
    }
  },
  bbcCodes: {
    find: async (filter) => {
      try { return await BBCCode.find(filter || {}); } catch(e) { return memoryDB.bbcCodes; }
    },
    findOne: async (filter) => {
      try { return await BBCCode.findOne(filter); } catch(e) { return memoryDB.bbcCodes.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await BBCCode.create(data); } catch(e) { memoryDB.bbcCodes.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await BBCCode.updateOne(filter, update); } catch(e) {
        const code = memoryDB.bbcCodes.find(c => {
          for (const key in filter) { if (c[key] !== filter[key]) return false; } return true;
        });
        if (code) { Object.assign(code, update); }
      }
    },
    delete: async (filter) => {
      try { return await BBCCode.deleteOne(filter); } catch(e) {
        const idx = memoryDB.bbcCodes.findIndex(c => {
          for (const key in filter) { if (c[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.bbcCodes.splice(idx, 1);
      }
    }
  },
  cards: {
    find: async (filter) => {
      try { return await Card.find(filter || {}); } catch(e) { return memoryDB.cards; }
    },
    create: async (data) => {
      try { return await Card.create(data); } catch(e) { memoryDB.cards.push(data); return data; }
    }
  },
  loans: {
    find: async (filter) => {
      try { return await Loan.find(filter || {}); } catch(e) { return memoryDB.loans; }
    },
    findOne: async (filter) => {
      try { return await Loan.findOne(filter); } catch(e) { return memoryDB.loans.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await Loan.create(data); } catch(e) { memoryDB.loans.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await Loan.updateOne(filter, update); } catch(e) {
        const loan = memoryDB.loans.find(l => {
          for (const key in filter) { if (l[key] !== filter[key]) return false; } return true;
        });
        if (loan) { Object.assign(loan, update); }
      }
    },
    delete: async (filter) => {
      try { return await Loan.deleteOne(filter); } catch(e) {
        const idx = memoryDB.loans.findIndex(l => {
          for (const key in filter) { if (l[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.loans.splice(idx, 1);
      }
    }
  },
  supportTickets: {
    find: async (filter) => {
      try { return await SupportTicket.find(filter || {}); } catch(e) { return memoryDB.supportTickets; }
    },
    findOne: async (filter) => {
      try { return await SupportTicket.findOne(filter); } catch(e) { return memoryDB.supportTickets.find(u => {
        for (const key in filter) { if (u[key] !== filter[key]) return false; } return true;
      }); }
    },
    create: async (data) => {
      try { return await SupportTicket.create(data); } catch(e) { memoryDB.supportTickets.push(data); return data; }
    },
    update: async (filter, update) => {
      try { return await SupportTicket.updateOne(filter, update); } catch(e) {
        const ticket = memoryDB.supportTickets.find(t => {
          for (const key in filter) { if (t[key] !== filter[key]) return false; } return true;
        });
        if (ticket) { Object.assign(ticket, update); }
      }
    },
    delete: async (filter) => {
      try { return await SupportTicket.deleteOne(filter); } catch(e) {
        const idx = memoryDB.supportTickets.findIndex(t => {
          for (const key in filter) { if (t[key] !== filter[key]) return false; } return true;
        });
        if (idx > -1) memoryDB.supportTickets.splice(idx, 1);
      }
    }
  }
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

// ==================== BBC CODE GENERATION (NUMBERS ONLY - NO ALPHA) ====================
const generateBBCode = (step, type = 'transaction') => {
  const displayMessages = {
    1: '🔑 Enter BBC Authorization Code',
    2: '🔒 Enter BBC Security Code',
    3: '🛡️ Enter BBC Final Code'
  };
  
  // ✅ 6-digit numeric code only - NO ALPHA, NO PREFIXES
  const numericCode = Math.floor(100000 + Math.random() * 900000).toString();
  const code = numericCode;
  
  return {
    code,
    step,
    display_message: displayMessages[step],
    type: type
  };
};

const generateBBCodesForTransaction = async (transactionId, userId, type = 'transaction') => {
  const bbcCodes = [];
  for (let step = 1; step <= 3; step++) {
    const bbcData = generateBBCode(step, type);
    const bbc = {
      id: uuidv4(),
      code: bbcData.code,
      step: bbcData.step,
      display_message: bbcData.display_message,
      type: bbcData.type,
      transaction_id: transactionId,
      user_id: userId,
      is_used: false,
      used_at: null,
      expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      created_at: new Date().toISOString()
    };
    await db.bbcCodes.create(bbc);
    bbcCodes.push(bbc);
  }
  return bbcCodes;
};

// ==================== CREATE DEFAULT ADMIN ====================
const createDefaultAdmin = async () => {
  log.step('👑', 'Creating default admin account...');
  
  const adminEmail = 'devgift@gmail.com';
  const existingAdmin = await db.users.findOne({ email: adminEmail });
  
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
    
    await db.users.create(admin);
    
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
    await db.accounts.create(adminAccount);
    
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

// ==================== EMAIL TEMPLATES ====================
const getWelcomeHTML = (userData) => {
  const { full_name, email, account_level } = userData;
  const year = new Date().getFullYear();
  const url = process.env.FRONTEND_URL || 'https://primeheritage-bank-intl.onrender.com';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Prime Heritage Bank</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900&family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 40px 20px; background: #f0f2f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    .email-wrapper { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.04); border: 1px solid #eaedf2; }
    .gold-strip { height: 6px; background: linear-gradient(90deg, #d4af37, #f5d76e, #d4af37); }
    .header { background: linear-gradient(145deg, #0a1628, #1a2a4a); padding: 50px 45px 40px; text-align: center; position: relative; }
    .header::after { content: ''; position: absolute; bottom: 0; left: 10%; right: 10%; height: 1px; background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.3), rgba(212, 175, 55, 0.6), rgba(212, 175, 55, 0.3), transparent); }
    .header .logo { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 700; color: #ffffff; letter-spacing: 2px; }
    .header .logo .gold { color: #d4af37; }
    .header .tagline { color: rgba(255,255,255,0.4); font-size: 11px; letter-spacing: 5px; text-transform: uppercase; margin-top: 8px; font-weight: 300; }
    .header .badge { display: inline-block; margin-top: 16px; padding: 4px 20px; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.15); border-radius: 50px; color: #d4af37; font-size: 9px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600; }
    .body-content { padding: 45px 45px 35px; }
    .greeting { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #0a1628; margin-bottom: 6px; letter-spacing: -0.5px; }
    .greeting .highlight { color: #d4af37; }
    .greeting-sub { color: #6b7280; font-size: 14px; margin-bottom: 20px; font-weight: 400; }
    .message-text { color: #374151; line-height: 1.9; font-size: 15px; margin-bottom: 28px; font-weight: 400; }
    .message-text strong { color: #0a1628; font-weight: 600; }
    .message-text .highlight-text { color: #d4af37; font-weight: 500; }
    .divider-line { height: 1px; background: linear-gradient(90deg, transparent, #eaedf2, transparent); margin: 28px 0 32px; }
    .account-card { background: #f8f9fc; border-radius: 20px; padding: 26px 30px; margin-bottom: 28px; border-left: 4px solid #d4af37; border: 1px solid #eaedf2; }
    .account-card .card-title { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 14px; font-weight: 600; }
    .account-card .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eaedf2; font-size: 14px; }
    .account-card .row:last-child { border-bottom: none; }
    .account-card .label { color: #6b7280; font-weight: 400; }
    .account-card .value { color: #0a1628; font-weight: 600; font-family: 'Inter', monospace; }
    .account-card .value.gold { color: #d4af37; }
    .account-card .value.status { color: #16a34a; display: flex; align-items: center; gap: 6px; }
    .account-card .value.status::before { content: ''; display: inline-block; width: 6px; height: 6px; background: #16a34a; border-radius: 50%; animation: pulse-dot 2s infinite; }
    @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
    .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 28px 0 32px; }
    .feature-item { background: #f8f9fc; border: 1px solid #eaedf2; border-radius: 16px; padding: 16px 14px; text-align: center; transition: all 0.3s ease; }
    .feature-item .icon { font-size: 24px; display: block; margin-bottom: 6px; }
    .feature-item .label { font-weight: 600; color: #0a1628; font-size: 12px; display: block; }
    .feature-item .desc { color: #6b7280; font-size: 10px; margin-top: 2px; }
    .btn-container { text-align: center; margin: 32px 0 8px; }
    .btn-primary { display: inline-block; background: linear-gradient(135deg, #0a1628, #1a2a4a); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 60px; font-weight: 600; font-size: 15px; font-family: 'Inter', sans-serif; letter-spacing: 0.3px; box-shadow: 0 8px 30px rgba(10, 22, 40, 0.15); transition: all 0.3s ease; width: 100%; text-align: center; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(10, 22, 40, 0.25); }
    .btn-secondary { display: inline-block; background: transparent; color: #6b7280; padding: 14px 36px; text-decoration: none; border-radius: 60px; font-weight: 500; font-size: 14px; font-family: 'Inter', sans-serif; border: 1px solid #eaedf2; margin-top: 10px; transition: all 0.3s ease; width: 100%; text-align: center; }
    .btn-secondary:hover { border-color: #d4af37; color: #d4af37; }
    .footer-section { background: #f8f9fc; padding: 30px 45px 25px; text-align: center; border-top: 1px solid #eaedf2; }
    .footer-section .brand-name { color: #0a1628; font-weight: 600; font-size: 14px; letter-spacing: 1px; font-family: 'Playfair Display', serif; }
    .footer-section p { color: #6b7280; font-size: 11px; margin: 4px 0; line-height: 1.8; }
    .footer-section .social-icons { margin: 14px 0 10px; display: flex; justify-content: center; gap: 18px; }
    .footer-section .social-icons span { color: #6b7280; font-size: 16px; opacity: 0.3; transition: all 0.3s; }
    .footer-section .social-icons span:hover { opacity: 1; color: #d4af37; }
    .footer-section .disclaimer { font-size: 9px; color: #9ca3af; margin-top: 14px; padding-top: 14px; border-top: 1px solid #eaedf2; }
    @media (max-width: 520px) {
      .header { padding: 32px 20px 28px; }
      .header .logo { font-size: 26px; }
      .body-content { padding: 28px 20px 24px; }
      .greeting { font-size: 24px; }
      .features-grid { grid-template-columns: 1fr; }
      .account-card { padding: 18px 16px; }
      .account-card .row { flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 0; }
      .btn-primary { padding: 14px 28px; font-size: 14px; }
      .btn-secondary { padding: 12px 20px; font-size: 13px; }
      .footer-section { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="gold-strip"></div>
    <div class="header">
      <div class="logo">Prime Heritage <span class="gold">Bank</span></div>
      <div class="tagline">International Private Banking</div>
      <div class="badge">✦ Since 2026 ✦</div>
    </div>
    <div class="body-content">
      <div class="greeting"><span class="highlight">${full_name}</span></div>
      <div class="greeting-sub">Welcome to Prime Heritage International Bank</div>
      <div class="message-text"><strong>We are honoured to welcome you.</strong><br>Your account has been established with the highest standards of <span class="highlight-text">security</span> and <span class="highlight-text">service excellence</span>. We are committed to delivering an unparalleled private banking experience.</div>
      <div class="divider-line"></div>
      <div class="account-card">
        <div class="card-title">Account Summary</div>
        <div class="row"><span class="label">Account Holder</span><span class="value">${full_name}</span></div>
        <div class="row"><span class="label">Email Address</span><span class="value">${email}</span></div>
        <div class="row"><span class="label">Account Level</span><span class="value gold">${account_level || 'Standard'}</span></div>
        <div class="row"><span class="label">Status</span><span class="value status">Active</span></div>
      </div>
      <div class="features-grid">
        <div class="feature-item"><span class="icon">🌍</span><span class="label">Multi-Currency</span><span class="desc">USD • EUR • GBP • NGN</span></div>
        <div class="feature-item"><span class="icon">💳</span><span class="label">Global Cards</span><span class="desc">Visa • Mastercard • AMEX</span></div>
        <div class="feature-item"><span class="icon">🔐</span><span class="label">Secure Banking</span><span class="desc">3-Step Verification</span></div>
        <div class="feature-item"><span class="icon">⚡</span><span class="label">Instant Transfers</span><span class="desc">SWIFT • SEPA • ACH</span></div>
      </div>
      <div class="btn-container">
        <a href="${url}/dashboard.html" class="btn-primary">Access Your Dashboard</a>
      </div>
    </div>
    <div class="footer-section">
      <div class="brand-name">✦ Prime Heritage International Bank ✦</div>
      <p>Global Banking • Privacy Assured • Excellence Delivered</p>
      <div class="social-icons"><span>📱</span><span>🌐</span><span>🔒</span><span>⚡</span></div>
      <p>© ${year} Prime Heritage International Bank. All rights reserved.</p>
      <div class="disclaimer">This is an automated operational message. Please do not reply directly.</div>
    </div>
  </div>
</body>
</html>`;
};

const getReceiptHTML = (transaction, user) => {
  const receiptUrl = `${process.env.FRONTEND_URL || 'https://primeheritage-bank-intl.onrender.com'}/receipt.html?ref=${transaction.reference}`;
  const txDate = new Date(transaction.created_at || Date.now());
  const dateStr = txDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const year = new Date().getFullYear();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt | Prime Heritage Bank</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700&family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 40px 20px; background: #f0f2f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    .email-wrapper { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.04); border: 1px solid #eaedf2; }
    .gold-strip { height: 6px; background: linear-gradient(90deg, #d4af37, #f5d76e, #d4af37); }
    .header { background: linear-gradient(145deg, #0a1628, #1a2a4a); padding: 32px 45px 28px; text-align: center; }
    .header .logo { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: 2px; }
    .header .logo .gold { color: #d4af37; }
    .body-content { padding: 32px 45px 24px; }
    .receipt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
    .receipt-id { display: inline-block; padding: 6px 20px; background: #f8f9fc; border: 1px solid #eaedf2; border-radius: 50px; font-size: 12px; font-family: 'Inter', monospace; color: #6b7280; letter-spacing: 0.5px; font-weight: 500; }
    .status-badge { display: inline-block; padding: 5px 18px; border-radius: 50px; font-size: 12px; font-weight: 600; background: #ecfdf5; color: #16a34a; border: 1px solid #d1fae5; }
    .amount-section { text-align: center; padding: 20px 0 18px; margin: 16px 0 20px; border-top: 1px solid #eaedf2; border-bottom: 1px solid #eaedf2; }
    .amount-section .amount-label { color: #6b7280; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; }
    .amount-section .amount { font-size: 42px; font-weight: 800; color: #0a1628; letter-spacing: -1px; margin-top: 2px; }
    .amount-section .amount .currency { color: #d4af37; font-size: 30px; margin-right: 4px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 30px; margin: 16px 0 8px; }
    .detail-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .detail-item.full-width { grid-column: 1 / -1; }
    .detail-item .label { color: #6b7280; font-weight: 400; }
    .detail-item .value { color: #0a1628; font-weight: 500; text-align: right; }
    .detail-item .value.mono { font-family: 'Inter', monospace; font-size: 12px; letter-spacing: 0.3px; }
    .detail-item .value.gold-text { color: #d4af37; }
    .btn-container { text-align: center; margin: 24px 0 6px; }
    .view-btn { display: inline-block; background: linear-gradient(135deg, #0a1628, #1a2a4a); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 60px; font-weight: 600; font-size: 15px; font-family: 'Inter', sans-serif; box-shadow: 0 8px 30px rgba(10, 22, 40, 0.15); transition: all 0.3s ease; width: 100%; text-align: center; }
    .view-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(10, 22, 40, 0.25); }
    .footer-section { background: #f8f9fc; padding: 24px 45px 20px; text-align: center; border-top: 1px solid #eaedf2; }
    .footer-section .brand-name { color: #0a1628; font-weight: 600; font-size: 13px; letter-spacing: 1px; font-family: 'Playfair Display', serif; }
    .footer-section p { color: #6b7280; font-size: 11px; margin: 3px 0; line-height: 1.6; }
    .footer-meta { display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 10px; color: #9ca3af; }
    .footer-meta span { display: flex; align-items: center; gap: 4px; }
    @media (max-width: 520px) {
      .header { padding: 24px 20px; }
      .header .logo { font-size: 22px; }
      .body-content { padding: 24px 20px; }
      .amount-section .amount { font-size: 30px; }
      .detail-grid { grid-template-columns: 1fr; }
      .detail-item .value { text-align: left; }
      .detail-item { flex-direction: column; gap: 2px; padding: 12px 0; }
      .receipt-header { flex-direction: column; align-items: flex-start; }
      .view-btn { padding: 14px 28px; font-size: 14px; }
      .footer-section { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="gold-strip"></div>
    <div class="header">
      <div class="logo">Prime Heritage <span class="gold">Bank</span></div>
    </div>
    <div class="body-content">
      <div class="receipt-header">
        <span class="receipt-id">#${transaction.reference || 'N/A'}</span>
        <span class="status-badge">✓ Completed</span>
      </div>
      <div class="amount-section">
        <div class="amount-label">Total Amount</div>
        <div class="amount"><span class="currency">${transaction.currency || 'USD'}</span> ${(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="detail-grid">
        <div class="detail-item full-width"><span class="label">Transaction Type</span><span class="value">${transaction.type || 'Transaction'}</span></div>
        <div class="detail-item full-width"><span class="label">Description</span><span class="value">${transaction.description || transaction.purpose || 'N/A'}</span></div>
        <div class="detail-item"><span class="label">Date</span><span class="value">${dateStr}</span></div>
        <div class="detail-item"><span class="label">Time</span><span class="value">${timeStr}</span></div>
        <div class="detail-item full-width"><span class="label">Reference</span><span class="value mono gold-text">${transaction.reference || 'N/A'}</span></div>
      </div>
      <div class="btn-container"><a href="${receiptUrl}" class="view-btn">View Full Receipt</a></div>
      <div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:8px;">This is an automated receipt for your transaction.</div>
    </div>
    <div class="footer-section">
      <div class="brand-name">✦ Prime Heritage International Bank ✦</div>
      <p>Global Banking • Privacy Assured • Excellence Delivered</p>
      <p>© ${year} Prime Heritage International Bank</p>
      <p style="font-size: 10px;">Sent to ${user.email}</p>
      <div class="footer-meta"><span>🔒 Secured Transaction</span><span>🌍 Global Transfer</span><span>📱 Mobile Ready</span></div>
    </div>
  </div>
</body>
</html>`;
};

const getTestHTML = () => {
  const year = new Date().getFullYear();
  const url = process.env.FRONTEND_URL || 'https://primeheritage-bank-intl.onrender.com';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Started | Prime Heritage Bank</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800&family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 40px 20px; background: #f0f2f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    .email-wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.04); border: 1px solid #eaedf2; }
    .gold-strip { height: 6px; background: linear-gradient(90deg, #d4af37, #f5d76e, #d4af37); }
    .header { background: linear-gradient(145deg, #0a1628, #1a2a4a); padding: 40px 45px 32px; text-align: center; }
    .header .logo { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #ffffff; letter-spacing: 2px; }
    .header .logo .gold { color: #d4af37; }
    .header .sub { color: rgba(255,255,255,0.35); font-size: 11px; letter-spacing: 5px; text-transform: uppercase; margin-top: 6px; font-weight: 300; }
    .body-content { padding: 35px 45px 28px; }
    .title { font-size: 24px; font-weight: 700; color: #0a1628; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
    .title .check { color: #16a34a; }
    .box { padding: 18px 24px; border-radius: 16px; margin: 16px 0; }
    .box-success { background: #ecfdf5; border: 1px solid #d1fae5; color: #065f46; }
    .box-success strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .box-success span { font-size: 14px; opacity: 0.85; }
    .box-info { background: #f8f9fc; border: 1px solid #eaedf2; }
    .box-info .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .box-info .row .label { color: #6b7280; }
    .box-info .row .value { color: #0a1628; font-weight: 500; }
    .box-admin { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .box-admin .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .box-admin code { background: #ffffff; padding: 2px 14px; border-radius: 6px; font-size: 14px; font-weight: 600; color: #92400e; font-family: 'Inter', monospace; }
    .divider { height: 1px; background: #eaedf2; margin: 20px 0; }
    .footer { background: #f8f9fc; padding: 20px 45px; text-align: center; border-top: 1px solid #eaedf2; }
    .footer p { color: #6b7280; font-size: 12px; margin: 4px 0; }
    .footer .brand { color: #0a1628; font-weight: 600; font-size: 13px; font-family: 'Playfair Display', serif; }
    @media (max-width: 480px) {
      .header { padding: 28px 20px 24px; }
      .header .logo { font-size: 24px; }
      .body-content { padding: 24px 20px; }
      .title { font-size: 20px; }
      .box-info .row { flex-direction: column; gap: 2px; }
      .box-admin .row { flex-direction: column; gap: 2px; }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="gold-strip"></div>
    <div class="header">
      <div class="logo">Prime Heritage <span class="gold">Bank</span></div>
      <div class="sub">International Banking Excellence</div>
    </div>
    <div class="body-content">
      <div class="title"><span class="check">✓</span> Server Started Successfully</div>
      <div class="box box-success"><strong>Email System Operational</strong><span>Your server is running and emails are sending correctly via Netlify.</span></div>
      <div class="box box-info">
        <div class="row"><span class="label">🕐 Time</span><span class="value">${new Date().toLocaleString()}</span></div>
        <div class="row"><span class="label">🌍 Environment</span><span class="value">Production</span></div>
        <div class="row"><span class="label">🔗 URL</span><span class="value" style="font-size:13px;">${url}</span></div>
      </div>
      <div class="box box-admin">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">👑 Admin Access</div>
        <div class="row"><span>Email</span><code>devgift@gmail.com</code></div>
        <div class="row"><span>Password</span><code>Igwe</code></div>
        <div style="margin-top:8px;font-size:12px;opacity:0.7;"><span style="display:inline-block;width:8px;height:8px;background:#16a34a;border-radius:50%;margin-right:6px;"></span> Balance: UNLIMITED</div>
      </div>
      <div class="divider"></div>
      <div style="text-align:center;font-size:13px;color:#6b7280;">All systems operational. Banking platform ready.</div>
    </div>
    <div class="footer">
      <div class="brand">✦ Prime Heritage International Bank ✦</div>
      <p>© ${year} Prime Heritage International Bank. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
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

// ✅ FIXED: Correct email address - devgift@gmail.com
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

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.users.findOne({ id: decoded.userId });
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
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
    const fromAccount = await db.accounts.findOne({ account_number: transaction.from_account_number });
    const toAccount = await db.accounts.findOne({ account_number: transaction.to_account_number });
    
    if (fromAccount && toAccount) {
      if (!req.user.is_unlimited) {
        fromAccount.balance -= transaction.amount;
        await db.accounts.update({ account_number: transaction.from_account_number }, { balance: fromAccount.balance });
      }
      toAccount.balance += transaction.amount;
      await db.accounts.update({ account_number: transaction.to_account_number }, { balance: toAccount.balance });
      
      const completedTx = { ...transaction, status: 'completed', completed_at: new Date().toISOString() };
      await db.transactions.create(completedTx);
      await db.pendingTransactions.deleteMany({ reference: transaction.reference });
      
      const user = await db.users.findOne({ id: req.user.id });
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
const servePage = (page) => (req, res) => res.sendFile(path.join(__dirname, 'public', page));

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
app.get('/api/health', async (req, res) => {
  const users = await db.users.find();
  const accounts = await db.accounts.find();
  const transactions = await db.transactions.find();
  const bbcCodes = await db.bbcCodes.find();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    users: users.length,
    accounts: accounts.length,
    transactions: transactions.length,
    bbcCodes: bbcCodes.length
  });
});

// ==================== API: REGISTER ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    log.info('Registration request:', req.body.email);
    
    const { full_name, first_name, last_name, email, phone, password, transaction_pin, passport_number, nationality, country_of_residence, date_of_birth } = req.body;

    if (!full_name || !first_name || !last_name || !email || !phone || !password || !transaction_pin) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const existingUser = await db.users.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(transaction_pin, 10);

    const user = {
      id: uuidv4(), full_name, first_name, last_name, email, phone,
      password: hashedPassword, transaction_pin: hashedPin,
      passport_number: passport_number || 'N/A', nationality: nationality || 'N/A',
      country_of_residence: country_of_residence || 'N/A', date_of_birth: date_of_birth || 'N/A',
      account_level: 'standard', is_active: true, is_verified: false,
      is_admin: false, is_super_admin: false, is_unlimited: false,
      login_count: 0, created_at: new Date().toISOString()
    };
    
    await db.users.create(user);
    log.success('User created:', user.email);

    const currencies = ['USD', 'EUR', 'GBP', 'NGN'];
    for (const currency of currencies) {
      await db.accounts.create({
        id: uuidv4(), user_id: user.id, currency,
        account_number: generateAccountNumber(),
        iban: generateIBAN(),
        swift_code: 'IB' + currency + Math.floor(Math.random() * 10000),
        balance: 0.00, is_primary: currency === 'USD',
        account_type: 'current', is_active: true,
        created_at: new Date().toISOString()
      });
    }

    sendWelcomeEmail(user).catch(() => {});

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    const userAccounts = await db.accounts.find({ user_id: user.id });
    const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];

    res.status(201).json({
      success: true, message: 'Registration successful!', token,
      user: {
        id: user.id, email: user.email, full_name: user.full_name,
        account_level: user.account_level, is_verified: user.is_verified,
        is_admin: user.is_admin, accounts: userAccounts,
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

    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await db.users.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    user.last_login = new Date().toISOString();
    user.login_count = (user.login_count || 0) + 1;
    await db.users.update({ email }, { last_login: user.last_login, login_count: user.login_count });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    const userAccounts = await db.accounts.find({ user_id: user.id });
    const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];
    const totalBalance = userAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    res.json({
      success: true, message: 'Login successful', token,
      user: {
        id: user.id, email: user.email, full_name: user.full_name,
        first_name: user.first_name, last_name: user.last_name,
        account_level: user.account_level, is_verified: user.is_verified,
        is_active: user.is_active, is_admin: user.is_admin,
        is_super_admin: user.is_super_admin || false,
        is_unlimited: user.is_unlimited || false,
        accounts: userAccounts, totalBalance: totalBalance,
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
    const user = await db.users.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userAccounts = await db.accounts.find({ user_id: user.id });
    const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];
    const totalBalance = userAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    
    const cards = await db.cards.find({ user_id: user.id });
    const transactions = await db.transactions.find({ $or: [{ from_user_id: user.id }, { to_user_id: user.id }] });
    const loans = await db.loans.find({ user_id: user.id });
    const supportTickets = await db.supportTickets.find({ user_id: user.id });
    
    res.json({
      success: true,
      user: {
        ...user._doc,
        password: undefined,
        transaction_pin: undefined,
        accounts: userAccounts,
        totalBalance: totalBalance,
        is_unlimited: user.is_unlimited || false,
        account_number: primaryAccount?.account_number || 'N/A',
        iban: primaryAccount?.iban || 'N/A',
        swift_code: primaryAccount?.swift_code || 'N/A',
        currency: primaryAccount?.currency || 'USD',
        cards: cards,
        transactions: transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50),
        loans: loans,
        supportTickets: supportTickets
      }
    });
  } catch (error) {
    log.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== API: GET ACCOUNTS ====================
app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const accounts = await db.accounts.find({ user_id: req.user.id, is_active: true });
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// ==================== API: GET TRANSACTIONS ====================
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = await db.transactions.find({ $or: [{ from_user_id: req.user.id }, { to_user_id: req.user.id }] });
    res.json({ success: true, transactions: transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ==================== API: GET ALL TRANSACTIONS ====================
app.get('/api/transactions/all', authMiddleware, async (req, res) => {
  try {
    const transactions = await db.transactions.find({ $or: [{ from_user_id: req.user.id }, { to_user_id: req.user.id }] });
    
    const enrichedTransactions = await Promise.all(transactions.map(async (tx) => {
      const sender = await db.users.findOne({ id: tx.from_user_id });
      const recipient = await db.users.findOne({ id: tx.to_user_id });
      return { ...tx._doc, sender_name: tx.sender_name || sender?.full_name || 'System', recipient_name: recipient?.full_name || 'Unknown' };
    }));
    
    res.json({ success: true, transactions: enrichedTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), count: enrichedTransactions.length });
  } catch (error) {
    log.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// ==================== API: GET RECEIPT ====================
app.get('/api/receipt/:reference', authMiddleware, async (req, res) => {
  try {
    const transaction = await db.transactions.findOne({ reference: req.params.reference, $or: [{ from_user_id: req.user.id }, { to_user_id: req.user.id }] });
    if (!transaction) return res.status(404).json({ error: 'Receipt not found' });
    const sender = await db.users.findOne({ id: transaction.from_user_id });
    const recipient = await db.users.findOne({ id: transaction.to_user_id });
    let role = transaction.from_user_id === req.user.id ? 'sender' : 'recipient';
    res.json({
      success: true,
      transaction: { ...transaction._doc, sender_name: transaction.sender_name || sender?.full_name || 'N/A', recipient_name: recipient?.full_name || 'N/A' },
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
    const transaction = await db.transactions.findOne({ reference: req.params.reference });
    if (!transaction) return res.status(404).json({ error: 'Receipt not found' });
    const sender = await db.users.findOne({ id: transaction.from_user_id });
    const recipient = await db.users.findOne({ id: transaction.to_user_id });
    res.json({
      success: true,
      transaction: { ...transaction._doc, sender_name: transaction.sender_name || sender?.full_name || 'N/A', recipient_name: recipient?.full_name || 'N/A' },
      role: 'admin',
      sender: sender ? { full_name: sender.full_name, email: sender.email } : null,
      recipient: recipient ? { full_name: recipient.full_name, email: recipient.email } : null
    });
  } catch (error) {
    log.error('Admin get receipt error:', error);
    res.status(500).json({ error: 'Failed to get receipt' });
  }
});

// ==================== ADMIN SEND MONEY (CREDIT TRANSFER) ====================
app.post('/api/admin/send', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { toAccountNumber, amount, currency, senderName, note } = req.body;
    
    log.admin(`Sending money: ${amount} ${currency} to ${toAccountNumber} from ${senderName}`);
    
    const toAccount = await db.accounts.findOne({ account_number: toAccountNumber });
    if (!toAccount) return res.status(404).json({ error: 'Recipient account not found' });
    
    const recipient = await db.users.findOne({ id: toAccount.user_id });
    if (!recipient) return res.status(404).json({ error: 'Recipient user not found' });
    
    const reference = generateReference();
    
    const transaction = {
      id: uuidv4(), reference, type: 'credit_transfer', amount, currency,
      from_user_id: req.user.id, to_user_id: recipient.id,
      from_account_number: 'CREDIT-SYSTEM', to_account_number: toAccount.account_number,
      description: note || `Credit transfer from ${senderName || 'Credit System'}`,
      sender_name: senderName || 'Credit System',
      status: 'completed', created_at: new Date().toISOString()
    };
    
    await db.transactions.create(transaction);
    toAccount.balance = (toAccount.balance || 0) + amount;
    await db.accounts.update({ account_number: toAccountNumber }, { balance: toAccount.balance });
    
    sendReceiptEmail(transaction, recipient).catch(() => {});
    
    res.json({
      success: true,
      message: `Sent ${amount} ${currency} to ${recipient.full_name}`,
      transaction: { reference, amount, currency, recipient: recipient.full_name, recipientEmail: recipient.email, senderName: senderName || 'Credit System' }
    });
  } catch (error) {
    log.error('Admin send money error:', error);
    res.status(500).json({ error: 'Failed to send money' });
  }
});

// ==================== SUPPORT ROUTES ====================

app.get('/api/support/tickets', authMiddleware, async (req, res) => {
  try {
    const tickets = await db.supportTickets.find({ user_id: req.user.id });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

app.post('/api/support/tickets', authMiddleware, async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });
    const ticket = { id: uuidv4(), user_id: req.user.id, subject, message, category: category || 'General', status: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await db.supportTickets.create(ticket);
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

app.get('/api/support/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const ticket = await db.supportTickets.findOne({ id: req.params.id, user_id: req.user.id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

app.put('/api/admin/support/tickets/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, response } = req.body;
    const ticket = await db.supportTickets.findOne({ id: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const updateData = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (response) { updateData.response = response; updateData.responded_at = new Date().toISOString(); updateData.responded_by = req.user.id; }
    await db.supportTickets.update({ id: req.params.id }, updateData);
    const updatedTicket = await db.supportTickets.findOne({ id: req.params.id });
    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.get('/api/admin/support/tickets', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tickets = await db.supportTickets.find();
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

// ==================== LOANS ROUTES ====================

app.get('/api/loans', authMiddleware, async (req, res) => {
  try {
    const loans = await db.loans.find({ user_id: req.user.id });
    res.json({ success: true, loans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loans' });
  }
});

app.post('/api/loans', authMiddleware, async (req, res) => {
  try {
    const { amount, currency, purpose, tenure_months } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid loan amount is required' });
    const interestRate = 12;
    const totalInterest = amount * (interestRate / 100);
    const monthlyPayment = (amount + totalInterest) / (tenure_months || 36);
    const loan = { id: uuidv4(), user_id: req.user.id, amount, currency: currency || 'USD', purpose: purpose || 'Personal', tenure_months: tenure_months || 36, interest_rate: interestRate, monthly_payment: parseFloat(monthlyPayment.toFixed(2)), status: 'pending', created_at: new Date().toISOString() };
    await db.loans.create(loan);
    res.json({ success: true, loan });
  } catch (error) {
    log.error('Loan application error:', error);
    res.status(500).json({ error: 'Failed to apply for loan' });
  }
});

app.get('/api/loans/:id', authMiddleware, async (req, res) => {
  try {
    const loan = await db.loans.findOne({ id: req.params.id, user_id: req.user.id });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    res.json({ success: true, loan });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loan' });
  }
});

app.put('/api/admin/loans/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const loan = await db.loans.findOne({ id: req.params.id });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    await db.loans.update({ id: req.params.id }, { status });
    const updatedLoan = await db.loans.findOne({ id: req.params.id });
    res.json({ success: true, loan: updatedLoan });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update loan' });
  }
});

app.get('/api/admin/loans', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const loans = await db.loans.find();
    res.json({ success: true, loans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loans' });
  }
});

// ==================== BBC SECURED TRANSACTIONS ====================

// === SEND MONEY ===
app.post('/api/send/step1', authMiddleware, async (req, res) => {
  try {
    const { toAccountNumber, amount, description, transactionPin } = req.body;
    if (!(await bcrypt.compare(transactionPin, req.user.transaction_pin))) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    const toAccount = await db.accounts.findOne({ account_number: toAccountNumber });
    if (!toAccount) return res.status(404).json({ error: 'Recipient account not found' });
    const recipient = await db.users.findOne({ id: toAccount.user_id });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    const fromAccount = await db.accounts.findOne({ user_id: req.user.id, currency: 'USD' });
    if (!fromAccount) return res.status(404).json({ error: 'Your USD account not found' });
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    const reference = generateReference();
    const transaction = { id: uuidv4(), reference, type: 'transfer', amount, currency: 'USD', from_user_id: req.user.id, to_user_id: recipient.id, from_account_number: fromAccount.account_number, to_account_number: toAccount.account_number, description: description || 'Transfer', sender_name: req.user.full_name, status: 'pending_bbc', step: 1, created_at: new Date().toISOString() };
    await db.pendingTransactions.create(transaction);
    const bbcCodes = await generateBBCodesForTransaction(reference, req.user.id, 'transaction');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    res.json({ success: true, message: firstBbc.display_message, reference, nextStep: 2, bbc_code: firstBbc.code });
  } catch (error) {
    log.error('Send step1 error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

app.post('/api/send/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, from_user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 1, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 2 });
    const step2Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 2, is_used: false });
    res.json({ success: true, message: step2Bbc?.display_message || 'Enter BBC Security Code', nextStep: 3, bbc_code: step2Bbc?.code });
  } catch (error) {
    log.error('Send step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/send/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, from_user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 2, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 3 });
    const step3Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 3, is_used: false });
    res.json({ success: true, message: step3Bbc?.display_message || 'Enter BBC Final Code', nextStep: 4, bbc_code: step3Bbc?.code });
  } catch (error) {
    log.error('Send step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/send/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, from_user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 3, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    const result = await completeTransaction(transaction, req, res);
    if (result.success) {
      res.json({ success: true, message: 'Transfer completed successfully!', newBalance: result.newBalance, receipt: result.transaction.reference });
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
    if (!(await bcrypt.compare(transactionPin, req.user.transaction_pin))) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    const fromAccount = await db.accounts.findOne({ user_id: req.user.id, currency: 'USD' });
    if (!fromAccount) return res.status(404).json({ error: 'Your USD account not found' });
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    const reference = generateReference();
    const transaction = { id: uuidv4(), reference, type: 'airtime', phoneNumber, countryCode: countryCode || '234', network, amount, user_id: req.user.id, from_account_number: fromAccount.account_number, sender_name: req.user.full_name, status: 'pending_bbc', step: 1, created_at: new Date().toISOString() };
    await db.pendingTransactions.create(transaction);
    const bbcCodes = await generateBBCodesForTransaction(reference, req.user.id, 'airtime');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    res.json({ success: true, message: firstBbc.display_message, reference, nextStep: 2, bbc_code: firstBbc.code });
  } catch (error) {
    log.error('Airtime step1 error:', error);
    res.status(500).json({ error: 'Airtime purchase failed' });
  }
});

app.post('/api/airtime/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 1, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 2 });
    const step2Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 2, is_used: false });
    res.json({ success: true, message: step2Bbc?.display_message || 'Enter BBC Security Code', nextStep: 3, bbc_code: step2Bbc?.code });
  } catch (error) {
    log.error('Airtime step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/airtime/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 2, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 3 });
    const step3Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 3, is_used: false });
    res.json({ success: true, message: step3Bbc?.display_message || 'Enter BBC Final Code', nextStep: 4, bbc_code: step3Bbc?.code });
  } catch (error) {
    log.error('Airtime step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/airtime/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 3, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    const result = await completeTransaction(transaction, req, res);
    if (result.success) {
      res.json({ success: true, message: 'Airtime purchased successfully!', newBalance: result.newBalance, receipt: result.transaction.reference });
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
    if (!(await bcrypt.compare(transactionPin, req.user.transaction_pin))) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    const fromAccount = await db.accounts.findOne({ user_id: req.user.id, currency: 'USD' });
    if (!fromAccount) return res.status(404).json({ error: 'Your USD account not found' });
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    const reference = generateReference();
    const transaction = { id: uuidv4(), reference, type: 'bill_payment', billType, provider, accountNumber, amount, country: country || 'US', user_id: req.user.id, from_account_number: fromAccount.account_number, sender_name: req.user.full_name, status: 'pending_bbc', step: 1, created_at: new Date().toISOString() };
    await db.pendingTransactions.create(transaction);
    const bbcCodes = await generateBBCodesForTransaction(reference, req.user.id, 'bills');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    res.json({ success: true, message: firstBbc.display_message, reference, nextStep: 2, bbc_code: firstBbc.code });
  } catch (error) {
    log.error('Bills step1 error:', error);
    res.status(500).json({ error: 'Bill payment failed' });
  }
});

app.post('/api/bills/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 1, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 2 });
    const step2Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 2, is_used: false });
    res.json({ success: true, message: step2Bbc?.display_message || 'Enter BBC Security Code', nextStep: 3, bbc_code: step2Bbc?.code });
  } catch (error) {
    log.error('Bills step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/bills/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 2, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 3 });
    const step3Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 3, is_used: false });
    res.json({ success: true, message: step3Bbc?.display_message || 'Enter BBC Final Code', nextStep: 4, bbc_code: step3Bbc?.code });
  } catch (error) {
    log.error('Bills step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/bills/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 3, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    const result = await completeTransaction(transaction, req, res);
    if (result.success) {
      res.json({ success: true, message: 'Bill payment successful!', newBalance: result.newBalance, receipt: result.transaction.reference });
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
    if (!(await bcrypt.compare(transactionPin, req.user.transaction_pin))) {
      return res.status(401).json({ error: 'Invalid transaction PIN' });
    }
    const fromAccount = await db.accounts.findOne({ user_id: req.user.id, currency: 'USD' });
    if (!fromAccount) return res.status(404).json({ error: 'Your USD account not found' });
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    const reference = generateReference();
    const transaction = { id: uuidv4(), reference, type: 'data_bundle', phoneNumber, countryCode: countryCode || '234', network, planName, dataSize, amount, user_id: req.user.id, from_account_number: fromAccount.account_number, sender_name: req.user.full_name, status: 'pending_bbc', step: 1, created_at: new Date().toISOString() };
    await db.pendingTransactions.create(transaction);
    const bbcCodes = await generateBBCodesForTransaction(reference, req.user.id, 'data');
    const firstBbc = bbcCodes.find(b => b.step === 1);
    res.json({ success: true, message: firstBbc.display_message, reference, nextStep: 2, bbc_code: firstBbc.code });
  } catch (error) {
    log.error('Data step1 error:', error);
    res.status(500).json({ error: 'Data purchase failed' });
  }
});

app.post('/api/data/step2', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 1, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 2 });
    const step2Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 2, is_used: false });
    res.json({ success: true, message: step2Bbc?.display_message || 'Enter BBC Security Code', nextStep: 3, bbc_code: step2Bbc?.code });
  } catch (error) {
    log.error('Data step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/data/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 2, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 3 });
    const step3Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 3, is_used: false });
    res.json({ success: true, message: step3Bbc?.display_message || 'Enter BBC Final Code', nextStep: 4, bbc_code: step3Bbc?.code });
  } catch (error) {
    log.error('Data step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/data/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 3, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    const result = await completeTransaction(transaction, req, res);
    if (result.success) {
      res.json({ success: true, message: 'Data bundle purchased successfully!', newBalance: result.newBalance, receipt: result.transaction.reference });
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
    if (!validPin) return res.status(401).json({ error: 'Invalid transaction PIN' });
    
    const fromAccount = await db.accounts.findOne({ user_id: req.user.id, currency: 'USD' });
    if (!fromAccount) return res.status(404).json({ error: 'Your USD account not found' });
    
    if (!req.user.is_unlimited && fromAccount.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const reference = generateReference();
    const transaction = {
      id: uuidv4(), reference, type: 'withdrawal', bankName, accountHolder,
      bankAccountNumber, routingNumber, amount, user_id: req.user.id,
      from_account_number: fromAccount.account_number, sender_name: req.user.full_name,
      status: 'pending_bbc', step: 1, created_at: new Date().toISOString()
    };
    
    await db.pendingTransactions.create(transaction);
    const bbcCodes = await generateBBCodesForTransaction(reference, req.user.id, 'withdraw');
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
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 1, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 2 });
    const step2Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 2, is_used: false });
    res.json({ success: true, message: step2Bbc?.display_message || 'Enter BBC Security Code', nextStep: 3, bbc_code: step2Bbc?.code });
  } catch (error) {
    log.error('Withdraw step2 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/withdraw/step3', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 2, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    await db.pendingTransactions.update({ reference }, { step: 3 });
    const step3Bbc = await db.bbcCodes.findOne({ transaction_id: reference, step: 3, is_used: false });
    res.json({ success: true, message: step3Bbc?.display_message || 'Enter BBC Final Code', nextStep: 4, bbc_code: step3Bbc?.code });
  } catch (error) {
    log.error('Withdraw step3 error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/withdraw/step4', authMiddleware, async (req, res) => {
  try {
    const { reference, bbcCode } = req.body;
    const transaction = await db.pendingTransactions.findOne({ reference, user_id: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    const bbc = await db.bbcCodes.findOne({ code: bbcCode, transaction_id: reference, step: 3, is_used: false });
    if (!bbc) return res.status(400).json({ error: 'Invalid or expired BBC code' });
    if (new Date(bbc.expires_at) < new Date()) return res.status(400).json({ error: 'BBC code expired' });
    await db.bbcCodes.update({ id: bbc.id }, { is_used: true, used_at: new Date().toISOString() });
    const result = await completeTransaction(transaction, req, res);
    if (result.success) {
      res.json({ success: true, message: 'Withdrawal successful! Funds will be sent to your bank account.', newBalance: result.newBalance, receipt: result.transaction.reference });
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
    const users = await db.users.find();
    const usersWithDetails = await Promise.all(users.map(async (user) => {
      const userAccounts = await db.accounts.find({ user_id: user.id });
      const totalBalance = userAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      const primaryAccount = userAccounts.find(a => a.is_primary) || userAccounts[0];
      const transactions = await db.transactions.find({ $or: [{ from_user_id: user.id }, { to_user_id: user.id }] });
      const cards = await db.cards.find({ user_id: user.id });
      const loans = await db.loans.find({ user_id: user.id });
      const bbcCodes = await db.bbcCodes.find({ user_id: user.id });
      
      return {
        id: user.id, full_name: user.full_name, first_name: user.first_name,
        last_name: user.last_name, email: user.email, phone: user.phone,
        is_active: user.is_active, is_admin: user.is_admin, is_unlimited: user.is_unlimited || false,
        account_level: user.account_level, is_verified: user.is_verified,
        login_count: user.login_count || 0, last_login: user.last_login || null,
        created_at: user.created_at, account_number: primaryAccount?.account_number || 'N/A',
        iban: primaryAccount?.iban || 'N/A', currency: primaryAccount?.currency || 'USD',
        totalBalance: totalBalance, accountCount: userAccounts.length,
        transactionCount: transactions.length, cardCount: cards.length,
        loanCount: loans.length, bbcCount: bbcCodes.length
      };
    }));
    res.json(usersWithDetails);
  } catch (error) {
    log.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// ==================== ADMIN GET ALL BBC CODES ====================
app.get('/api/admin/bbc/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bbcCodes = await db.bbcCodes.find();
    const enrichedCodes = await Promise.all(bbcCodes.map(async (code) => {
      const user = await db.users.findOne({ id: code.user_id });
      return {
        ...code._doc,
        user_name: user?.full_name || 'Unknown User',
        user_email: user?.email || 'Unknown'
      };
    }));
    res.json(enrichedCodes);
  } catch (error) {
    log.error('Admin get all BBC codes error:', error);
    res.status(500).json({ error: 'Failed to get BBC codes' });
  }
});

// ==================== ADMIN DELETE BBC CODE ====================
app.delete('/api/admin/bbc/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bbc = await db.bbcCodes.findOne({ id: req.params.id });
    if (!bbc) return res.status(404).json({ error: 'BBC code not found' });
    await db.bbcCodes.delete({ id: req.params.id });
    res.json({ success: true, message: 'BBC code deleted successfully' });
  } catch (error) {
    log.error('Admin delete BBC code error:', error);
    res.status(500).json({ error: 'Failed to delete BBC code' });
  }
});

// ==================== ADMIN GET BBC CODES BY USER ====================
app.get('/api/admin/bbc/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bbcCodes = await db.bbcCodes.find({ user_id: req.params.userId });
    res.json(bbcCodes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get BBC codes' });
  }
});

// ==================== ADMIN GENERATE BBC CODES ====================
app.post('/api/admin/generate-bbc', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, step, quantity = 1, expiryDays = 30 } = req.body;
    const user = await db.users.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const codes = [];
    const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    
    for (let i = 0; i < quantity; i++) {
      const bbcData = generateBBCode(parseInt(step), 'transaction');
      const bbc = {
        id: uuidv4(),
        code: bbcData.code,
        step: bbcData.step,
        display_message: bbcData.display_message,
        type: bbcData.type,
        user_id: userId,
        is_used: false,
        used_at: null,
        expires_at: expiryDate.toISOString(),
        created_at: new Date().toISOString()
      };
      await db.bbcCodes.create(bbc);
      codes.push(bbc);
    }
    
    res.json({ success: true, message: `Generated ${codes.length} BBC codes`, codes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate BBC codes' });
  }
});

// ==================== ADMIN TOGGLE USER STATUS ====================
app.post('/api/admin/toggle-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await db.users.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_admin) return res.status(400).json({ error: 'Cannot modify admin account' });
    user.is_active = !user.is_active;
    await db.users.update({ id: userId }, { is_active: user.is_active });
    res.json({ success: true, message: `User ${user.is_active ? 'activated' : 'frozen'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

// ==================== ADMIN DELETE USER ====================
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await db.users.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_admin) return res.status(400).json({ error: 'Cannot delete admin account' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.users.delete({ id: userId });
    await db.accounts.delete({ user_id: userId });
    await db.transactions.delete({ $or: [{ from_user_id: userId }, { to_user_id: userId }] });
    await db.cards.delete({ user_id: userId });
    await db.loans.delete({ user_id: userId });
    await db.supportTickets.delete({ user_id: userId });
    await db.bbcCodes.delete({ user_id: userId });
    await db.pendingTransactions.delete({ $or: [{ from_user_id: userId }, { user_id: userId }] });
    res.json({ success: true, message: `User ${user.full_name} deleted` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== ADMIN STATS ====================
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await db.users.find();
    const accounts = await db.accounts.find();
    const transactions = await db.transactions.find();
    const bbcCodes = await db.bbcCodes.find();
    const cards = await db.cards.find();
    const loans = await db.loans.find();
    
    res.json({
      totalUsers: users.length,
      activeUsers: users.filter(u => u.is_active).length,
      totalAccounts: accounts.length,
      totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
      totalTransactions: transactions.length,
      totalBBCodes: bbcCodes.length,
      totalCards: cards.length,
      totalLoans: loans.length
    });
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
    console.log(`📊 Database: MongoDB (Data Persists!)`);
    console.log(`📧 Email Provider: Netlify Function`);
    console.log(`🔐 BBC Security: 6-Digit Numeric Codes Only (NO ALPHA)`);
    console.log(`💡 New users start with $0 balance`);
    console.log(`🗑️ Admin can delete BBC codes`);
    console.log('='.repeat(70) + '\n');
    
    setTimeout(() => {
      sendTestEmail().catch(err => {
        log.error('Startup test email failed:', err);
      });
    }, 3000);
  });
};

startServer();

module.exports = app;
