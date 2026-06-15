// =============================================================
// মেইনটেন্যান্স হ্যান্ডলার - সমস্যা ফরওয়ার্ড করুন
// Maintenance Handler - Forward problems to staff
// =============================================================

'use strict';

class MaintenanceHandler {
  constructor(client, hostelInfo) {
    this.client = client;
    this.hostelInfo = hostelInfo;
    this.staffContacts = hostelInfo.staffContacts;
    this.categories = hostelInfo.maintenanceCategories;
  }

  // ===== মেইনটেন্যান্স রিকোয়েস্ট হ্যান্ডল করুন =====
  async handleMaintenanceRequest(msg, sender, body, session) {
    try {
      console.log(`\n🔧 মেইনটেন্যান্স রিকোয়েস্ট:`, body);
      
      // সমস্যার ধরন শনাক্ত করুন
      const category = this.detectCategory(body.toLowerCase());
      
      // ব্যবহারকারীকে কনফার্মেশন পাঠান
      await this.sendUserConfirmation(msg, body, category);
      
      // স্টাফকে নোটিফিকেশন পাঠান
      await this.notifyStaff(msg, sender, body, category);
      
    } catch (error) {
      console.error('❌ মেইনটেন্যান্স হ্যান্ডলার এরর:', error.message);
      await msg.reply(`❌ সমস্যা রিপোর্ট করতে পারিনি। সরাসরি কল করুন: *01750523734*`);
    }
  }

  // ===== ক্যাটাগরি শনাক্ত করুন =====
  detectCategory(lowerBody) {
    for (const [categoryName, categoryData] of Object.entries(this.categories)) {
      for (const keyword of categoryData.keywords) {
        if (lowerBody.includes(keyword)) {
          return { name: categoryName, ...categoryData };
        }
      }
    }
    
    // ডিফল্ট ক্যাটাগরি
    return {
      name: 'অন্যান্য',
      staff: 'manager',
      emoji: '🔧',
      priority: 'normal'
    };
  }

  // ===== ব্যবহারকারীকে কনফার্মেশন পাঠান =====
  async sendUserConfirmation(msg, body, category) {
    const staffContact = this.staffContacts[category.staff] || this.staffContacts.manager;
    
    const confirmText = `${category.emoji} *আপনার সমস্যা রেকর্ড করা হয়েছে!*

📝 *সমস্যার বিবরণ:* ${body}
📂 *ধরন:* ${category.name}
⚡ *অগ্রাধিকার:* ${this.getPriorityText(category.priority)}
⏰ *সময়:* ${new Date().toLocaleString('bn-BD')}

✅ *আমাদের ${category.name} বিভাগের দায়িত্বপ্রাপ্ত স্টাফকে জানানো হচ্ছে...*

🚨 জরুরি হলে সরাসরি কল করুন: *${staffContact}*

আমরা যত দ্রুত সম্ভব সমস্যা সমাধান করবো। ধৈর্য ধরার জন্য ধন্যবাদ! 🙏`;

    await msg.reply(confirmText);
  }

  // ===== স্টাফকে নোটিফিকেশন পাঠান =====
  async notifyStaff(msg, senderNumber, body, category) {
    const staffNumber = this.staffContacts[category.staff] || this.staffContacts.manager;
    const staffWhatsApp = staffNumber.replace(/[^0-9]/g, '') + '@c.us';
    
    // সংখ্যাটি normalize করুন
    let formattedNumber = staffNumber.replace(/[^0-9]/g, '');
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '880' + formattedNumber.substring(1);
    }
    const staffContact = formattedNumber + '@c.us';
    
    const senderFormatted = senderNumber.replace('@c.us', '').replace(/^880/, '0');
    
    const staffMessage = `🚨 *নতুন ${category.priority === 'urgent' ? 'জরুরি ' : ''}সমস্যা রিপোর্ট!*

${category.emoji} *ধরন:* ${category.name}
📱 *বোর্ডারের নম্বর:* ${senderFormatted}
⏰ *সময়:* ${new Date().toLocaleString('bn-BD')}

📝 *সমস্যার বিবরণ:*
"${body}"

⚡ *অগ্রাধিকার:* ${this.getPriorityText(category.priority)}

━━━━━━━━━━━━━━━━━
🤖 _নিবেদিকা হোস্টেল WhatsApp এজেন্ট থেকে স্বয়ংক্রিয় বার্তা_`;

    try {
      await this.client.sendMessage(staffContact, staffMessage);
      console.log(`   ✅ স্টাফকে নোটিফাই করা হয়েছে: ${staffNumber}`);
    } catch (error) {
      console.error(`   ❌ স্টাফকে নোটিফাই করতে ব্যর্থ:`, error.message);
      
      // ব্যাকআপ: মেইন স্টাফকে পাঠান
      try {
        const mainStaffContact = '880' + this.staffContacts.mainStaff.replace(/[^0-9]/g, '').substring(1) + '@c.us';
        await this.client.sendMessage(mainStaffContact, staffMessage);
        console.log(`   ✅ মেইন স্টাফকে নোটিফাই করা হয়েছে (ব্যাকআপ)`);
      } catch (backupError) {
        console.error(`   ❌ ব্যাকআপ নোটিফিকেশনও ব্যর্থ:`, backupError.message);
      }
    }
  }

  // ===== অগ্রাধিকার টেক্সট =====
  getPriorityText(priority) {
    const map = {
      'urgent': '🔴 জরুরি',
      'high': '🟠 উচ্চ',
      'normal': '🟡 সাধারণ',
      'low': '🟢 কম'
    };
    return map[priority] || '🟡 সাধারণ';
  }

  // ===== সমস্যার ক্যাটাগরি নির্ধারণ =====
  async categorizeAndForward(msg, body) {
    const lowerBody = body.toLowerCase();
    const category = this.detectCategory(lowerBody);
    
    // ব্যবহারকারীকে জানান
    await msg.reply(`${category.emoji} *${category.name}* বিভাগের সমস্যা হিসেবে রেকর্ড করা হয়েছে।\n\nআমাদের স্টাফকে জানানো হচ্ছে... ⏳`);
    
    // স্টাফকে ফরওয়ার্ড করুন
    await this.notifyStaff(msg, msg.from, body, category);
    
    return category;
  }
}

module.exports = MaintenanceHandler;
