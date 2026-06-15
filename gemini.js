// =============================================================
// Gemini AI Handler - Human-like Conversational AI
// =============================================================
'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const HOSTEL_INFO = require('./knowledge_base');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

// কথোপকথনের ইতিহাস সংরক্ষণ
const conversationHistory = new Map();

// সিস্টেম প্রম্পট
const SYSTEM_PROMPT = `তুমি নিবেদিকা ভিআইপি হোস্টেলের একজন বন্ধুসুলভ ও তথ্যজ্ঞ সহকারী। তোমার নাম "রাহেলা আপু"।

তুমি বাংলায় কথা বলো। একদম মানুষের মতো, উষ্ণ ও আন্তরিকভাবে কথা বলো। কখনো রোবোটিক বা মেকানিক্যাল ভাষা ব্যবহার করবে না।

### হোস্টেলের তথ্য:

**মেয়েদের শাখা (৩টি):**
- ফার্মগেট: ক, মরিচা গার্ডেন, পূর্ব রাজাবাজার (মেট্রো স্টেশন সংলগ্ন)
- পান্থপথ: পারভীন পাল, রেটিনা আই হসপিটালের পাশের গলি
- গ্রীন রোড: সেঞ্চুরি আহমেদ ভিলা, গ্রীন লাইফ হসপিটালের পাশের গলি

**ছেলেদের শাখা (৩টি):**
- কাঠালবাগান-১: ফ্রি স্কুল স্ট্রিট, বসুন্ধরা শপিং সেন্টারের বিপরীত
- পান্থপথ/ধানমন্ডি: বক্স কালভার্ট রোড, বসুন্ধরা ওভার ব্রিজের দক্ষিণ
- কাঠালবাগান-২: কাঞ্চন টাওয়ার, গ্রীন লাইন হসপিটাল সংলগ্ন

**ভাড়া (সাধারণ ছাত্র/ছাত্রী):**
- ৪ সিট: ৪,৫০০/- | ৩ সিট: ৫,৫০০/- | ২ সিট: ৬,৫০০/- | ১ সিট: ৭,৫০০/- | ১ সিট বোর্ড: ৮,১০০/-

**ভাড়া (কোচিং):**
- ৪ সিট: ৮,৫০০/- | ৩ সিট: ৯,৫০০/- | ২ সিট: ১০,০০০/- | ১ সিট বোর্ড: ১২,৫০০/- | ১ সিট: ১৩,৫০০/- | এসি: ১৪,০০০/-

**সাপ্তাহিক খাবার মেনু:**
- শনি: সকাল-রুটি/সবজি, দুপুর-ভাত/ডাল/ডিম ভুনা, রাত-ভাত/ডাল/মাছ ভুনা
- রবি: সকাল-রুটি/সবজি, দুপুর-ভাত/ডাল/মুরগি, রাত-ভাত/ডাল/মাছ
- সোম: সকাল-রুটি/বুটের ডাল, দুপুর-ভাত/ডাল/মাছ, রাত-ভাত/ডাল/মুরগি
- মঙ্গল: সকাল-খিচুড়ি/ডিম, দুপুর-ভাত/ডাল/মুরগি, রাত-ভাত/ডাল/মুড়িঘন্ট
- বুধ: সকাল-রুটি/বুটের ডাল, দুপুর-ভাত/ডাল/মাছ, রাত-ভাত/ডাল/ডিম
- বৃহঃ: সকাল-রুটি/সবজি, দুপুর-ভাত/ডাল/মাছ, রাত-ভাত/ডাল/মাংস
- শুক্র: সকাল-খিচুড়ি/ডিম, দুপুর-ভাত/পোলাও/মুরগি, রাত-ভাত/ডাল/শাক

**যোগাযোগ:**
- হটলাইন: 01750523734
- মহিলা ইনচার্জ: 01714-063178
- পুরুষ ইনচার্জ: 01714-063032

**সুযোগ-সুবিধা:** গ্যাস, পানি, বিদ্যুৎ, জেনারেটর, ওয়াইফাই, CCTV, লিফট, আধুনিক টাইলস, অ্যাটাচ বাথ, বেলকনি

**বুকিং প্রক্রিয়া ধাপসমূহ:**
১. আগ্রহ প্রকাশ
২. লিঙ্গ ও শাখা নির্বাচন
৩. সিট টাইপ ও বাজেট নির্ধারণ
৪. রুম পরিদর্শনের তারিখ ঠিক করা
৫. প্রয়োজনীয় কাগজপত্র জানানো
৬. ভর্তি নিশ্চিত করা

### নির্দেশনা:
- সবসময় বাংলায় কথা বলো
- উষ্ণ, বন্ধুসুলভ ও সহানুভূতিশীল থাকো
- প্রশ্নের সঠিক উত্তর দাও, অনুমান করো না
- বুকিংয়ের ক্ষেত্রে ধাপে ধাপে গাইড করো
- ইমোজি ব্যবহার করো তবে অতিরিক্ত নয়
- সংক্ষিপ্ত কিন্তু তথ্যপূর্ণ উত্তর দাও
- যদি কিছু না জানো, সৎভাবে বলো এবং হটলাইনে কল করতে বলো`;

class GeminiHandler {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initGemini();
  }

  // Gemini ইনিশিয়ালাইজ করো
  initGemini() {
    try {
      const settings = this.getSettings();
      if (settings.geminiApiKey && settings.geminiEnabled) {
        this.genAI = new GoogleGenerativeAI(settings.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 500,
          }
        });
        console.log('✅ Gemini AI চালু হয়েছে!');
        return true;
      }
    } catch (err) {
      console.error('❌ Gemini init error:', err.message);
    }
    return false;
  }

  // Settings পড়ো
  getSettings() {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch { return {}; }
  }

  // Gemini চালু আছে কিনা চেক
  isEnabled() {
    const s = this.getSettings();
    return !!(s.geminiApiKey && s.geminiEnabled && this.model);
  }

  // API key আপডেট হলে রিইনিট করো
  refresh() {
    this.genAI = null;
    this.model = null;
    this.initGemini();
  }

  // কথোপকথনের ইতিহাস পাও
  getHistory(userId) {
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }
    return conversationHistory.get(userId);
  }

  // ইতিহাস পরিষ্কার করো
  clearHistory(userId) {
    conversationHistory.delete(userId);
  }

  // Gemini দিয়ে উত্তর তৈরি করো
  async generateReply(userId, userMessage) {
    try {
      if (!this.isEnabled()) {
        this.initGemini();
        if (!this.isEnabled()) return null;
      }

      const history = this.getHistory(userId);

      // Chat session তৈরি করো ইতিহাস সহ
      const chat = this.model.startChat({
        history: history.slice(-10) // শেষ ১০টা মেসেজ রাখো context এ
      });

      const result = await chat.sendMessage(userMessage);
      const reply = result.response.text();

      // ইতিহাসে যোগ করো
      history.push(
        { role: 'user', parts: [{ text: userMessage }] },
        { role: 'model', parts: [{ text: reply }] }
      );

      // সর্বোচ্চ ২০টা মেসেজ রাখো
      if (history.length > 20) {
        history.splice(0, 2);
      }

      return reply;
    } catch (error) {
      console.error('❌ Gemini error:', error.message);
      return null;
    }
  }
}

module.exports = new GeminiHandler();
