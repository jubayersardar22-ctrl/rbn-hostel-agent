// =============================================================
// মিডিয়া হ্যান্ডলার - ছবি পাঠানো
// Media Handler - Send Hospital Photos
// =============================================================

'use strict';

const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// স্থানীয় ছবি ফোল্ডার
const IMAGES_DIR = path.join(__dirname, '..', 'images');

class MediaHandler {
  constructor(client) {
    this.client = client;
  }

  // ===== হাসপাতালের ছবি পাঠান =====
  async sendRoomPhotos(msg) {
    try {
      await msg.reply(`📸 *আরোগ্য সদন হাসপাতালের ছবি পাঠাচ্ছি...*

🏥 আমাদের বৈশিষ্ট্য:
• পরিচ্ছন্ন ও রোগী-বান্ধব পরিবেশ
• আধুনিক ডায়াগনস্টিক ও অপারেশন থিয়েটার
• আরামদায়ক কেবিন

একটু অপেক্ষা করুন... ⏳`);

      const localImages = this.getLocalImages();
      
      if (localImages.length > 0) {
        await this.sendLocalImages(msg, localImages);
      } else {
        await this.sendPhotoAlternative(msg);
      }
      
    } catch (error) {
      console.error('❌ ছবি পাঠাতে এরর:', error.message);
      await msg.reply(`😔 ছবি পাঠাতে সমস্যা হয়েছে।

আমাদের হাসপাতাল পরিদর্শনে আসুন:
📍 নীলটুলি, মুজিব সড়ক, ফরিদপুর
📞 ইমার্জেন্সি: *০১৭১৩-০২৪৮০০*`);
    }
  }

  getLocalImages() {
    try {
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        return [];
      }
      
      const files = fs.readdirSync(IMAGES_DIR)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .map(f => path.join(IMAGES_DIR, f));
      
      return files.slice(0, 5); 
    } catch (error) {
      console.error('❌ ছবি ফোল্ডার পড়তে এরর:', error.message);
      return [];
    }
  }

  async sendLocalImages(msg, imagePaths) {
    const captions = [
      '🏥 আরোগ্য সদন হাসপাতাল - দৃশ্য',
      '🛏️ আরামদায়ক কেবিন',
      '🔬 আধুনিক ল্যাব',
      '🚑 ইমার্জেন্সি সার্ভিস',
      '👨‍⚕️ ডাক্তারদের চেম্বার'
    ];
    
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const media = MessageMedia.fromFilePath(imagePaths[i]);
        await this.client.sendMessage(msg.from, media, {
          caption: captions[i] || `📸 আরোগ্য সদন - ছবি ${i + 1}`
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`❌ ছবি ${i + 1} পাঠাতে এরর:`, e.message);
      }
    }
    
    await msg.reply(`✅ *সব ছবি পাঠানো হয়েছে!*

📞 বিস্তারিত জানতে কল করুন: *০১৭১৩-০২৪৮০০*`);
  }

  async sendPhotoAlternative(msg) {
    const text = `📸 *আরোগ্য সদন হাসপাতালের ছবি*

━━━━━━━━━━━━━━━━━
🏥 *আমাদের বৈশিষ্ট্য:*

✅ সম্পূর্ণ আধুনিক ও পরিচ্ছন্ন পরিবেশ
✅ ২৪/৭ ইমার্জেন্সি ও অ্যাম্বুলেন্স 
✅ এসি/নন-এসি কেবিন ও ওয়ার্ড
✅ আধুনিক অপারেশন থিয়েটার
✅ ডিজিটাল ল্যাব ও ডায়াগনস্টিক

━━━━━━━━━━━━━━━━━
🔍 *সরাসরি যোগাযোগ করুন:*
📞 ইমার্জেন্সি: *০১৭১৩-০২৪৮০০*

আপনাকে সুস্বাস্থ্য কামনা করছি! 😊`;

    await msg.reply(text);
  }

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
            
            const media = new MessageMedia(mimetype, base64, 'hospital.jpg');
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
}

module.exports = MediaHandler;
