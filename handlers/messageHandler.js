// =============================================================
// মেসেজ হ্যান্ডলার - AI Brain of the Agent
// =============================================================

'use strict';

const MaintenanceHandler = require('./maintenanceHandler');
const MediaHandler = require('./mediaHandler');

// ব্যবহারকারীর সেশন ডেটা সংরক্ষণ
const userSessions = new Map();

class MessageHandler {
  constructor(client, hostelInfo, config) {
    this.client = client;
    this.hostelInfo = hostelInfo;
    this.config = config;
    this.maintenanceHandler = new MaintenanceHandler(client, hostelInfo);
    this.mediaHandler = new MediaHandler(client);
  }

  // ===== মূল মেসেজ প্রসেসর =====
  async processMessage(msg, sender, body) {
    const lowerBody = body.toLowerCase();
    
    // সেশন পান বা তৈরি করুন
    let session = userSessions.get(sender) || {
      name: null,
      gender: null, // 'male' বা 'female'
      branch: null,
      isResident: false,
      maintenanceMode: false,
      lastActivity: Date.now(),
      messageCount: 0
    };
    
    session.messageCount++;
    session.lastActivity = Date.now();
    userSessions.set(sender, session);

    // ===== প্রথম সাক্ষাৎ =====
    if (session.messageCount === 1) {
      await this.sendWelcomeMessage(msg, session, sender);
      return;
    }

    // ===== মেইনটেন্যান্স মোড চেক =====
    if (session.maintenanceMode) {
      await this.maintenanceHandler.handleMaintenanceRequest(msg, sender, body, session);
      session.maintenanceMode = false;
      userSessions.set(sender, session);
      return;
    }

    // ===== ইন্টেন্ট ডিটেকশন =====
    const intent = this.detectIntent(lowerBody, body);
    await this.handleIntent(intent, msg, sender, body, session, lowerBody);
  }

  // ===== স্বাগত বার্তা =====
  async sendWelcomeMessage(msg, session, sender) {
    const welcomeText = `🏠 *আসসালামু আলাইকুম!* 👋

আপনাকে স্বাগতম *নিবেদিকা ভিআইপি হোস্টেল*-এ! 😊

আমি আপনার হোস্টেল সহকারী। আপনাকে সাহায্য করতে পারি:

🔹 *১* - ভাড়া ও রুমের তথ্য
🔹 *২* - খাবার মেনু দেখুন
🔹 *৩* - শাখার ঠিকানা
🔹 *৪* - সুযোগ-সুবিধা
🔹 *৫* - নতুন বুকিং
🔹 *৬* - রুমের ছবি দেখুন
🔹 *৭* - সমস্যা রিপোর্ট করুন
🔹 *৮* - নিয়মাবলী জানুন
🔹 *৯* - সরাসরি কথা বলুন

অথবা সরাসরি আপনার প্রশ্ন লিখুন! 😊

_আপনি কি নতুন বোর্ডার নাকি বর্তমান বোর্ডার?_`;

    await this.sendReply(msg, welcomeText);
  }

