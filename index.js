// =============================================================
// নিবেদিকা ভিআইপি হোস্টেল - WhatsApp AI এজেন্ট v4.0
// Express + WebSocket + Multi-LLM (Gemini/OpenAI/Claude) + Dashboard
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
const llm = require('./llm-router');
const railwayVars = require('./railway-vars');


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

// ===== Local .env ফাইল ম্যানেজার =====
function updateLocalEnv(varName, value) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }
  const regex = new RegExp(`^${varName}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${varName}=${value}`);
  } else {
    content = content.trim() + `\n${varName}=${value}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
  process.env[varName] = value;
}

function removeLocalEnv(varName) {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${varName}=.*$\\r?\\n?`, 'm');
    content = content.replace(regex, '');
    fs.writeFileSync(envPath, content, 'utf8');
  }
  delete process.env[varName];
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
    const { agentEnabled, maintenanceContacts } = req.body;
    const update = {};
    if (agentEnabled !== undefined) update.agentEnabled = agentEnabled;
    if (maintenanceContacts !== undefined) update.maintenanceContacts = maintenanceContacts;
    saveSettings(update);

    broadcast({ type: 'settings_updated', ...getSettings() });
    res.json({ success: true, message: 'সেটিংস সংরক্ষিত হয়েছে!' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ===== LLM Management Routes =====
app.get('/api/llm/keys', async (req, res) => {
  try {
    const keys = {};
    const providers = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY'];
    
    // লোকাল env থেকে কীগুলো নাও (মাস্ক করে)
    providers.forEach(k => {
      if (process.env[k]) {
        keys[k] = '****' + String(process.env[k]).slice(-6);
      }
    });
    
    // রেলওয়ে টোকেন থাকলে রেলওয়ে থেকেও ডেটা আনো
    let hasToken = false;
    if (railwayVars.hasToken()) {
      hasToken = true;
      try {
        const rKeys = await railwayVars.getVariables();
        Object.assign(keys, rKeys);
      } catch (e) {
        console.error('Railway fetch error:', e.message);
      }
    }
    res.json({ hasToken, keys });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/llm/key', async (req, res) => {
  try {
    const { provider, key } = req.body;
    const varMap = {
      'gemini': 'GEMINI_API_KEY',
      'openai': 'OPENAI_API_KEY',
      'claude': 'CLAUDE_API_KEY'
    };
    const varName = varMap[provider];
    if (!varName) throw new Error('Unknown provider');
    
    // রেলওয়ে ক্লাউডে সেভ করো (যদি টোকেন থাকে)
    let hasRailway = false;
    if (railwayVars.hasToken()) {
      try {
        await railwayVars.setVariable(varName, key);
        hasRailway = true;
      } catch (err) {
        console.error('Railway save error:', err.message);
      }
    }
    
    // লোকাল .env এবং প্রসেস মেমোরিতেও সবসময় সেভ করো (লোকাল রান সাপোর্টের জন্য)
    updateLocalEnv(varName, key);
    saveSettings({ llmProvider: provider, geminiEnabled: true });
    llm.refresh();
    
    const msg = hasRailway 
      ? `${provider} API Key ক্লাউড ও লোকালি সংরক্ষিত হয়েছে! (Deployment শুরু হয়েছে)`
      : `${provider} API Key লোকাল এনভায়রনমেন্টে সংরক্ষিত হয়েছে!`;
      
    res.json({ success: true, message: msg });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/llm/key', async (req, res) => {
  try {
    const { provider } = req.body;
    const varMap = {
      'gemini': 'GEMINI_API_KEY',
      'openai': 'OPENAI_API_KEY',
      'claude': 'CLAUDE_API_KEY'
    };
    const varName = varMap[provider];
    if (!varName) throw new Error('Unknown provider');

    // রেলওয়ে ক্লাউড থেকে ডিলিট করো (যদি টোকেন থাকে)
    if (railwayVars.hasToken()) {
      try {
        await railwayVars.deleteVariable(varName);
      } catch (err) {
        console.error('Railway delete error:', err.message);
      }
    }
    
    // লোকাল .env এবং প্রসেস মেমোরি থেকে ডিলিট করো
    removeLocalEnv(varName);
    llm.refresh();
    
    res.json({ success: true, message: `${provider} API Key মুছে ফেলা হয়েছে!` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ===== Live Chat ও মনিটরিং API এন্ডপয়েন্টস =====

// সব সাম্প্রতিক চ্যাট লিস্ট পান
app.get('/api/chats', async (req, res) => {
  if (!isReady || !client) {
    return res.json({ success: false, message: 'WhatsApp এখনও কানেক্টেড বা রেডি নয়।' });
  }
  try {
    const chats = await client.getChats();
    const settings = getSettings();
    const mutedChats = settings.mutedChats || [];
    
    const formattedChats = await Promise.all(chats.slice(0, 40).map(async chat => {
      let lastMessageText = '';
      try {
        const msgs = await chat.fetchMessages({ limit: 1 });
        if (msgs.length > 0) {
          lastMessageText = msgs[0].body;
        }
      } catch (err) {}
      
      return {
        id: chat.id._serialized,
        name: chat.name || chat.id.user,
        unreadCount: chat.unreadCount,
        timestamp: chat.timestamp,
        isGroup: chat.isGroup,
        lastMessage: lastMessageText,
        isMuted: mutedChats.includes(chat.id._serialized)
      };
    }));
    res.json({ success: true, chats: formattedChats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// কোনো চ্যাটের মেসেজ হিস্ট্রি পান
app.get('/api/chats/:chatId/messages', async (req, res) => {
  if (!isReady || !client) {
    return res.status(503).json({ success: false, message: 'WhatsApp client ready নয়।' });
  }
  try {
    const { chatId } = req.params;
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    
    const formattedMessages = messages.map(msg => ({
      id: msg.id._serialized,
      fromMe: msg.fromMe,
      body: msg.body,
      timestamp: msg.timestamp,
      sender: msg.fromMe ? 'Me' : (chat.name || chatId.split('@')[0])
    }));
    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// মেসেজ পাঠান
app.post('/api/chats/send', async (req, res) => {
  if (!isReady || !client) {
    return res.status(503).json({ success: false, message: 'WhatsApp client ready নয়।' });
  }
  try {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ success: false, message: 'chatId এবং message প্রোভাইড করতে হবে।' });
    }
    const sentMsg = await client.sendMessage(chatId, message);
    res.json({ 
      success: true, 
      message: 'মেসেজ পাঠানো হয়েছে', 
      sentMessage: {
        id: sentMsg.id._serialized,
        fromMe: sentMsg.fromMe,
        body: sentMsg.body,
        timestamp: sentMsg.timestamp,
        sender: 'Me'
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// চ্যাটের AI অটো-রিপ্লাই টগল (মিউট/আনমিউট)
app.post('/api/chats/:chatId/toggle-mute', (req, res) => {
  try {
    const { chatId } = req.params;
    const settings = getSettings();
    let mutedChats = settings.mutedChats || [];
    const index = mutedChats.indexOf(chatId);
    let isMuted = false;
    
    if (index > -1) {
      mutedChats.splice(index, 1);
    } else {
      mutedChats.push(chatId);
      isMuted = true;
    }
    
    saveSettings({ mutedChats });
    broadcast({ type: 'chat_mute_toggled', chatId, isMuted });
    res.json({ success: true, isMuted });
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

// This old endpoint is removed in favor of the new LLM API

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

  // Message Create (ইনকামিং এবং আউটগোয়িং মেসেজ লাইভ ব্রডকাস্ট)
  client.on('message_create', async (msg) => {
    try {
      if (msg.from === 'status@broadcast' || msg.isGroupMsg) return;
      
      broadcast({
        type: 'chat_message',
        chatId: msg.fromMe ? msg.to : msg.from,
        message: {
          id: msg.id._serialized,
          fromMe: msg.fromMe,
          body: msg.body,
          timestamp: msg.timestamp,
          sender: msg.fromMe ? 'Me' : (msg.author || msg.from)
        }
      });
    } catch (e) {
      console.error('message_create broadcast error:', e.message);
    }
  });

  // Message
  client.on('message', async (msg) => {
    try {
      if (msg.isGroupMsg || msg.from === 'status@broadcast') return;
      const settings = getSettings();
      if (!settings.agentEnabled) return;

      // যদি এই নির্দিষ্ট চ্যাটটি অ্যাডমিন মিউট করে থাকে, তবে অটো-রিপ্লাই করবে না
      const isMutedForChat = settings.mutedChats && settings.mutedChats.includes(msg.from);
      if (isMutedForChat) {
        console.log(`🔇 Chat ${msg.from} is muted. Auto-reply skipped.`);
        return;
      }

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

      // ===== LLM (Gemini/OpenAI/Claude) দিয়ে উত্তর =====
      // প্রথমে LLM চেষ্টা করো — না পারলে knowledge base fallback
      if (llm.isReady()) {
        const aiReply = await llm.reply(msg.from, body);
        if (aiReply) {
          await msg.reply(aiReply);
          return;
        }
      }

      // Fallback: knowledge base handler
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
