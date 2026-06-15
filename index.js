// =============================================================
// নিবেদিকা ভিআইপি হোস্টেল - WhatsApp AI এজেন্ট v3.0
// Express + WebSocket + Gemini AI + Dashboard
// =============================================================
'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const HOSTEL_INFO = require('./knowledge_base');
const MessageHandler = require('./handlers/messageHandler');
const MaintenanceHandler = require('./handlers/maintenanceHandler');
const gemini = require('./gemini');

// ===== Settings ম্যানেজার =====
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
function getSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return { agentEnabled: true, geminiEnabled: false, geminiApiKey: '', dashboardPassword: 'nibedika2024' }; }
}
function saveSettings(data) {
  const current = getSettings();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...current, ...data }, null, 2));
}

// ===== State =====
let currentQR = null;
let qrImageDataUrl = null;
let isReady = false;
let isConnected = false;
let startTime = new Date();
let messageCount = 0;
let client = null;
let wss = null;
const PORT = process.env.PORT || 3000;

// ===== Express App =====
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== HTTP Server =====
const server = http.createServer(app);

// ===== WebSocket (real-time updates) =====
wss = new WebSocket.Server({ server });
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

// ===== Dashboard Routes =====

// Main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Status API
app.get('/api/status', (req, res) => {
  const settings = getSettings();
  res.json({
    isReady,
    isConnected,
    agentEnabled: settings.agentEnabled,
    geminiEnabled: settings.geminiEnabled,
    hasGeminiKey: !!(settings.geminiApiKey),
    messageCount,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    startTime: startTime.toISOString(),
    hasQR: !!qrImageDataUrl
  });
});

// QR Code API
app.get('/api/qr', (req, res) => {
  if (qrImageDataUrl) {
    res.json({ qr: qrImageDataUrl });
  } else if (isReady) {
    res.json({ status: 'connected' });
  } else {
    res.json({ status: 'loading' });
  }
});

// Settings GET
app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({
    geminiEnabled: s.geminiEnabled,
    hasGeminiKey: !!(s.geminiApiKey),
    geminiKeyPreview: s.geminiApiKey ? '****' + s.geminiApiKey.slice(-6) : '',
    agentEnabled: s.agentEnabled,
    maintenanceContacts: s.maintenanceContacts || {}
  });
});

