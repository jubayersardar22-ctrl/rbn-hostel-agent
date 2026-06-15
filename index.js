// =============================================================
// নিবেদিকা ভিআইপি হোস্টেল - WhatsApp এজেন্ট
// Nibedika VIP Hostel - WhatsApp Agent (Cloud-Ready Version)
// =============================================================

'use strict';

require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const fs = require('fs');

const HOSTEL_INFO = require('./knowledge_base');
const MessageHandler = require('./handlers/messageHandler');
const MaintenanceHandler = require('./handlers/maintenanceHandler');

// ===== কনফিগারেশন =====
const CONFIG = {
  agentName: "নিবেদিকা সহকারী",
  welcomeDelay: 1000,
  typingIndicator: true,
  maxRetries: 3,
  port: process.env.PORT || 3000
};

// ===== QR Code স্টোরেজ =====
let currentQR = null;
let qrImageDataUrl = null;
let isReady = false;
let startTime = new Date();

// ===== ওয়েব সার্ভার (QR Code দেখানোর জন্য) =====
const server = http.createServer(async (req, res) => {
  if (req.url === '/qr' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    if (isReady) {
      res.end(`<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>নিবেদিকা WhatsApp এজেন্ট</title>
  <style>
    body { font-family: Arial, sans-serif; background: #128C7E; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .status { font-size: 60px; margin-bottom: 20px; }
    h1 { color: #128C7E; font-size: 24px; margin-bottom: 10px; }
    p { color: #666; line-height: 1.6; }
    .badge { background: #25D366; color: white; padding: 8px 20px; border-radius: 50px; font-size: 14px; display: inline-block; margin-top: 15px; }
    .uptime { margin-top: 20px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status">✅</div>
    <h1>🏠 নিবেদিকা হোস্টেল<br>WhatsApp এজেন্ট</h1>
    <p>এজেন্ট সফলভাবে চলছে এবং মেসেজের জন্য প্রস্তুত!</p>
    <div class="badge">🟢 ONLINE & READY</div>
    <div class="uptime">চালু হয়েছে: ${startTime.toLocaleString('bn-BD')}</div>
  </div>
</body>
</html>`);
    } else if (qrImageDataUrl) {
      res.end(`<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>QR Code - নিবেদিকা এজেন্ট</title>
  <style>
    body { font-family: Arial, sans-serif; background: #128C7E; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    h1 { color: #128C7E; font-size: 22px; margin-bottom: 5px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 25px; }
    img { width: 280px; height: 280px; border: 3px solid #128C7E; border-radius: 10px; }
    .steps { text-align: left; margin-top: 20px; background: #f0faf0; border-radius: 10px; padding: 15px; }
    .steps p { margin: 5px 0; font-size: 13px; color: #333; }
    .refresh { margin-top: 15px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📱 QR Code স্ক্যান করুন</h1>
    <p class="subtitle">নিবেদিকা হোস্টেল WhatsApp এজেন্ট</p>
    <img src="${qrImageDataUrl}" alt="WhatsApp QR Code" />
    <div class="steps">
      <p>1️⃣ WhatsApp খুলুন</p>
      <p>2️⃣ ⋮ (তিনটি ডট) চাপুন</p>
      <p>3️⃣ Linked Devices এ যান</p>
      <p>4️⃣ Link a Device চাপুন</p>
      <p>5️⃣ উপরের QR Code স্ক্যান করুন</p>
    </div>
    <p class="refresh">⏱️ পেজ ৩০ সেকেন্ড পর পর রিফ্রেশ হবে</p>
  </div>
</body>
</html>`);
    } else {
      res.end(`<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="5">
  <title>শুরু হচ্ছে...</title>
  <style>
    body { font-family: Arial, sans-serif; background: #128C7E; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 400px; }
    .spinner { font-size: 50px; animation: spin 2s linear infinite; display: inline-block; }
    @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    h1 { color: #128C7E; margin-top: 20px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner">⚙️</div>
    <h1>শুরু হচ্ছে...</h1>
    <p>এজেন্ট লোড হচ্ছে। কিছুক্ষণ অপেক্ষা করুন।<br>পেজটি স্বয়ংক্রিয়ভাবে রিফ্রেশ হবে।</p>
  </div>
</body>
</html>`);
    }
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: isReady ? 'ready' : 'waiting_qr',
      uptime: Math.floor((Date.now() - startTime) / 1000) + 's',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(CONFIG.port, () => {
  console.log(`\n🌐 ওয়েব সার্ভার চালু: http://localhost:${CONFIG.port}`);
  console.log(`   QR Code দেখতে: http://localhost:${CONFIG.port}/qr`);
  console.log(`   Health check: http://localhost:${CONFIG.port}/health\n`);
});

// ===== WhatsApp Client =====
const clientConfig = {
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  }
};

const client = new Client(clientConfig);
const messageHandler = new MessageHandler(client, HOSTEL_INFO, CONFIG);
const maintenanceHandler = new MaintenanceHandler(client, HOSTEL_INFO);

// ===== QR Code জেনারেশন =====
client.on('qr', async (qr) => {
  currentQR = qr;
  
  // Terminal এ দেখাও
  console.log('\n' + '='.repeat(60));
  console.log('📱 QR CODE - WhatsApp স্ক্যান করুন:');
  console.log('='.repeat(60));
  qrcode.generate(qr, { small: true });
  console.log(`\n🌐 ওয়েব ব্রাউজারে দেখুন: http://localhost:${CONFIG.port}/qr\n`);
  
  // QR Image তৈরি করো (ওয়েব পেজের জন্য)
  try {
    qrImageDataUrl = await QRCode.toDataURL(qr, {
      width: 280,
      margin: 2,
      color: { dark: '#128C7E', light: '#FFFFFF' }
    });
    console.log('✅ QR Image তৈরি হয়েছে - ব্রাউজারে দেখুন!');
  } catch (err) {
    console.error('QR Image তৈরিতে সমস্যা:', err.message);
  }
});

// ===== অথেনটিকেশন সফল =====
client.on('authenticated', () => {
  console.log('\n✅ সফলভাবে লগইন হয়েছে! Session সংরক্ষিত হচ্ছে...');
  currentQR = null;
  qrImageDataUrl = null;
});

// ===== Ready =====
client.on('ready', () => {
  isReady = true;
  console.log('\n' + '='.repeat(60));
  console.log('🎉 নিবেদিকা হোস্টেল WhatsApp এজেন্ট চালু হয়েছে!');
  console.log('='.repeat(60));
  console.log(`\n✅ মেয়েদের শাখা: ${HOSTEL_INFO.femaleBranches.length}টি`);
  console.log(`✅ ছেলেদের শাখা: ${HOSTEL_INFO.maleBranches.length}টি`);
  console.log(`✅ সাপ্তাহিক মেনু: ৭ দিন`);
  console.log('\n💬 মেসেজের জন্য প্রস্তুত!\n');
});

// ===== মেসেজ হ্যান্ডলার =====
client.on('message', async (msg) => {
  try {
    if (msg.isGroupMsg) return;
    if (msg.from === 'status@broadcast') return;
    
    const sender = msg.from;
    const body = msg.body ? msg.body.trim() : '';
    
    if (!body) return;
    
    console.log(`\n📨 [${new Date().toLocaleTimeString()}] From: ${sender}`);
    console.log(`   Message: ${body.substring(0, 80)}`);
    
    // Typing indicator
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
    } catch (e) { /* ignore */ }
    
    await messageHandler.processMessage(msg, sender, body);
    
  } catch (error) {
    console.error('❌ Message Error:', error.message);
  }
});

// ===== কানেকশন বিচ্ছিন্ন =====
client.on('disconnected', (reason) => {
  isReady = false;
  console.log('\n⚠️ ডিসকানেক্ট:', reason);
  console.log('🔄 পুনরায় সংযোগ করছি...');
  setTimeout(() => {
    client.initialize().catch(console.error);
  }, 5000);
});

// ===== Auth Failure =====
client.on('auth_failure', (msg) => {
  console.error('\n❌ Auth failed:', msg);
  console.log('🗑️ Session ডিলিট করে পুনরায় QR স্ক্যান করুন।');
  isReady = false;
});

// ===== এরর হ্যান্ডলিং =====
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled:', error.message);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 এজেন্ট বন্ধ হচ্ছে (SIGTERM)...');
  server.close();
  await client.destroy().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n👋 এজেন্ট বন্ধ হচ্ছে...');
  server.close();
  await client.destroy().catch(() => {});
  process.exit(0);
});

// ===== এজেন্ট শুরু =====
console.log('\n' + '='.repeat(60));
console.log('🚀 নিবেদিকা VIP হোস্টেল WhatsApp এজেন্ট শুরু হচ্ছে...');
console.log('='.repeat(60));

client.initialize().catch(err => {
  console.error('❌ Initialize failed:', err.message);
  process.exit(1);
});

module.exports = { client, messageHandler, maintenanceHandler };
