// =============================================================
// মেসেজ হ্যান্ডলার - AI Brain of the Agent (Fallback & Rules)
// =============================================================

'use strict';

const MaintenanceHandler = require('./maintenanceHandler');
const MediaHandler = require('./mediaHandler');

const userSessions = new Map();

class MessageHandler {
  constructor(client, hospitalInfo, config) {
    this.client = client;
    this.hospitalInfo = hospitalInfo;
    this.config = config;
    this.maintenanceHandler = new MaintenanceHandler(client, hospitalInfo);
    this.mediaHandler = new MediaHandler(client);
  }

  async processMessage(msg, sender, body) {
    const lowerBody = body.toLowerCase();
    
    let session = userSessions.get(sender) || {
      lastActivity: Date.now(),
      messageCount: 0
    };
    
    session.messageCount++;
    session.lastActivity = Date.now();
    userSessions.set(sender, session);

    if (session.messageCount === 1) {
      await this.sendWelcomeMessage(msg, session, sender);
      return;
    }

    const intent = this.detectIntent(lowerBody, body);
    await this.handleIntent(intent, msg, sender, body, session, lowerBody);
  }

  async sendWelcomeMessage(msg, session, sender) {
    const welcomeText = `🏥 *আসসালামু আলাইকুম!* 👋

আপনাকে স্বাগতম *আরোগ্য সদন প্রাইভেট হাসপাতাল*-এ! 😊

আমি আপনার ডিজিটাল সহকারী। আমি আপনাকে নিচের বিষয়গুলোতে সাহায্য করতে পারি:

🔹 *১* - বিশেষজ্ঞ ডাক্তারদের তালিকা
🔹 *২* - হাসপাতালের সেবাসমূহ
🔹 *৩* - হাসপাতালের ঠিকানা ও ম্যাপ
🔹 *৪* - ইমার্জেন্সি ও সিরিয়াল নম্বর
🔹 *৫* - সরাসরি কথা বলুন

আপনি নম্বর লিখে রিপ্লাই দিন অথবা সরাসরি আপনার প্রশ্নটি লিখুন। 😊`;
    await this.sendReply(msg, welcomeText);
  }

  detectIntent(lowerBody, body) {
    if (/^[১২৩৪৫1-5]$/.test(body.trim())) {
      return { type: 'menu_command', value: body.trim() };
    }
    if (/ডাক্তার|doctor|dr|সিরিয়াল|serial|appointment|বুকিং/.test(lowerBody)) return { type: 'doctors' };
    if (/সেবা|service|টেস্ট|test|icu|nicu|অপারেশন|operation/.test(lowerBody)) return { type: 'services' };
    if (/ঠিকানা|লোকেশন|location|address|কোথায়|where/.test(lowerBody)) return { type: 'location' };
    if (/ইমার্জেন্সি|জরুরি|emergency|ambulance|অ্যাম্বুলেন্স|নম্বর|number/.test(lowerBody)) return { type: 'emergency' };
    
    return { type: 'unknown' };
  }

  async handleIntent(intent, msg, sender, body, session, lowerBody) {
    switch (intent.type) {
      case 'menu_command':
        await this.handleMenuCommand(intent.value, msg);
        break;
      case 'doctors':
        await this.handleDoctors(msg);
        break;
      case 'services':
        await this.handleServices(msg);
        break;
      case 'location':
        await this.handleLocation(msg);
        break;
      case 'emergency':
        await this.handleEmergency(msg);
        break;
      default:
        await this.handleGeneralChat(msg, lowerBody);
        break;
    }
  }

  async handleMenuCommand(cmd, msg) {
    const map = {
      '১': 'doctors', '1': 'doctors',
      '২': 'services', '2': 'services',
      '৩': 'location', '3': 'location',
      '৪': 'emergency', '4': 'emergency',
      '৫': 'contact', '5': 'contact'
    };
    const intentType = map[cmd];
    if (intentType === 'doctors') await this.handleDoctors(msg);
    else if (intentType === 'services') await this.handleServices(msg);
    else if (intentType === 'location') await this.handleLocation(msg);
    else if (intentType === 'emergency' || intentType === 'contact') await this.handleEmergency(msg);
  }