// Settings UPDATE
app.post('/api/settings', (req, res) => {
  try {
    const { geminiApiKey, geminiEnabled, agentEnabled } = req.body;
    const update = {};
    if (geminiApiKey !== undefined) update.geminiApiKey = geminiApiKey;
    if (geminiEnabled !== undefined) update.geminiEnabled = geminiEnabled;
    if (agentEnabled !== undefined) update.agentEnabled = agentEnabled;
    saveSettings(update);

    // Gemini রিফ্রেশ করো
    if (geminiApiKey !== undefined || geminiEnabled !== undefined) {
      gemini.refresh();
    }

    broadcast({ type: 'settings_updated', ...getSettings() });
    res.json({ success: true, message: 'সেটিংস সংরক্ষিত হয়েছে!' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Agent Toggle
app.post('/api/agent/toggle', (req, res) => {
  const s = getSettings();
  const newState = !s.agentEnabled;
  saveSettings({ agentEnabled: newState });
  broadcast({ type: 'agent_toggled', agentEnabled: newState });
  res.json({ success: true, agentEnabled: newState });
});

// WhatsApp Disconnect
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    isReady = false;
    isConnected = false;
    currentQR = null;
    qrImageDataUrl = null;

    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    }

    // Auth folder মুছে ফেলো
    const authPath = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }

    broadcast({ type: 'whatsapp_disconnected' });
    res.json({ success: true, message: 'WhatsApp সংযোগ বিচ্ছিন্ন হয়েছে। নতুন QR আসছে...' });

    // পুনরায় চালু করো
    setTimeout(() => initWhatsApp(), 3000);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// WhatsApp Reconnect
app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    if (client) {
      await client.destroy().catch(() => {});
    }
    broadcast({ type: 'whatsapp_reconnecting' });
    res.json({ success: true, message: 'পুনরায় সংযোগ করা হচ্ছে...' });
    setTimeout(() => initWhatsApp(), 2000);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Gemini API Key DELETE
app.delete('/api/settings/gemini-key', (req, res) => {
  saveSettings({ geminiApiKey: '', geminiEnabled: false });
  gemini.refresh();
  broadcast({ type: 'settings_updated' });
  res.json({ success: true, message: 'Gemini API Key মুছে দেওয়া হয়েছে।' });
});

// ===== WhatsApp Client =====
function initWhatsApp() {
  console.log('\n🔄 WhatsApp Client চালু হচ্ছে...');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
        '--no-first-run', '--no-zygote', '--single-process',
        '--disable-gpu', '--disable-extensions'
      ]
    }
  });

  const messageHandler = new MessageHandler(client, HOSTEL_INFO, { agentName: 'নিবেদিকা সহকারী' });
  const maintenanceHandler = new MaintenanceHandler(client, HOSTEL_INFO);

  // QR Code
  client.on('qr', async (qr) => {
    currentQR = qr;
    isReady = false;
    isConnected = false;
    console.log('\n📱 QR Code তৈরি হয়েছে');
    qrcode.generate(qr, { small: true });

    try {
      qrImageDataUrl = await QRCode.toDataURL(qr, {
        width: 300, margin: 2,
        color: { dark: '#128C7E', light: '#FFFFFF' }
      });
      broadcast({ type: 'qr_updated', qr: qrImageDataUrl });
    } catch (e) {
      console.error('QR image error:', e.message);
    }
  });

  // Authenticated
  client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated!');
    currentQR = null;
    qrImageDataUrl = null;
    isConnected = true;
    broadcast({ type: 'authenticated' });
  });

  // Ready
  client.on('ready', () => {
    isReady = true;
    isConnected = true;
    currentQR = null;
    qrImageDataUrl = null;
    console.log('\n🎉 WhatsApp এজেন্ট Ready!');
    broadcast({ type: 'ready', message: 'WhatsApp এজেন্ট চালু হয়েছে!' });
  });

  // Message
  client.on('message', async (msg) => {
    try {
      if (msg.isGroupMsg || msg.from === 'status@broadcast') return;
      const settings = getSettings();
      if (!settings.agentEnabled) return;

      const body = msg.body ? msg.body.trim() : '';
      if (!body) return;

      messageCount++;
      broadcast({ type: 'message_received', count: messageCount, from: msg.from });
      console.log(`\n📨 [${new Date().toLocaleTimeString()}] ${msg.from}: ${body.substring(0, 60)}`);

      // Typing indicator
      try {
        const chat = await msg.getChat();
        await chat.sendStateTyping();
      } catch {}

      // Gemini দিয়ে উত্তর দাও (যদি চালু থাকে)
      const geminiSettings = getSettings();
      if (geminiSettings.geminiEnabled && geminiSettings.geminiApiKey) {
        const aiReply = await gemini.generateReply(msg.from, body);
        if (aiReply) {
          await msg.reply(aiReply);
          return;
        }
      }

      // Fallback to knowledge base handler
      await messageHandler.processMessage(msg, msg.from, body);

    } catch (error) {
      console.error('❌ Message error:', error.message);
    }
  });

  // Disconnected
  client.on('disconnected', (reason) => {
    isReady = false;
    isConnected = false;
    console.log('⚠️ Disconnected:', reason);
    broadcast({ type: 'disconnected', reason });
    setTimeout(() => initWhatsApp(), 8000);
  });

  client.on('auth_failure', () => {
    isReady = false;
    isConnected = false;
    broadcast({ type: 'auth_failure' });
  });

  client.initialize().catch(err => {
    console.error('❌ Init error:', err.message);
    setTimeout(() => initWhatsApp(), 10000);
  });
}

// ===== Server Start =====
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 নিবেদিকা VIP হোস্টেল WhatsApp এজেন্ট v3.0');
  console.log('='.repeat(60));
  console.log(`\n🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`📊 Status API: http://localhost:${PORT}/api/status\n`);
  initWhatsApp();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (client) await client.destroy().catch(() => {});
  server.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  if (client) await client.destroy().catch(() => {});
  server.close();
  process.exit(0);
});
process.on('unhandledRejection', err => console.error('Unhandled:', err.message));