  // ===== ইন্টেন্ট ডিটেকশন =====
  detectIntent(lowerBody, body) {
    // সংখ্যা কমান্ড
    if (/^[১১2৩3৪4৫5৬6৭7৮8৯9]$/.test(body.trim()) || /^[1-9]$/.test(body.trim())) {
      return { type: 'menu_command', value: body.trim() };
    }

    // ভাড়া সংক্রান্ত
    if (/ভাড়া|মূল্য|price|cost|কত|টাকা|রেট|charge/.test(lowerBody)) {
      return { type: 'pricing' };
    }

    // রুম সংক্রান্ত  
    if (/রুম|কক্ষ|সিট|room|seat|বেড|bed/.test(lowerBody)) {
      return { type: 'room_info' };
    }

    // খাবার সংক্রান্ত
    if (/খাবার|মেনু|রান্না|ভাত|তরকারি|food|menu|breakfast|lunch|dinner|সকাল|দুপুর|রাত/.test(lowerBody)) {
      return { type: 'food_menu' };
    }

    // সাপ্তাহিক মেনু
    if (/সাপ্তাহিক|সপ্তাহ|weekly|week/.test(lowerBody)) {
      return { type: 'weekly_menu' };
    }

    // শাখা/লোকেশন
    if (/শাখা|ব্রাঞ্চ|লোকেশন|ঠিকানা|address|branch|location|কোথায়|কোন/.test(lowerBody)) {
      return { type: 'branches' };
    }

    // সুবিধা
    if (/সুবিধা|সার্ভিস|facility|facilities|wifi|ওয়াইফাই|বিদ্যুৎ|পানি/.test(lowerBody)) {
      return { type: 'facilities' };
    }

    // ছবি
    if (/ছবি|photo|picture|image|দেখা|দেখতে/.test(lowerBody)) {
      return { type: 'photos' };
    }

    // বুকিং
    if (/বুকিং|ভর্তি|booking|admission|সিট নিতে|ভর্তি হতে/.test(lowerBody)) {
      return { type: 'booking' };
    }

    // সমস্যা/মেইনটেন্যান্স
    if (/সমস্যা|নষ্ট|problem|issue|ঠিক|repair|মেরামত|অভিযোগ/.test(lowerBody)) {
      return { type: 'complaint' };
    }

    // নিয়মাবলী
    if (/নিয়ম|নিয়মাবলী|rule|rules/.test(lowerBody)) {
      return { type: 'rules' };
    }

    // যোগাযোগ
    if (/যোগাযোগ|contact|ফোন|phone|নম্বর|number/.test(lowerBody)) {
      return { type: 'contact' };
    }

    // ফার্মগেট শাখা
    if (/ফার্মগেট|farmgate/.test(lowerBody)) {
      return { type: 'branch_detail', branch: 'farmgate' };
    }

    // পান্থপথ শাখা
    if (/পান্থপথ|panthapath/.test(lowerBody)) {
      return { type: 'branch_detail', branch: 'panthapath' };
    }

    // গ্রীন রোড শাখা
    if (/গ্রীন রোড|green road/.test(lowerBody)) {
      return { type: 'branch_detail', branch: 'greenroad' };
    }

    // কাঠালবাগান শাখা
    if (/কাঠালবাগান|kathalbagan/.test(lowerBody)) {
      return { type: 'branch_detail', branch: 'kathalbagan' };
    }

    // মেয়েদের হোস্টেল
    if (/মেয়ে|মহিলা|female|ladies|girl/.test(lowerBody)) {
      return { type: 'female_hostel' };
    }

    // ছেলেদের হোস্টেল
    if (/ছেলে|পুরুষ|male|boy|men/.test(lowerBody)) {
      return { type: 'male_hostel' };
    }

    // সাহায্য
    if (/help|সাহায্য|হেল্প|কি কি|কী কী|menu|মেনু সংখ্যা/.test(lowerBody)) {
      return { type: 'help' };
    }

    // ধন্যবাদ
    if (/ধন্যবাদ|thanks|thank you|শুকরিয়া/.test(lowerBody)) {
      return { type: 'thanks' };
    }

    // সালাম
    if (/সালাম|আলাইকুম|হ্যালো|hello|hi|হাই/.test(lowerBody)) {
      return { type: 'greeting' };
    }

    return { type: 'unknown' };
  }

  // ===== ইন্টেন্ট হ্যান্ডলার =====
  async handleIntent(intent, msg, sender, body, session, lowerBody) {
    switch (intent.type) {
      case 'menu_command':
        await this.handleMenuCommand(msg, intent.value, session);
        break;
      case 'pricing':
        await this.sendPricingInfo(msg, session);
        break;
      case 'room_info':
        await this.sendRoomInfo(msg);
        break;
      case 'food_menu':
        await this.sendTodayMenu(msg);
        break;
      case 'weekly_menu':
        await this.sendWeeklyMenu(msg);
        break;
      case 'branches':
        await this.sendBranchInfo(msg, session);
        break;
      case 'facilities':
        await this.sendFacilities(msg);
        break;
      case 'photos':
        await this.mediaHandler.sendRoomPhotos(msg);
        break;
      case 'booking':
        await this.sendBookingInfo(msg, session);
        break;
      case 'complaint':
        await this.handleComplaint(msg, sender, body, session);
        break;
      case 'rules':
        await this.sendRules(msg);
        break;
      case 'contact':
        await this.sendContactInfo(msg);
        break;
      case 'branch_detail':
        await this.sendBranchDetail(msg, intent.branch, session);
        break;
      case 'female_hostel':
        await this.sendFemaleBranchInfo(msg);
        break;
      case 'male_hostel':
        await this.sendMaleBranchInfo(msg);
        break;
      case 'help':
        await this.sendHelpMenu(msg);
        break;
      case 'thanks':
        await this.sendThanksReply(msg);
        break;
      case 'greeting':
        await this.sendGreeting(msg, session);
        break;
      default:
        await this.sendSmartReply(msg, body, lowerBody, session);
    }
  }