  async handleDoctors(msg) {
    const text = `👨‍⚕️ *আমাদের বিশেষজ্ঞ ডাক্তারগণ*\n\nআমরা সব সময় সেরা চিকিৎসকদের সেবা নিশ্চিত করি। আমাদের এখানে মেডিসিন, হৃদরোগ, গাইনি, শিশু, নিউরো, অর্থোপেডিক, ডেন্টাল, চক্ষু, সার্জারিসহ বিভিন্ন বিভাগের বিশেষজ্ঞ ডাক্তার নিয়মিত রোগী দেখেন।\n\nসিরিয়াল বুকিং এবং আজকের চেম্বার সময়সূচী জানতে সরাসরি কল করুন:\n📞 *০১৭১৩-০২৪৮০০*\n📞 *০৬৩১-৬৩৯৭৫*`;
    await this.sendReply(msg, text);
  }

  async handleServices(msg) {
    const text = `🏥 *আরোগ্য সদন হাসপাতালের সেবাসমূহ*\n\n✅ ২৪ ঘণ্টা ইমার্জেন্সি ও অ্যাম্বুলেন্স\n✅ ইনডোর, কেবিন, ওয়ার্ড, ভিআইপি কেবিন\n✅ NICU ও ICU (নবজাতক ও প্রাপ্তবয়স্কদের জন্য)\n✅ আধুনিক অপারেশন থিয়েটার\n✅ ডায়াগনস্টিক ল্যাব (প্যাথলজি)\n✅ ডিজিটাল এক্স-রে, ইকো, ইসিজি, আল্ট্রাসনোগ্রাফি\n✅ ২৪ ঘণ্টা ফার্মেসি\n\nযেকোনো প্রয়োজনে কল করুন: ০১৭১৩-০২৪৮০০`;
    await this.sendReply(msg, text);
  }

  async handleLocation(msg) {
    const text = `📍 *আমাদের ঠিকানা*\n\n*আরোগ্য সদন প্রাইভেট হাসপাতাল*\nমুজিব সড়ক, নীলটুলি (প্রেসক্লাবের বিপরীতে),\nফরিদপুর সদর, ফরিদপুর-৭৮০০\n\nGoogle Maps: https://maps.app.goo.gl/arogyasadan (উদাহরণ)`;
    await this.sendReply(msg, text);
  }

  async handleEmergency(msg) {
    const text = `🚑 *ইমার্জেন্সি ও হেল্পলাইন*\n\nযেকোনো জরুরি চিকিৎসা, অ্যাম্বুলেন্স বা সিরিয়ালের জন্য ২৪ ঘণ্টা কল করতে পারেন:\n\n📞 ০১৭১৩-০২৪৮০০\n📞 ০৬৩১-৬৩৯৭৫\n📞 ০৬৩১-৬৪২১৬\n\nজরুরি বিভাগ সবসময় প্রস্তুত!`;
    await this.sendReply(msg, text);
  }

  async handleGeneralChat(msg, lowerBody) {
    const greetings = ['hi', 'hello', 'হ্যালো', 'হাই', 'সালাম', 'assalamu', 'hey'];
    const isGreeting = greetings.some(g => lowerBody.includes(g));

    if (isGreeting) {
      await this.sendReply(msg, `আসসালামু আলাইকুম! 😊 আরোগ্য সদন হাসপাতালে স্বাগতম। আপনাকে কীভাবে সাহায্য করতে পারি?`);
    } else {
      await this.sendReply(msg, `দুঃখিত, আমি ঠিক বুঝতে পারিনি। আপনি কি আমাদের বিশেষজ্ঞ ডাক্তারদের তালিকা বা সিরিয়াল নম্বর জানতে চান? তাহলে '1' লিখে রিপ্লাই দিন অথবা সরাসরি ০১৭১৩-০২৪৮০০ নম্বরে কল করুন।`);
    }
  }

  async sendReply(msg, text) {
    try {
      await msg.reply(text);
    } catch (e) {
      console.error('Reply failed:', e.message);
    }
  }
}

module.exports = MessageHandler;
