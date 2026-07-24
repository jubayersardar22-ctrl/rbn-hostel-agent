// =============================================================
// মিডিয়া হ্যান্ডলার - ছবি পাঠানো
// Media Handler - Send room photos
// =============================================================

'use strict';

const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Google Drive থেকে পাওয়া ছবির লিংক (ওয়েবসাইট থেকে সংগ্রহ করা)
const ROOM_PHOTOS = [
  {
    url: 'https://drive.google.com/thumbnail?id=1OaLYB_-01C4Da_8XydaW7dwJlY6_nhum&sz=w800',
    caption: '🏠 নিবেদিকা ভিআইপি হোস্টেল - হোস্টেলের দৃশ্য'
  }
];

// স্থানীয় ছবি ফোল্ডার
const IMAGES_DIR = path.join(__dirname, '..', 'images');

class MediaHandler {
  constructor(client) {
    this.client = client;
  }

  // ===== রুমের ছবি পাঠান =====
  async sendRoomPhotos(msg) {
    try {
      // প্রথমে টেক্সট মেসেজ পাঠান
      await msg.reply(`📸 *নিবেদিকা হোস্টেলের ছবি পাঠাচ্ছি...*

🏠 আমাদের হোস্টেলের বৈশিষ্ট্য:
• আধুনিক টাইলসকৃত রুম
• পরিষ্কার ও সাজানো পরিবেশ
• আরামদায়ক আসবাবপত্র

একটু অপেক্ষা করুন... ⏳`);

      // স্থানীয় ছবি চেক করুন
      const localImages = this.getLocalImages();
      
      if (localImages.length > 0) {
        // স্থানীয় ছবি পাঠান
        await this.sendLocalImages(msg, localImages);
      } else {
        // ছবি না থাকলে বিকল্প তথ্য দিন
        await this.sendPhotoAlternative(msg);
      }
      
    } catch (error) {
      console.error('❌ ছবি পাঠাতে এরর:', error.message);
      await msg.reply(`😔 ছবি পাঠাতে সমস্যা হয়েছে।

আমাদের ওয়েবসাইটে ছবি দেখুন:
🌐 https://nibedikahostel.netlify.app

অথবা সরাসরি হোস্টেল পরিদর্শনে আসুন।
📞 আগে কল করুন: *01750523734*`);
    }
  }

  // ===== স্থানীয় ছবি খুঁজুন =====
  getLocalImages() {
    try {
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        return [];
      }
      
      const files = fs.readdirSync(IMAGES_DIR)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .map(f => path.join(IMAGES_DIR, f));
      
      return files.slice(0, 5); // সর্বোচ্চ ৫টি ছবি
    } catch (error) {
      console.error('❌ ছবি ফোল্ডার পড়তে এরর:', error.message);
      return [];
    }
  }

  // ===== স্থানীয় ছবি পাঠান =====
  async sendLocalImages(msg, imagePaths) {
    const captions = [
      '🏠 নিবেদিকা হোস্টেল - রুমের দৃশ্য',
      '🛏️ আরামদায়ক বেড এবং স্টাডি টেবিল',
      '🚿 পরিষ্কার বাথরুম সুবিধা',
      '🍽️ ডাইনিং এরিয়া',
      '📚 পড়ার জায়গা'
    ];
    
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const media = MessageMedia.fromFilePath(imagePaths[i]);
        await this.client.sendMessage(msg.from, media, {
          caption: captions[i] || `📸 নিবেদিকা হোস্টেল - ছবি ${i + 1}`
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`❌ ছবি ${i + 1} পাঠাতে এরর:`, e.message);
      }
    }
    
    await msg.reply(`✅ *সব ছবি পাঠানো হয়েছে!*

🌐 আরো ছবি দেখতে: https://nibedikahostel.netlify.app
📞 হোস্টেল পরিদর্শনে: *01750523734*`);
  }

  // ===== ছবির বিকল্প =====
  async sendPhotoAlternative(msg) {
    const text = `📸 *নিবেদিকা হোস্টেলের ছবি*

আমাদের হোস্টেলের সকল ছবি দেখতে পাবেন:
🌐 *ওয়েবসাইট:* https://nibedikahostel.netlify.app

━━━━━━━━━━━━━━━━━
🏠 *আমাদের রুমের বৈশিষ্ট্য:*

✅ সম্পূর্ণ টাইলসকৃত আধুনিক রুম
✅ প্রতিটি সিটে খাট, টেবিল ও চেয়ার
✅ কাপড় রাখার স্পেস
✅ পরিষ্কার অ্যাটাচ বাথরুম (৩ ও ৪ সিটে)
✅ বেলকনি সুবিধা (৩ ও ৪ সিটে)
✅ এসি / নন-এসি উভয় অপশন
✅ ফ্ল্যাট লিফট সুবিধা

━━━━━━━━━━━━━━━━━
🔍 *সরাসরি দেখতে চাইলে:*
📞 আগে কল করুন: *01750523734*
⏰ অফিস সময়: সকাল ৯টা - রাত ৯টা

আমরা আপনাকে হোস্টেল পরিদর্শনে আমন্ত্রণ জানাই! 😊`;

    await msg.reply(text);
  }

  // ===== URL থেকে ছবি ডাউনলোড করে পাঠান =====
  async sendImageFromUrl(msg, imageUrl, caption) {
    return new Promise((resolve, reject) => {
      const protocol = imageUrl.startsWith('https') ? https : http;
      
      protocol.get(imageUrl, (response) => {
        const chunks = [];
        
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString('base64');
            const mimetype = response.headers['content-type'] || 'image/jpeg';
            
            const media = new MessageMedia(mimetype, base64, 'hostel_room.jpg');
            await this.client.sendMessage(msg.from, media, { caption });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  // ===== লোকাল ছবি যোগ করুন (ইউটিলিটি ফাংশন) =====
  async addLocalImage(imageBuffer, filename) {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    const filepath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filepath, imageBuffer);
    console.log(`✅ ছবি সংরক্ষিত: ${filepath}`);
    return filepath;
  }
}

module.exports = MediaHandler;
