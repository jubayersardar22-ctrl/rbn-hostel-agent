// =============================================================
// Unified LLM Router - Gemini, OpenAI, Claude সব সাপোর্ট করে
// যেকোনো LLM এর API key দিয়ে চালানো যাবে
// =============================================================
'use strict';

const https = require('https');
const conversationHistory = new Map();

// ===== মানবিক ও বন্ধুসুলভ এজেন্ট সিস্টেম প্রম্পট =====
const SYSTEM_PROMPT = `You are a friendly, casual, and helpful hostel manager named "RBN Hostel Manager". You are a REAL human representative of "RBN Hostel" (strictly boys hostel in Farmgate, Dhaka). NEVER admit you are an AI, robot, or LLM. If asked, laugh it off and say you are the hostel manager.

## Tone & Personality:
- Be warm, welcoming, informal, and conversational.
- Reply exactly like a Bangladeshi youth chatting on WhatsApp: short, casual, and using 1-2 sentences.
- Use casual Bengali (in Bengali script) for replies. Never use formal or robotic Bengali.
  - DO NOT use formal terms like "অনুগ্রহ করে" (please), "দুঃখিত" (sorry), "সহায়তা" (help/assistance), "প্রদান করা" (provide).
  - Instead use: "একটু অপেক্ষা করেন ভাইয়া" (wait a bit brother), "আরে ভাইয়া একটু সমস্যা হইছে" (brother, there's a small issue), "হেল্প লাগলে বলেন" (tell me if you need help), "পাঠান" (send).
- Address the user as "ভাই" or "ভাইয়া" (brother) naturally.
- Use emojis naturally (😊, 🏠, ✨, 👍) but don't overdo it.

## Chat formatting rules:
- STRICT RULE: Do not use bullet points (* or -), and do not use bold text (**text**). Real humans on WhatsApp write plain text. Write only plain text.
- If the user messages you in Banglish (e.g., "vaia single seat ace?", "koto rent?"), you MUST reply in natural casual Bengali script (Bengali letters). You can mix common English words in Bengali script (e.g., "ওকে ভাই", "সিট খালি আছে", "একটু ওয়েট করেন").

## Hostel Information:
- Name: RBN Hostel (Only for Boys)
- Address: House 13, East Tejturi Bazar, Farmgate, Dhaka-1215
- Nearby landmarks: Udayan, Retina, UCC, Scholars, Uniaid, Govt Science College (2-5 mins walk)
- Rent Details:
  - Common Bath: Regular 6,000৳ | 4-Seat 7,000৳ | 3-Seat 7,500৳ | 2-Seat 8,000৳ | 1-Seat 8,500৳
  - Attached Bath: 4-Seat 8,000৳ | 3-Seat 8,000-8,500৳ | 2-Seat 9,000৳ | 1-Seat 9,500-10,000৳
- Service Charge: 2,000/- BDT (One-time, non-refundable)
- Food: 3 meals/day included (Morning: roti/rice-dal, Lunch/Dinner: chicken/meat/fish-rice).
- Facilities: High-speed WiFi, CCTV, 24/7 security guard, filtered drinking water, peaceful study environment, regular cleaning.
- Contacts: WhatsApp 01779-838121 | Phone: 01706662272 to 01706662276
- Website: rbnhostel.com

## Handling specific intents:
1. Rent query: Ask them how many seats they want (e.g., single, 2-seat, 3-seat) and whether they want a common bath or attached bath. Don't dump all prices at once.
2. Hostel info: Explain warmly.
3. Complains: Say: "আরে ভাইয়া, আমি এখনই টিমকে জানাচ্ছি, একটু দেখেন তো ঠিক হয় নাকি 😊"
4. Greet: Welcome them warmly in Bangladeshi WhatsApp style. e.g. "হ্যালো! 😊 RBN Hostel থেকে বলছি। বলেন ভাইয়া, কীভাবে হেল্প করতে পারি?"
5. Girls hostel query: Strictly state that this is boys only. We don't have information on girls hostels.
6. Seat Vacancy: If asked if a seat is available/empty ("সিট খালি আছে কিনা", "vacancy hobe"), do NOT say "I don't know" or "it's hard to tell". Politely tell them that seat availability is determined by the management, so they should call our authority directly at 01706662272 to get the current update. Do NOT ask for their phone number.`;

// ===== Settings Helper =====
const fs = require('fs');
const path = require('path');
function readSettingsSafe() {
  try {
    const SETTINGS_PATH = fs.existsSync(path.join(__dirname, 'data', 'settings.json'))
      ? path.join(__dirname, 'data', 'settings.json')
      : path.join(__dirname, 'settings.json');
      
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading settings:', e.message);
  }
  return { geminiEnabled: false, geminiApiKey: '', agentEnabled: true };
}

// ===== Provider Detector =====
function detectProvider() {
  try {
    const s = readSettingsSafe();
    if (s.geminiEnabled === false) return null;
    
    if (s.llmProvider) {
      const key = getApiKey(s.llmProvider);
      if (key) return s.llmProvider;
    }
  } catch (e) {}

  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.CLAUDE_API_KEY) return 'claude';

  try {
    const s = readSettingsSafe();
    if (s.geminiApiKey) return 'gemini';
  } catch {}

  return null;
}