  // ===== মেনু কমান্ড =====
  async handleMenuCommand(msg, command, session) {
    const num = command.replace(/[১২৩৪৫৬৭৮৯]/, (c) => {
      const map = { '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
      return map[c] || c;
    });
    
    switch (num) {
      case '1': await this.sendPricingInfo(msg, session); break;
      case '2': await this.sendWeeklyMenu(msg); break;
      case '3': await this.sendBranchInfo(msg, session); break;
      case '4': await this.sendFacilities(msg); break;
      case '5': await this.sendBookingInfo(msg, session); break;
      case '6': await this.mediaHandler.sendRoomPhotos(msg); break;
      case '7': await this.handleComplaint(msg, msg.from, msg.body, session); break;
      case '8': await this.sendRules(msg); break;
      case '9': await this.sendContactInfo(msg); break;
      default: await this.sendHelpMenu(msg);
    }
  }

  // ===== ভাড়ার তথ্য =====
  async sendPricingInfo(msg, session) {
    const { pricing } = this.hostelInfo;
    
    const text = `💰 *ভাড়া তালিকা - নিবেদিকা ভিআইপি হোস্টেল*

📌 *সাধারণ ছাত্র/ছাত্রী (মাসিক):*
━━━━━━━━━━━━━━━━━
| সিট টাইপ | ভাড়া |
|---|---|
| ৪ সিট রুম | ৪,৫০০/- |
| ৩ সিট রুম | ৫,৫০০/- |
| ২ সিট রুম | ৬,৫০০/- |
| ১ সিট রুম | ৭,৫০০/- |
| ১ সিট (বোর্ড নন-এসি) | ৮,১০০/- |

📌 *কোচিং ছাত্র/ছাত্রী (মাসিক):*
━━━━━━━━━━━━━━━━━
| সিট টাইপ | ভাড়া |
|---|---|
| ৪ সিট | ৮,৫০০/- |
| ৩ সিট | ৯,৫০০/- |
| ২ সিট | ১০,০০০/- |
| ১ সিট (বোর্ড) | ১২,৫০০/- |
| ১ সিট | ১৩,৫০০/- |
| ১ সিট (এসি) | ১৪,০০০/- |

📌 *স্বল্প সময়ের প্যাকেজ:*
━━━━━━━━━━━━━━━━━
🗓️ ১ দিন → ৩৫০-৪০০ টাকা
🗓️ ৩ দিন → ১,০৫০-১,২০০ টাকা  
🗓️ ৭ দিন → ২,১০০-২,৮০০ টাকা
🗓️ ১৪ দিন → ৪,০০০-৫,০০০ টাকা

💡 *সার্ভিস চার্জ (এককালীন):* ২,০০০-৩,০০০/-
🛏️ *বিছানা সহ মালপত্র:* ৩,০০০/-

✅ *ভাড়ার মধ্যে অন্তর্ভুক্ত:*
গ্যাস, পানি, বিদ্যুৎ, জেনারেটর ও ওয়াইফাই
_(এসি রুমে বিদ্যুৎ বিল আলাদা)_

📞 বুকিংয়ের জন্য: *01750523734*`;

    await this.sendReply(msg, text);
    await new Promise(r => setTimeout(r, 1000));
    await this.sendReply(msg, `💬 রুমের ছবি দেখতে *ছবি* লিখুন অথবা *৬* চাপুন!\n\nআর কোনো প্রশ্ন থাকলে জিজ্ঞেস করুন 😊`);
  }

  // ===== রুমের তথ্য =====
  async sendRoomInfo(msg) {
    const text = `🏠 *রুম ও সিট বিবরণ*

নিবেদিকা হোস্টেলে ৪ ধরনের সিট রয়েছে। সম্পূর্ণ টাইলস এবং আধুনিক ফ্ল্যাট লিফট সুবিধাসহ।

1️⃣ *১ সিটের রুম (বোর্ড পার্টিশন)*
• ১টি খাট, টেবিল ও চেয়ার
• একা একা থাকবেন
• ভাড়া: ৬,১০০ - ৮,১০০/-

2️⃣ *২ সিটের রুম*
• ২টি খাট, টেবিল ও চেয়ার
• ২ জন থাকবেন
• ভাড়া: ৬,৫০০/- প্রতিজন

3️⃣ *৩ সিটের রুম (ওয়ালের রুম)*
• পাকা দেয়াল
• অ্যাটাচ বাথ/বেলকনি (যেকোনো একটি)
• ৩টি খাট, টেবিল ও চেয়ার
• ভাড়া: ৫,৫০০/- প্রতিজন

4️⃣ *৪ সিটের রুম*
• অ্যাটাচ বাথ + বেলকনি উভয়ই
• ৪টি খাট, টেবিল ও চেয়ার
• ভাড়া: ৪,৫০০/- প্রতিজন

🏢 *AC / নন-AC উভয় অপশন আছে*

রুমের ছবি দেখতে *ছবি* লিখুন! 📸`;

    await this.sendReply(msg, text);
  }

  // ===== আজকের খাবার মেনু =====
  async sendTodayMenu(msg) {
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const today = days[new Date().getDay()];
    const menu = this.hostelInfo.weeklyMenu.schedule[today];
    
    let text = `🍽️ *আজকের খাবার মেনু (${today})*\n\n`;
    
    if (menu) {
      text += `☀️ *সকাল:* ${menu.সকাল}\n`;
      text += `🌤️ *দুপুর:* ${menu.দুপুর}\n`;
      text += `🌙 *রাত:* ${menu.রাত}\n`;
    }
    
    text += `\n📝 *বিশেষ সুবিধা:*
• মাসে ২ বার পোলাও-মাংস 🍖
• প্রতিদিন মাছ, মাংস বা ডিম 🐟
• মৌসুমি শাক-সবজি সহ পুষ্টিকর খাবার 🥗

সম্পূর্ণ সাপ্তাহিক মেনু দেখতে *সাপ্তাহিক* লিখুন! 😋`;

    await this.sendReply(msg, text);
  }

  // ===== সাপ্তাহিক মেনু =====
  async sendWeeklyMenu(msg) {
    const { weeklyMenu } = this.hostelInfo;
    
    let text = `🍽️ *সাপ্তাহিক খাবার মেনু - নিবেদিকা হোস্টেল*\n\n`;
    
    Object.entries(weeklyMenu.schedule).forEach(([day, meals]) => {
      text += `📅 *${day}*\n`;
      text += `   ☀️ সকাল: ${meals.সকাল}\n`;
      text += `   🌤️ দুপুর: ${meals.দুপুর}\n`;
      text += `   🌙 রাত: ${meals.রাত}\n\n`;
    });
    
    text += `━━━━━━━━━━━━━━━━━\n`;
    text += `✨ *বিশেষ সুবিধা:*\n`;
    weeklyMenu.specialFeatures.forEach(f => {
      text += `• ${f}\n`;
    });
    
    text += `\n📌 _${weeklyMenu.note}_`;

    await this.sendReply(msg, text);
  }

  // ===== শাখার তথ্য =====
  async sendBranchInfo(msg, session) {
    const text = `📍 *নিবেদিকা হোস্টেল - শাখাসমূহ*

🏠 *মেয়েদের শাখা (৩টি):*
━━━━━━━━━━━━━━
1️⃣ ফার্মগেট ব্রাঞ্চ
   📌 মরিচা গার্ডেন, পূর্ব রাজাবাজার
   🏢 ফার্মগেট মেট্রো স্টেশন সংলগ্ন
   
2️⃣ পান্থপথ ব্রাঞ্চ
   📌 পারভীন পাল, পান্থপথ
   🏢 রেটিনা আই হসপিটালের পাশের গলি
   
3️⃣ গ্রীন রোড ব্রাঞ্চ
   📌 সেঞ্চুরি আহমেদ ভিলা
   🏢 গ্রীন লাইফ হসপিটালের পাশের গলি

📞 মহিলা ইনচার্জ: *01714-063178*

━━━━━━━━━━━━━━
🏠 *ছেলেদের শাখা (৩টি):*
━━━━━━━━━━━━━━
1️⃣ কাঠালবাগান ব্রাঞ্চ-১
   📌 কাঠালবাগান ফ্রি স্কুল স্ট্রিট
   🏢 বসুন্ধরা শপিং সেন্টারের বিপরীত পাশে
   
2️⃣ পান্থপথ/ধানমন্ডি ব্রাঞ্চ
   📌 ফ্রি স্কুল স্ট্রিট, বক্স কালভার্ট রোড
   🏢 বসুন্ধরা শপিং সেন্টার ওভার ব্রিজের দক্ষিণ পাশে
   
3️⃣ কাঠালবাগান ব্রাঞ্চ-২
   📌 কাঞ্চন টাওয়ার, কাঠালবাগান কাঁচা বাজার
   🏢 গ্রীন লাইন হসপিটাল সংলগ্ন

📞 পুরুষ ইনচার্জ: *01714-063032*

━━━━━━━━━━━━━━
📞 হটলাইন: *01750523734*
⏰ অফিস সময়: সকাল ৯:০০ - রাত ৯:০০`;

    await this.sendReply(msg, text);
  }

  // ===== সুযোগ-সুবিধা =====
  async sendFacilities(msg) {
    const { facilities } = this.hostelInfo;
    
    let text = `✨ *নিবেদিকা হোস্টেলের সুযোগ-সুবিধা*\n\n`;
    
    const emojis = ['🍽️', '📶', '🔒', '💧', '⚡', '🏠', '❄️', '🛗', '📚', '🧹', '🏃', '🫧', '🌿', '🔧', '🎉', '🛎️', '🚻', '🛤️'];
    
    facilities.forEach((facility, i) => {
      text += `${emojis[i] || '✅'} ${facility}\n`;
    });
    
    text += `\n💡 আরো জানতে *বুকিং* লিখুন বা কল করুন: *01750523734*`;

    await this.sendReply(msg, text);
  }

  // ===== বুকিং তথ্য =====
  async sendBookingInfo(msg, session) {
    const text = `📋 *বুকিং ও ভর্তি প্রক্রিয়া*

🔹 *প্রয়োজনীয় কাগজপত্র:*
• জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধনের ফটোকপি
• ২ কপি পাসপোর্ট সাইজ ছবি
• অভিভাবকের সম্মতিপত্র
• ভর্তি ফরম (অফিস থেকে ১০০/- টাকায় সংগ্রহ)

🔹 *ভর্তির সময় করণীয়:*
• পিতা-মাতা বা স্থানীয় অভিভাবকের মধ্যে কমপক্ষে ১ জনকে সাথে আনতে হবে
• ১ মাসের ভাড়ার সমপরিমাণ সিকিউরিটি মানি জমা দিতে হবে

🔹 *সিট/রুম দেখতে চাইলে:*
আগে থেকে যোগাযোগ করুন এবং পরিদর্শনের সময় নির্ধারণ করুন

📞 *এখনই যোগাযোগ করুন:*
• হটলাইন: *01750523734*
• মহিলা ইনচার্জ: *01714-063178*
• পুরুষ ইনচার্জ: *01714-063032*
• অফিস সময়: সকাল ৯টা - রাত ৯টা`;

    await this.sendReply(msg, text);
    
    await new Promise(r => setTimeout(r, 1000));
    
    const whatsappLink = `https://wa.me/8801750523734?text=${encodeURIComponent('আসসালামু আলাইকুম, আমি নিবেদিকা হোস্টেলে বুকিং দিতে চাই। বিস্তারিত জানাবেন প্লিজ?')}`;
    await this.sendReply(msg, `🟢 *সরাসরি WhatsApp-এ বুকিং করুন:*\n${whatsappLink}`);
  }

  // ===== অভিযোগ হ্যান্ডলিং =====
  async handleComplaint(msg, sender, body, session) {
    session.maintenanceMode = true;
    userSessions.set(sender, session);
    
    await this.sendReply(msg, `🛠️ *সমস্যা রিপোর্ট করুন*

আপনার সমস্যাটি বিস্তারিত লিখুন। আমরা দ্রুত সমাধান করবো! 

উদাহরণ:
• "আমার রুমের ফ্যান কাজ করছে না"
• "বাথরুমের পানির পাইপ লিক করছে"
• "খাবারের মানে সমস্যা আছে"
• "ওয়াইফাই কাজ করছে না"

দয়া করে আপনার *রুম নম্বর* এবং *শাখার নাম* সহ সমস্যাটি বর্ণনা করুন।`);
  }

  // ===== নিয়মাবলী =====
  async sendRules(msg) {
    const { rules } = this.hostelInfo;
    
    const text = `📜 *হোস্টেলের নিয়মাবলী*

🔹 *ভর্তির নিয়ম:*
${rules.admission.details.map(d => `• ${d}`).join('\n')}

🔹 *সিট ত্যাগের নিয়ম:*
${rules.seatLeave.details.map(d => `• ${d}`).join('\n')}

🔹 *যা আনা যাবে:*
${rules.allowedItems.items}

🔹 *যা আনা যাবে না:*
${rules.prohibitedItems.items}

🔹 *গেট বন্ধের সময়:*
রাত ১০:৩০ মিনিট (বিশেষ প্রয়োজনে অভিভাবকের অনুমতি সাপেক্ষে)

🔹 *গেস্ট পলিসি:*
• মহিলা হোস্টেল: মা বা বোন গেস্ট থাকতে পারবেন
• পুরুষ হোস্টেল: বাবা বা ভাই গেস্ট থাকতে পারবেন
• গেস্ট চার্জ: ৩০০ টাকা/দিন`;

    await this.sendReply(msg, text);
  }

  // ===== যোগাযোগ =====
  async sendContactInfo(msg) {
    const text = `📞 *যোগাযোগ করুন - নিবেদিকা ভিআইপি হোস্টেল*

🏠 *হটলাইন / বুকিং:*
📱 01750523734

👩 *মহিলা হোস্টেল ইনচার্জ:*
📱 01714-063178

👨 *পুরুষ হোস্টেল ইনচার্জ:*
📱 01714-063032

⏰ *অফিস সময়:*
সকাল ৯:০০ - রাত ৯:০০
(পরিদর্শনের জন্য আগে যোগাযোগ করুন)

🌐 *ওয়েবসাইট:*
https://nibedikahostel.netlify.app

📍 *এলাকাসমূহ:*
ফার্মগেট | পান্থপথ | গ্রীন রোড
রাজাবাজার | কাঠালবাগান | ধানমন্ডি`;

    await this.sendReply(msg, text);
  }

  // ===== মেয়েদের হোস্টেল তথ্য =====
  async sendFemaleBranchInfo(msg) {
    const text = `👩 *মহিলা হোস্টেল - নিবেদিকা ভিআইপি হোস্টেল*

ফার্মগেট, পান্থপথ ও গ্রীন রোডে আমাদের ৩টি মহিলা শাখা রয়েছে।

━━━━━━━━━━━━━━━━━
1️⃣ *ফার্মগেট ব্রাঞ্চ*
📌 ক, মরিচা গার্ডেন, পূর্ব রাজাবাজার
🏢 ফার্মগেট মেট্রো স্টেশন সংলগ্ন

2️⃣ *পান্থপথ ব্রাঞ্চ*
📌 পারভীন পাল, পান্থপথ
🏢 রেটিনা আই হসপিটালের পাশের গলি

3️⃣ *গ্রীন রোড ব্রাঞ্চ*
📌 সেঞ্চুরি আহমেদ ভিলা
🏢 গ্রীন লাইফ হসপিটালের পাশের গলি

━━━━━━━━━━━━━━━━━
📞 ইনচার্জ: *01714-063178*

✨ *বিশেষ সুবিধা:*
• সম্পূর্ণ মহিলাদের জন্য আলাদা বিল্ডিং
• ২৪/৭ নিরাপত্তা ব্যবস্থা
• মা বা বোন গেস্ট হিসেবে থাকতে পারবেন

ভাড়া তথ্যের জন্য *ভাড়া* লিখুন 💰`;

    await this.sendReply(msg, text);
  }

  // ===== ছেলেদের হোস্টেল তথ্য =====
  async sendMaleBranchInfo(msg) {
    const text = `👨 *পুরুষ হোস্টেল - নিবেদিকা ভিআইপি হোস্টেল*

কাঠালবাগান ও পান্থপথ/ধানমন্ডিতে আমাদের ৩টি পুরুষ শাখা রয়েছে।

━━━━━━━━━━━━━━━━━
1️⃣ *কাঠালবাগান ব্রাঞ্চ-১*
📌 কাঠালবাগান ফ্রি স্কুল স্ট্রিট
🏢 বসুন্ধরা শপিং সেন্টারের বিপরীত পাশে

2️⃣ *পান্থপথ/ধানমন্ডি ব্রাঞ্চ*
📌 ফ্রি স্কুল স্ট্রিট, বক্স কালভার্ট রোড
🏢 বসুন্ধরা শপিং সেন্টার ওভার ব্রিজের দক্ষিণ পাশে

3️⃣ *কাঠালবাগান ব্রাঞ্চ-২*
📌 কাঞ্চন টাওয়ার, কাঠালবাগান কাঁচা বাজার
🏢 গ্রীন লাইন হসপিটাল সংলগ্ন

━━━━━━━━━━━━━━━━━
📞 ইনচার্জ: *01714-063032*

✨ *বিশেষ সুবিধা:*
• সম্পূর্ণ পুরুষদের জন্য আলাদা বিল্ডিং
• ২৪/৭ নিরাপত্তা ব্যবস্থা
• বাবা বা ভাই গেস্ট হিসেবে থাকতে পারবেন

ভাড়া তথ্যের জন্য *ভাড়া* লিখুন 💰`;

    await this.sendReply(msg, text);
  }

  // ===== শাখার বিস্তারিত =====
  async sendBranchDetail(msg, branchKey, session) {
    const branchMap = {
      'farmgate': {
        name: 'ফার্মগেট ব্রাঞ্চ',
        address: 'ক, মরিচা গার্ডেন, পূর্ব রাজাবাজার',
        landmark: 'ফার্মগেট মেট্রো স্টেশন সংলগ্ন',
        type: 'মহিলা',
        contact: '01714-063178'
      },
      'panthapath': {
        name: 'পান্থপথ ব্রাঞ্চ',
        address: 'পারভীন পাল, পান্থপথ',
        landmark: 'রেটিনা আই হসপিটালের পাশের গলি',
        type: 'মহিলা / পুরুষ (উভয়)',
        contact: '01714-063178 / 01714-063032'
      },
      'greenroad': {
        name: 'গ্রীন রোড ব্রাঞ্চ',
        address: 'সেঞ্চুরি আহমেদ ভিলা',
        landmark: 'গ্রীন লাইফ হসপিটালের পাশের গলি',
        type: 'মহিলা',
        contact: '01714-063178'
      },
      'kathalbagan': {
        name: 'কাঠালবাগান ব্রাঞ্চ',
        address: 'কাঠালবাগান ফ্রি স্কুল স্ট্রিট (ব্রাঞ্চ-১) ও কাঞ্চন টাওয়ার (ব্রাঞ্চ-২)',
        landmark: 'বসুন্ধরা শপিং সেন্টার সংলগ্ন',
        type: 'পুরুষ',
        contact: '01714-063032'
      }
    };
    
    const branch = branchMap[branchKey];
    if (!branch) {
      await this.sendBranchInfo(msg, session);
      return;
    }
    
    const text = `📍 *${branch.name}*

🏠 টাইপ: ${branch.type} হোস্টেল
📌 ঠিকানা: ${branch.address}
🏢 ল্যান্ডমার্ক: ${branch.landmark}
📞 যোগাযোগ: ${branch.contact}

💰 ভাড়া তথ্যের জন্য *ভাড়া* লিখুন
📸 ছবি দেখতে *ছবি* লিখুন`;

    await this.sendReply(msg, text);
  }

  // ===== হেল্প মেনু =====
  async sendHelpMenu(msg) {
    const text = `🤖 *নিবেদিকা হোস্টেল সহকারী - সাহায্য মেনু*

নিচের যেকোনো অপশন বেছে নিন:

🔹 *১* বা *ভাড়া* - ভাড়া তালিকা দেখুন
🔹 *২* বা *মেনু* - সাপ্তাহিক খাবার মেনু
🔹 *৩* বা *শাখা* - শাখার ঠিকানা
🔹 *৪* বা *সুবিধা* - সুযোগ-সুবিধা তালিকা
🔹 *৫* বা *বুকিং* - ভর্তি প্রক্রিয়া
🔹 *৬* বা *ছবি* - রুমের ছবি
🔹 *৭* বা *সমস্যা* - সমস্যা রিপোর্ট
🔹 *৮* বা *নিয়ম* - হোস্টেলের নিয়মাবলী
🔹 *৯* বা *যোগাযোগ* - ফোন নম্বর

💡 অথবা সরাসরি বাংলায় আপনার প্রশ্ন লিখুন!`;

    await this.sendReply(msg, text);
  }

  // ===== সালাম রিপ্লাই =====
  async sendGreeting(msg, session) {
    const greetings = [
      `ওয়ালাইকুম আস সালাম! 😊 নিবেদিকা হোস্টেলে আপনাকে স্বাগতম! কিভাবে সাহায্য করতে পারি?`,
      `হ্যালো! 👋 নিবেদিকা ভিআইপি হোস্টেলের সহকারী বলছি। কি জানতে চান?`,
      `আস সালামু আলাইকুম! 🏠 নিবেদিকা হোস্টেল থেকে স্বাগতম। আপনার প্রশ্ন লিখুন!`
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    await this.sendReply(msg, randomGreeting + `\n\n_সাহায্যের জন্য *সাহায্য* লিখুন_ 🙂`);
  }

  // ===== ধন্যবাদ রিপ্লাই =====
  async sendThanksReply(msg) {
    const replies = [
      `আপনাকে ধন্যবাদ! 😊 আর কোনো প্রশ্ন থাকলে যেকোনো সময় জিজ্ঞেস করুন।`,
      `আপনার স্বাগত! 🌟 নিবেদিকা হোস্টেলে আসুন, সেরা অভিজ্ঞতা পাবেন।`,
      `শুকরিয়া! 🙏 আর কোনো সাহায্য লাগলে বলুন।`
    ];
    
    const reply = replies[Math.floor(Math.random() * replies.length)];
    await this.sendReply(msg, reply);
  }

  // ===== স্মার্ট রিপ্লাই (Unknown intent) =====
  async sendSmartReply(msg, body, lowerBody, session) {
    // কিছু স্মার্ট কীওয়ার্ড চেক
    if (lowerBody.includes('কি') || lowerBody.includes('কী') || lowerBody.includes('কোথায়') || lowerBody.includes('কখন') || lowerBody.includes('কত') || lowerBody.includes('কিভাবে')) {
      await this.sendReply(msg, `😊 আপনার প্রশ্নটি বুঝতে পারিনি। নিচের অপশনগুলো থেকে বেছে নিন:

*১* - ভাড়া তালিকা
*২* - খাবার মেনু  
*৩* - শাখার ঠিকানা
*৫* - বুকিং তথ্য
*৭* - সমস্যা রিপোর্ট

অথবা আরো স্পষ্ট করে আপনার প্রশ্ন লিখুন! 📝`);
      return;
    }
    
    await this.sendReply(msg, `🤔 ক্ষমা করবেন, আমি বুঝতে পারিনি।

*সাহায্য* লিখুন সব অপশন দেখতে।

অথবা সরাসরি কল করুন: *01750523734* 📞`);
  }

  // ===== রিপ্লাই সেন্ড করুন =====
  async sendReply(msg, text) {
    try {
      await msg.reply(text);
      console.log(`   ✅ রিপ্লাই পাঠানো হয়েছে`);
    } catch (error) {
      console.error(`   ❌ রিপ্লাই পাঠাতে ব্যর্থ:`, error.message);
      // ব্যাকআপ পদ্ধতি
      try {
        await this.client.sendMessage(msg.from, text);
      } catch (e) {
        console.error('   ❌ ব্যাকআপ পদ্ধতিও ব্যর্থ:', e.message);
      }
    }
  }
}

module.exports = MessageHandler;
