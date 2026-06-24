require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ========== SUPABASE CONFIG ==========
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://locubftytnfyxacfberj.supabase.co',
    process.env.SUPABASE_KEY || 'sb_publishable_AsPMmqBAtex3C_zfofY8sw_GGJ_nxyk'
);

// ========== EMAIL CONFIG ==========
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER || 'primeheritageinternationalbank@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'pzxw dqxj queu wcch'
    },
    tls: { rejectUnauthorized: false }
});

// Verify email connection
transporter.verify((error) => {
    if (error) {
        console.log('❌ Email connection failed:', error.message);
    } else {
        console.log('✅ Email service ready!');
    }
});

// ========== COLORED LOGGING ==========
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gold: '\x1b[38;5;214m',
};

function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = {
        'INFO': 'ℹ️ INFO',
        'SUCCESS': '✅ SUCCESS',
        'ERROR': '❌ ERROR',
        'WARN': '⚠️ WARN',
        'DEBUG': '🔍 DEBUG',
        'AUTH': '🔐 AUTH',
        'EMAIL': '📧 EMAIL',
        'BANK': '🏦 BANK',
        'BBC': '🔐 BBC'
    }[level] || '📌 LOG';
    
    const color = {
        'INFO': colors.cyan,
        'SUCCESS': colors.green,
        'ERROR': colors.red,
        'WARN': colors.yellow,
        'DEBUG': colors.magenta,
        'AUTH': colors.gold,
        'EMAIL': colors.blue,
        'BANK': colors.gold,
        'BBC': colors.magenta
    }[level] || colors.white;
    
    console.log(`${color}[${timestamp}] ${prefix}: ${message}${colors.reset}`);
    if (data) console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
}

// ========== STARTUP BANNER ==========
console.log(`\n${colors.bright}${colors.gold}`);
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                                                                   ║');
console.log('║     👑  PRIME HERITAGE BANK - INTERNATIONAL BANKING 2026        ║');
console.log('║                                                                   ║');
console.log('║     🌍 Global Excellence  •  💎 Premium Service  •  🔒 Secure    ║');
console.log('║     🔐 BBC 3-Step Security System Active                         ║');
console.log('║                                                                   ║');
console.log('║     Version: 5.0.0                                               ║');
console.log('║     Initializing banking system...                               ║');
console.log('║                                                                   ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log(`${colors.reset}\n`);

// ========== RATE LIMITING ==========
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

// ========== HELPERS ==========
function generateAccountNumber(currency) {
    const prefixes = { 'USD': 'PHB-USA', 'EUR': 'PHB-EU', 'GBP': 'PHB-UK' };
    const prefix = prefixes[currency] || 'PHB';
    const nums = Array.from({ length: 3 }, () => Math.floor(Math.random() * 9000 + 1000));
    return `${prefix}-${nums.join('-')}`;
}

function generateIBAN(currency, accountNumber) {
    const countries = { 'USD': 'US', 'EUR': 'DE', 'GBP': 'GB' };
    const country = countries[currency] || 'US';
    const clean = accountNumber.replace(/[^0-9]/g, '');
    const checkDigits = String(Math.floor(Math.random() * 90 + 10));
    return `${country}${checkDigits}${clean.substring(0, 20)}`;
}

function generateSWIFTCode(currency) {
    const codes = { 'USD': 'US', 'EUR': 'DE', 'GBP': 'GB' };
    const country = codes[currency] || 'US';
    const letters = Array.from({ length: 3 }, () => 
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join('');
    return `PHBG${country}33${letters}`;
}

function generateReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `PHB-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function generateBBCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getBBCodes(userId, step) {
    const { data, error } = await supabase
        .from('bbc_codes')
        .select('code')
        .eq('user_id', userId)
        .eq('step', step)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1);
    
    if (error || !data || data.length === 0) return null;
    return data[0].code;
}

async function useBBCode(userId, code, step) {
    const { data, error } = await supabase
        .from('bbc_codes')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('code', code)
        .eq('user_id', userId)
        .eq('step', step)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .select();
    
    if (error || !data || data.length === 0) return null;
    return data[0];
}

// ========== EMAIL FUNCTIONS ==========
async function sendEmail(to, subject, html) {
    try {
        const mailOptions = {
            from: `"Prime Heritage Bank" <${process.env.GMAIL_USER || 'primeheritageinternationalbank@gmail.com'}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: 'support@primeheritage.com'
        };
        const info = await transporter.sendMail(mailOptions);
        log('SUCCESS', `✅ Email sent to ${to}`);
        return true;
    } catch (error) {
        log('ERROR', 'Email failed:', error.message);
        return false;
    }
}