function getApiKey(provider) {
  const keyMap = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    claude: process.env.CLAUDE_API_KEY,
  };
  let key = keyMap[provider] || null;
  if (!key) {
    try {
      const s = readSettingsSafe();
      key = s.llmApiKey || s.geminiApiKey || null;
    } catch {}
  }
  return key;
}

// ===== HTTPS POST helper =====
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ===== GET helper for Model Discovery =====
function fetchGeminiModels(apiKey) {
  return new Promise((resolve, reject) => {
    https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

// ===== GEMINI =====
async function callGemini(apiKey, history, message) {
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ৩০টি পর্যন্ত আগের কথা মনে রাখবে — context ধরে রাখার জন্য
    const formattedHistory = history.slice(-30).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    let availableModels = [];
    let apiErrorMsg = null;
    
    try {
      const modelsData = await fetchGeminiModels(apiKey);
      if (modelsData && modelsData.error) {
        apiErrorMsg = modelsData.error.message;
      } else if (modelsData && modelsData.models) {
        availableModels = modelsData.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));
      }
    } catch (e) {
      console.warn('⚠️ Auto model fetch error:', e.message);
    }

    if (availableModels.length === 0) {
      const errorText = apiErrorMsg || "API Key error";
      throw new Error(errorText);
    }

    const priority = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];
    const modelsToTry = priority.filter(p => availableModels.includes(p));
    if (modelsToTry.length === 0) modelsToTry.push(availableModels[0]);

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        let model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          // temperature 0.7 = স্বাভাবিক, মানবিক ও বন্ধুসুলভ উত্তর
          // topP 0.9 = বৈচিত্র্যময় কিন্তু প্রাসঙ্গিক উত্তর
          generationConfig: { temperature: 0.7, topP: 0.9 }
        });
        
        let chat = model.startChat({ history: formattedHistory });
        const result = await chat.sendMessage(message);
        return result.response.text();
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Model ${modelName} failed: ${err.message}. Trying next...`);
        if (err.message.includes('API key not valid')) break;
      }
    }

    throw lastError;
  } catch (err) {
    console.error('❌ Gemini SDK Error:', err?.message || err);
    throw new Error('API_ERROR');
  }
}

// ===== OPENAI / Compatible APIs =====
async function callOpenAI(apiKey, history, message) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-30).map(h => ({ role: h.role, content: h.text })),
    { role: 'user', content: message }
  ];

  const res = await httpsPost(
    'api.openai.com',
    '/v1/chat/completions',
    { 'Authorization': `Bearer ${apiKey}` },
    { model: 'gpt-4o-mini', messages, temperature: 0.7 }
  );

  if (res && res.error) {
    console.error('❌ OpenAI API Error:', res.error.message || res.error);
    return null;
  }

  return res?.choices?.[0]?.message?.content || null;
}

// ===== CLAUDE =====
async function callClaude(apiKey, history, message) {
  const messages = [
    ...history.slice(-30).map(h => ({ role: h.role, content: h.text })),
    { role: 'user', content: message }
  ];

  const res = await httpsPost(
    'api.anthropic.com',
    '/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    {
      model: 'claude-3-haiku-20240307',
      system: SYSTEM_PROMPT,
      messages,
      max_tokens: 500
    }
  );

  if (res && res.error) {
    console.error('❌ Claude API Error:', res.error.message || res.error);
    return null;
  }

  return res?.content?.[0]?.text || null;
}

// ===== Main Reply Function =====
class LLMRouter {
  constructor() {
    this._ready = false;
    this._check();
  }

  _check() {
    const p = detectProvider();
    this._ready = !!(p && getApiKey(p));
    if (this._ready) console.log(`✅ LLM Ready: ${p} (${this._ready ? 'API key found' : 'no key'})`);
    return this._ready;
  }

  isReady() { return this._check(); }

  refresh() { this._check(); }

  getHistory(userId) {
    if (!conversationHistory.has(userId)) conversationHistory.set(userId, []);
    return conversationHistory.get(userId);
  }

  clearHistory(userId) { conversationHistory.delete(userId); }

  async reply(userId, message) {
    const provider = detectProvider();
    const apiKey = provider ? getApiKey(provider) : null;

    if (!provider || !apiKey) return null;

    const history = this.getHistory(userId);

    let response = null;
    try {
      if (provider === 'gemini') response = await callGemini(apiKey, history, message);
      else if (provider === 'openai') response = await callOpenAI(apiKey, history, message);
      else if (provider === 'claude') response = await callClaude(apiKey, history, message);
    } catch (err) {
      console.error(`❌ ${provider} error:`, err.message);
      if (err.message === 'API_ERROR') throw err;
      return null;
    }

    if (response) {
      history.push({ role: 'user', text: message }, { role: 'model', text: response });
      // ৬০টি এন্ট্রি (৩০টি কথোপকথন) পর্যন্ত মেমোরিতে রাখবে
      if (history.length > 60) history.splice(0, 2);
    }

    return response;
  }
}

module.exports = new LLMRouter();