// ========== EMAIL TEMPLATES ==========
function getWelcomeEmail(user) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Prime Heritage Bank</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #0A0E1A; 
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #111827; 
            border-radius: 32px; 
            padding: 48px 40px;
            border: 1px solid rgba(198, 164, 63, 0.3);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
        }
        .header { text-align: center; margin-bottom: 32px; }
        .logo { 
            display: inline-block; 
            background: linear-gradient(135deg, #C6A43F, #9E8032); 
            padding: 12px 28px; 
            border-radius: 16px; 
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(198, 164, 63, 0.3);
        }
        .logo span { color: #0A0E1A; font-size: 22px; font-weight: 800; letter-spacing: 3px; }
        h1 { color: #C6A43F; font-size: 32px; font-weight: 800; margin-bottom: 8px; }
        .subtitle { color: #9CA3AF; font-size: 15px; font-weight: 400; }
        .divider { height: 2px; background: linear-gradient(90deg, transparent, #C6A43F, transparent); margin: 30px 0; opacity: 0.3; }
        .content { color: #E5E7EB; }
        .greeting { font-size: 20px; font-weight: 600; margin-bottom: 16px; }
        .greeting span { color: #C6A43F; }
        .welcome-message {
            background: linear-gradient(135deg, rgba(198, 164, 63, 0.08), rgba(158, 128, 50, 0.04));
            border-radius: 20px;
            padding: 24px;
            margin: 24px 0;
            border-left: 4px solid #C6A43F;
        }
        .account-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 24px 0;
        }
        .account-item {
            background: #0F1622;
            padding: 16px;
            border-radius: 16px;
            border: 1px solid #1F2937;
        }
        .account-item .label {
            color: #9CA3AF;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .account-item .value {
            color: #C6A43F;
            font-weight: 700;
            font-size: 14px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }
        .features {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin: 24px 0;
        }
        .feature {
            text-align: center;
            padding: 16px 8px;
            background: #0F1622;
            border-radius: 16px;
            border: 1px solid #1F2937;
        }
        .feature span { color: #9CA3AF; font-size: 11px; font-weight: 500; }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #C6A43F, #9E8032);
            color: #0A0E1A;
            padding: 16px 40px;
            border-radius: 16px;
            text-decoration: none;
            font-weight: 700;
            font-size: 16px;
            margin: 20px 0 10px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(198, 164, 63, 0.3);
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(198, 164, 63, 0.4);
        }
        .footer {
            color: #6B7280;
            font-size: 12px;
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #1F2937;
        }
        .footer-links { margin: 8px 0; }
        .footer-links a {
            color: #C6A43F;
            text-decoration: none;
            margin: 0 12px;
            font-weight: 500;
        }
        .badge {
            display: inline-block;
            background: rgba(198, 164, 63, 0.12);
            color: #C6A43F;
            padding: 2px 12px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        @media (max-width: 500px) {
            .container { padding: 24px 20px; }
            .account-grid { grid-template-columns: 1fr; }
            .features { grid-template-columns: 1fr 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo"><span>🏦 PHB</span></div>
            <h1>Welcome to Prime Heritage Bank</h1>
            <p class="subtitle">Your premium international banking journey begins now</p>
        </div>
        <div class="content">
            <div class="greeting">Dear <span>${user.full_name}</span>,</div>
            <div class="welcome-message">
                <p style="font-size: 16px; font-weight: 500; color: #C6A43F; margin-bottom: 8px;">🎉 Welcome to the family!</p>
                <p style="color: #E5E7EB;">Your Prime Heritage Bank account has been successfully created. We're honored to have you as a valued client. Experience world-class banking with premium benefits, global accessibility, and top-tier security.</p>
            </div>
            <div style="text-align: center; margin: 8px 0 16px;">
                <span class="badge">🌟 Premium Account</span>
                <span class="badge">🔒 Secure Banking</span>
                <span class="badge">🌍 International</span>
            </div>
            <div class="account-grid">
                <div class="account-item">
                    <div class="label">📋 Account Number</div>
                    <div class="value">${user.account_number}</div>
                </div>
                <div class="account-item">
                    <div class="label">🌍 IBAN</div>
                    <div class="value">${user.iban}</div>
                </div>
                <div class="account-item">
                    <div class="label">🏦 SWIFT Code</div>
                    <div class="value">${user.swift_code}</div>
                </div>
                <div class="account-item">
                    <div class="label">💱 Currency</div>
                    <div class="value">${user.currency}</div>
                </div>
            </div>
            <div class="features">
                <div class="feature"><span>💳 Premium Card</span></div>
                <div class="feature"><span>🌐 Global Access</span></div>
                <div class="feature"><span>🔐 Secure Banking</span></div>
            </div>
            <div style="text-align: center;">
                <a href="#" class="cta-button">🚀 Access Your Dashboard</a>
                <p style="color: #6B7280; font-size: 13px; margin-top: 12px;">Sign in to manage your account, transfer funds, and more</p>
            </div>
            <div class="divider"></div>
            <div style="background: #0F1622; border-radius: 16px; padding: 20px; margin-top: 16px;">
                <p style="color: #9CA3AF; font-size: 13px; text-align: center;">💡 <strong style="color: #C6A43F;">Quick Tips:</strong></p>
                <ul style="color: #9CA3AF; font-size: 13px; list-style: none; padding: 0; text-align: center;">
                    <li style="padding: 4px 0;">• Your account is ready for international transfers</li>
                    <li style="padding: 4px 0;">• Access your funds 24/7 through our digital platform</li>
                    <li style="padding: 4px 0;">• 24/7 premium support available</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <div class="footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Support</a>
            </div>
            <p>© 2026 Prime Heritage Bank. All rights reserved.</p>
            <p style="font-size: 11px; color: #4B5563; margin-top: 4px;">This is an automated welcome message. Please do not reply.</p>
        </div>
    </div>
</body>
</html>`;
}

// ========== API ROUTES ==========

// ========== REGISTER ==========
app.post('/api/register', async (req, res) => {
    log('AUTH', `📝 Registration: ${req.body.email}`);
    try {
        const { firstName, lastName, email, phone, password, transactionPin, currency } = req.body;
        
        // Check if user exists
        const { data: existing, error: checkError } = await supabase
            .from('users')
            .select('email')
            .eq('email', email);
        
        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPin = await bcrypt.hash(transactionPin, 10);
        const accountNumber = generateAccountNumber(currency);
        const iban = generateIBAN(currency, accountNumber);
        const swiftCode = generateSWIFTCode(currency);

        // Insert user
        const { data: user, error: insertError } = await supabase
            .from('users')
            .insert([{
                full_name: `${firstName} ${lastName}`,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                password: hashedPassword,
                transaction_pin: hashedPin,
                currency: currency || 'USD',
                account_number: accountNumber,
                iban: iban,
                swift_code: swiftCode,
                is_email_verified: true,
                is_active: true
            }])
            .select();

        if (insertError) {
            log('ERROR', 'Supabase insert error:', insertError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        const newUser = user[0];

        // Create account
        await supabase
            .from('accounts')
            .insert([{
                user_id: newUser.id,
                currency: currency || 'USD',
                account_number: accountNumber,
                iban: iban,
                balance: 0
            }]);

        // Generate token
        const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure', { expiresIn: '7d' });

        // Send welcome email
        try {
            await sendEmail(
                email,
                '👑 Welcome to Prime Heritage Bank - Your Premium Account is Ready!',
                getWelcomeEmail(newUser)
            );
        } catch (emailError) {
            log('ERROR', 'Email error:', emailError.message);
        }

        res.json({
            success: true,
            token,
            message: 'Account created successfully! Welcome to Prime Heritage Bank.',
            user: {
                id: newUser.id,
                fullName: newUser.full_name,
                email: newUser.email,
                accountNumber: newUser.account_number,
                iban: newUser.iban,
                swiftCode: newUser.swift_code,
                currency: newUser.currency,
                isAdmin: newUser.is_admin || false,
                isEmailVerified: newUser.is_email_verified
            }
        });

    } catch (error) {
        log('ERROR', 'Registration error:', error.message);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
    log('AUTH', `🔐 Login attempt: ${req.body.identifier}`);
    try {
        const { identifier, password } = req.body;
        
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${identifier},account_number.eq.${identifier},iban.eq.${identifier}`);
        
        if (!users || users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        // Update last login
        await supabase
            .from('users')
            .update({ 
                last_login: new Date().toISOString(),
                login_count: (user.login_count || 0) + 1
            })
            .eq('id', user.id);

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure', { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                accountNumber: user.account_number,
                iban: user.iban,
                swiftCode: user.swift_code,
                currency: user.currency,
                isAdmin: user.is_admin || false
            }
        });
    } catch (error) {
        log('ERROR', 'Login error:', error.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ========== GET USER PROFILE ==========
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single();
        
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get account
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        // Get cards
        const { data: cards } = await supabase
            .from('cards')
            .select('*')
            .eq('user_id', user.id);
        
        // Get transactions
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(50);
        
        // Get loans
        const { data: loans } = await supabase
            .from('loans')
            .select('*')
            .eq('user_id', user.id);
        
        // Get tickets
        const { data: tickets } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('user_id', user.id);
        
        // Get BBC status
        const { data: bbc1 } = await supabase
            .from('bbc_codes')
            .select('code')
            .eq('user_id', user.id)
            .eq('step', 1)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString());
        
        const { data: bbc2 } = await supabase
            .from('bbc_codes')
            .select('code')
            .eq('user_id', user.id)
            .eq('step', 2)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString());
        
        const { data: bbc3 } = await supabase
            .from('bbc_codes')
            .select('code')
            .eq('user_id', user.id)
            .eq('step', 3)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString());
        
        res.json({
            user: {
                id: user.id,
                fullName: user.full_name,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                phone: user.phone,
                currency: user.currency,
                accountNumber: user.account_number,
                iban: user.iban,
                swiftCode: user.swift_code,
                isAdmin: user.is_admin,
                isActive: user.is_active,
                createdAt: user.created_at
            },
            account: account || { balance: 0 },
            cards: cards || [],
            transactions: transactions || [],
            loans: loans || [],
            tickets: tickets || [],
            totalBalance: account?.balance || 0,
            bbcStatus: {
                step1: bbc1 && bbc1.length > 0,
                step2: bbc2 && bbc2.length > 0,
                step3: bbc3 && bbc3.length > 0
            }
        });
    } catch (error) {
        log('ERROR', 'Profile error:', error.message);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// ========== UPDATE PASSWORD ==========
app.post('/api/update-password', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { currentPassword, newPassword } = req.body;
        
        const { data: user, error } = await supabase
            .from('users')
            .select('password')
            .eq('id', decoded.userId)
            .single();
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', decoded.userId);
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// ========== UPDATE PIN ==========
app.post('/api/update-pin', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { currentPin, newPin } = req.body;
        
        const { data: user, error } = await supabase
            .from('users')
            .select('transaction_pin')
            .eq('id', decoded.userId)
            .single();
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const valid = await bcrypt.compare(currentPin, user.transaction_pin);
        if (!valid) return res.status(401).json({ error: 'Current PIN is incorrect' });
        
        const hashedPin = await bcrypt.hash(newPin, 10);
        
        await supabase
            .from('users')
            .update({ transaction_pin: hashedPin })
            .eq('id', decoded.userId);
        
        res.json({ success: true, message: 'PIN updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update PIN' });
    }
});

// ========== SEND MONEY - STEP 1 ==========
app.post('/api/send/step1', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { toAccountNumber, amount, description, transactionPin } = req.body;
        
        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single();
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Verify PIN
        const validPin = await bcrypt.compare(transactionPin, user.transaction_pin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
        
        // Get sender account
        const { data: senderAccount } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        if (!senderAccount || senderAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        // Find recipient
        const { data: recipient, error: recipientError } = await supabase
            .from('users')
            .select('*')
            .or(`account_number.eq.${toAccountNumber},iban.eq.${toAccountNumber}`)
            .single();
        
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        if (recipient.id === user.id) {
            return res.status(400).json({ error: 'Cannot transfer to yourself' });
        }
        
        // Get recipient account
        const { data: recipientAccount } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', recipient.id)
            .single();
        
        if (!recipientAccount) return res.status(404).json({ error: 'Recipient account not found' });
        
        // Check BBC Code 1 exists
        const { data: bbc1, error: bbcError } = await supabase
            .from('bbc_codes')
            .select('code')
            .eq('user_id', user.id)
            .eq('step', 1)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .limit(1);
        
        if (!bbc1 || bbc1.length === 0) {
            return res.status(403).json({ error: 'BBC Code 1 not available. Contact admin.' });
        }
        
        const reference = generateReference();
        
        // Create pending transaction
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert([{
                reference: reference,
                type: 'transfer',
                amount: amount,
                currency: user.currency,
                from_user_id: user.id,
                from_account_number: senderAccount.account_number,
                from_name: user.full_name,
                to_user_id: recipient.id,
                to_account_number: recipientAccount.account_number,
                to_name: recipient.full_name,
                description: description || 'Transfer',
                status: 'pending'
            }])
            .select();
        
        if (txError) {
            log('ERROR', 'Transaction creation error:', txError);
            return res.status(500).json({ error: 'Failed to create transaction' });
        }
        
        log('BBC', `🔐 Step 1: Transfer initiated - ${reference}`);
        
        res.json({ success: true, step: 1, reference });
    } catch (error) {
        log('ERROR', 'Step 1 error:', error.message);
        res.status(500).json({ error: 'Failed' });
    }
});

// ========== SEND MONEY - STEP 2 (BBC Code 1) ==========
app.post('/api/send/step2', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { reference, bbcCode } = req.body;
        
        // Get transaction
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('reference', reference)
            .eq('from_user_id', decoded.userId)
            .eq('status', 'pending')
            .single();
        
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        // Verify BBC Code 1
        const { data: bbc, error: bbcError } = await supabase
            .from('bbc_codes')
            .update({ is_used: true, used_at: new Date().toISOString() })
            .eq('code', bbcCode)
            .eq('user_id', decoded.userId)
            .eq('step', 1)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .select();
        
        if (!bbc || bbc.length === 0) {
            return res.status(403).json({ error: 'Invalid BBC Code 1' });
        }
        
        log('BBC', `🔐 Step 2: BBC Code 1 verified - ${reference}`);
        
        res.json({ success: true, step: 2, reference });
    } catch (error) {
        log('ERROR', 'Step 2 error:', error.message);
        res.status(500).json({ error: 'Failed' });
    }
});

// ========== SEND MONEY - STEP 3 (BBC Code 2) ==========
app.post('/api/send/step3', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { reference, bbcCode } = req.body;
        
        // Get transaction
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('reference', reference)
            .eq('from_user_id', decoded.userId)
            .eq('status', 'pending')
            .single();
        
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        // Verify BBC Code 2
        const { data: bbc, error: bbcError } = await supabase
            .from('bbc_codes')
            .update({ is_used: true, used_at: new Date().toISOString() })
            .eq('code', bbcCode)
            .eq('user_id', decoded.userId)
            .eq('step', 2)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .select();
        
        if (!bbc || bbc.length === 0) {
            return res.status(403).json({ error: 'Invalid BBC Code 2' });
        }
        
        log('BBC', `🔐 Step 3: BBC Code 2 verified - ${reference}`);
        
        res.json({ success: true, step: 3, reference });
    } catch (error) {
        log('ERROR', 'Step 3 error:', error.message);
        res.status(500).json({ error: 'Failed' });
    }
});

// ========== SEND MONEY - STEP 4 (BBC Code 3 & Complete) ==========
app.post('/api/send/step4', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { reference, bbcCode } = req.body;
        
        // Get transaction
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('reference', reference)
            .eq('from_user_id', decoded.userId)
            .eq('status', 'pending')
            .single();
        
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        // Verify BBC Code 3
        const { data: bbc, error: bbcError } = await supabase
            .from('bbc_codes')
            .update({ is_used: true, used_at: new Date().toISOString() })
            .eq('code', bbcCode)
            .eq('user_id', decoded.userId)
            .eq('step', 3)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .select();
        
        if (!bbc || bbc.length === 0) {
            return res.status(403).json({ error: 'Invalid BBC Code 3' });
        }
        
        // Get sender account
        const { data: senderAccount } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', decoded.userId)
            .single();
        
        // Get recipient account
        const { data: recipientAccount } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', transaction.to_user_id)
            .single();
        
        // Update balances
        await supabase
            .from('accounts')
            .update({ balance: senderAccount.balance - transaction.amount })
            .eq('id', senderAccount.id);
        
        await supabase
            .from('accounts')
            .update({ balance: recipientAccount.balance + transaction.amount })
            .eq('id', recipientAccount.id);
        
        // Complete transaction
        await supabase
            .from('transactions')
            .update({ 
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);
        
        log('BBC', `🔐 Step 4: Transfer completed - ${reference}`);
        log('BANK', `💸 Transfer: ${transaction.amount} ${transaction.currency} completed`);
        
        // Get updated balance
        const { data: updatedAccount } = await supabase
            .from('accounts')
            .select('balance')
            .eq('user_id', decoded.userId)
            .single();
        
        res.json({ 
            success: true, 
            step: 4, 
            reference, 
            amount: transaction.amount, 
            newBalance: updatedAccount?.balance || 0 
        });
    } catch (error) {
        log('ERROR', 'Step 4 error:', error.message);
        res.status(500).json({ error: 'Failed' });
    }
});

// ========== GET TRANSACTIONS ==========
app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_user_id.eq.${decoded.userId},to_user_id.eq.${decoded.userId}`)
            .order('created_at', { ascending: false })
            .limit(100);
        
        res.json(transactions || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// ========== APPLY FOR LOAN ==========
app.post('/api/loans/apply', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { amount, purpose, tenureMonths } = req.body;
        
        const interestRate = 12;
        const monthlyPayment = (amount * (1 + interestRate / 100)) / tenureMonths;
        const totalPayable = monthlyPayment * tenureMonths;
        
        const { data: loan, error } = await supabase
            .from('loans')
            .insert([{
                user_id: decoded.userId,
                amount: amount,
                purpose: purpose,
                interest_rate: interestRate,
                tenure_months: tenureMonths,
                monthly_payment: Math.round(monthlyPayment * 100) / 100,
                total_payable: Math.round(totalPayable * 100) / 100,
                status: 'pending'
            }])
            .select();
        
        if (error) {
            log('ERROR', 'Loan error:', error);
            return res.status(500).json({ error: 'Failed to apply for loan' });
        }
        
        log('BANK', `💰 Loan application: ${amount} from user ${decoded.userId}`);
        
        res.json({ success: true, loan: loan[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to apply for loan' });
    }
});

// ========== GET LOANS ==========
app.get('/api/loans', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        const { data: loans, error } = await supabase
            .from('loans')
            .select('*')
            .eq('user_id', decoded.userId)
            .order('created_at', { ascending: false });
        
        res.json(loans || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
});

// ========== CREATE SUPPORT TICKET ==========
app.post('/api/support', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        const { subject, message, priority } = req.body;
        
        const { data: user } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', decoded.userId)
            .single();
        
        const { data: ticket, error } = await supabase
            .from('support_tickets')
            .insert([{
                user_id: decoded.userId,
                name: user.full_name,
                email: user.email,
                subject: subject,
                message: message,
                priority: priority || 'medium',
                status: 'open'
            }])
            .select();
        
        if (error) {
            log('ERROR', 'Support error:', error);
            return res.status(500).json({ error: 'Failed to create ticket' });
        }
        
        log('BANK', `🎫 Support ticket created: ${ticket[0].id}`);
        
        res.json({ success: true, ticket: ticket[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// ========== GET SUPPORT TICKETS ==========
app.get('/api/support/tickets', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        const { data: tickets, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('user_id', decoded.userId)
            .order('created_at', { ascending: false });
        
        res.json(tickets || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// ========== ADMIN ROUTES ==========

// Get all users
app.get('/api/admin/users', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (!admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Get balances for each user
        const usersWithBalance = await Promise.all(users.map(async (u) => {
            const { data: account } = await supabase
                .from('accounts')
                .select('balance')
                .eq('user_id', u.id)
                .single();
            
            // Get BBC count
            const { data: bbcCodes } = await supabase
                .from('bbc_codes')
                .select('id')
                .eq('user_id', u.id);
            
            return {
                ...u,
                totalBalance: account?.balance || 0,
                bbcCount: bbcCodes?.length || 0
            };
        }));
        
        res.json(usersWithBalance);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Toggle user status
app.post('/api/admin/toggle-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (!admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { userId } = req.body;
        
        // Get current user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', userId)
            .single();
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Toggle status
        await supabase
            .from('users')
            .update({ is_active: !user.is_active })
            .eq('id', userId);
        
        log('BANK', `👤 User status toggled to ${!user.is_active ? 'active' : 'inactive'}`);
        
        res.json({ success: true, isActive: !user.is_active });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});

// Admin send money
app.post('/api/admin/send', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (!admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { toAccountNumber, amount, currency, senderName, note } = req.body;
        
        // Find recipient
        const { data: recipient, error: recipientError } = await supabase
            .from('users')
            .select('*')
            .eq('account_number', toAccountNumber)
            .single();
        
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        
        // Get recipient account
        const { data: recipientAccount, error: accError } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', recipient.id)
            .single();
        
        if (!recipientAccount) {
            // Create account if doesn't exist
            const { data: newAccount, error: createError } = await supabase
                .from('accounts')
                .insert([{
                    user_id: recipient.id,
                    currency: currency || 'USD',
                    account_number: recipient.account_number,
                    iban: recipient.iban,
                    balance: amount
                }])
                .select();
            
            if (createError) {
                log('ERROR', 'Account creation error:', createError);
                return res.status(500).json({ error: 'Failed to create account' });
            }
        } else {
            // Update existing account
            await supabase
                .from('accounts')
                .update({ balance: recipientAccount.balance + amount })
                .eq('id', recipientAccount.id);
        }
        
        // Create transaction
        const reference = generateReference();
        await supabase
            .from('transactions')
            .insert([{
                reference: reference,
                type: 'deposit',
                amount: amount,
                currency: currency || 'USD',
                to_user_id: recipient.id,
                to_account_number: recipient.account_number,
                to_name: recipient.full_name,
                from_name: senderName || 'System Administrator',
                description: note || 'Admin deposit',
                status: 'completed',
                completed_at: new Date().toISOString()
            }]);
        
        log('BANK', `💰 Admin deposit: ${amount} ${currency} to ${recipient.email}`);
        
        res.json({
            success: true,
            message: `Successfully sent ${amount} ${currency} to ${recipient.full_name}`
        });
    } catch (error) {
        log('ERROR', 'Admin send error:', error.message);
        res.status(500).json({ error: 'Failed to send money' });
    }
});

// Generate BBC codes
app.post('/api/admin/generate-bbc', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (!admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { userId, step = 1, quantity = 20, expiryDays = 30 } = req.body;
        
        const codes = [];
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        
        for (let i = 0; i < quantity; i++) {
            const code = generateBBCode();
            const { data, error } = await supabase
                .from('bbc_codes')
                .insert([{
                    code: code,
                    user_id: userId,
                    step: step,
                    is_used: false,
                    expires_at: expiryDate.toISOString()
                }])
                .select();
            
            if (data && data.length > 0) {
                codes.push(data[0].code);
            }
        }
        
        log('BBC', `🔐 Generated ${codes.length} BBC codes for user ${userId}, step ${step}`);
        
        res.json({ success: true, codes: codes, quantity: codes.length });
    } catch (error) {
        log('ERROR', 'Generate BBC error:', error.message);
        res.status(500).json({ error: 'Failed to generate BBC codes' });
    }
});

// Get BBC codes for user
app.get('/api/admin/bbc/:userId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (!admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { data: codes, error } = await supabase
            .from('bbc_codes')
            .select('*')
            .eq('user_id', req.params.userId)
            .order('created_at', { ascending: false });
        
        res.json(codes || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch BBC codes' });
    }
});

// Get single BBC code
app.get('/api/admin/bbc/check/:code', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prime_heritage_super_secret_2026_secure');
        
        // Check if admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (!admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { data: code, error } = await supabase
            .from('bbc_codes')
            .select('*')
            .eq('code', req.params.code)
            .single();
        
        if (!code) {
            return res.status(404).json({ error: 'BBC code not found' });
        }
        
        res.json(code);
    } catch (error) {
        res.status(500).json({ error: 'Failed to check BBC code' });
    }
});

// ========== CREATE ADMIN ==========
async function createAdmin() {
    try {
        // Check if admin exists
        const { data: existing, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', 'admin@primeheritage.com');
        
        if (existing && existing.length > 0) {
            log('INFO', 'Admin user already exists');
            return;
        }
        
        log('INFO', 'Creating admin user...');
        const hashedPassword = await bcrypt.hash('Prime@Admin2026', 10);
        const hashedPin = await bcrypt.hash('0000', 10);
        const accountNumber = generateAccountNumber('USD');
        const iban = generateIBAN('USD', accountNumber);
        const swiftCode = generateSWIFTCode('USD');
        
        const { data: admin, error: insertError } = await supabase
            .from('users')
            .insert([{
                full_name: 'System Administrator',
                first_name: 'System',
                last_name: 'Admin',
                email: 'admin@primeheritage.com',
                phone: '+1 (800) 555-0000',
                password: hashedPassword,
                transaction_pin: hashedPin,
                currency: 'USD',
                account_number: accountNumber,
                iban: iban,
                swift_code: swiftCode,
                is_admin: true,
                is_email_verified: true,
                is_active: true
            }])
            .select();
        
        if (insertError) {
            log('ERROR', 'Admin creation error:', insertError);
            return;
        }
        
        const newAdmin = admin[0];
        
        await supabase
            .from('accounts')
            .insert([{
                user_id: newAdmin.id,
                currency: 'USD',
                account_number: accountNumber,
                iban: iban,
                balance: 1000000
            }]);
        
        log('SUCCESS', '✅ Admin created successfully!');
        log('AUTH', '📧 Email: admin@primeheritage.com');
        log('AUTH', '🔑 Password: Prime@Admin2026');
    } catch (error) {
        log('ERROR', 'Admin creation error:', error.message);
    }
}

// ========== MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(limiter);
app.use(express.static('public'));

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        version: '5.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ========== SERVE FRONTEND ==========
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;

async function startServer() {
    // Create admin on startup
    await createAdmin();
    
    app.listen(PORT, () => {
        console.log(`\n${colors.bright}${colors.gold}`);
        console.log('╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                   ║');
        console.log('║     🚀  PRIME HERITAGE BANK IS NOW LIVE!                         ║');
        console.log('║                                                                   ║');
        console.log(`║     🌐  URL:     http://localhost:${PORT}                          ║`);
        console.log('║     📧  Email:   primeheritageinternationalbank@gmail.com        ║');
        console.log('║     🔐  BBC:     3-Step Security System ACTIVE                   ║');
        console.log('║     💳  System:  International Banking Platform 2026             ║');
        console.log('║                                                                   ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝');
        console.log(`${colors.reset}\n`);
        
        log('SUCCESS', '🎉 Server is ready for connections!');
        log('INFO', `💻 Environment: ${process.env.NODE_ENV || 'development'}`);
        log('INFO', `📊 API: /api/register, /api/login, /api/me, /api/send/step1-4`);
        log('INFO', `👑 Admin: admin@primeheritage.com / Prime@Admin2026`);
    });
}

process.on('uncaughtException', (error) => {
    log('ERROR', 'Uncaught Exception:', error.message);
    console.error(error.stack);
});

process.on('unhandledRejection', (reason) => {
    log('ERROR', 'Unhandled Rejection:', reason);
});

startServer();
