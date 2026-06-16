'use strict';
require('dotenv').config();
const llm = require('./llm-router');
const fs = require('fs');

console.log('=== LLM Debug Status ===');
console.log('Env GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present (starts with ' + process.env.GEMINI_API_KEY.slice(0, 6) + '...)' : 'Not Set');
console.log('Env OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Present' : 'Not Set');
console.log('Env CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? 'Present' : 'Not Set');

try {
  const s = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
  console.log('Settings.json content:');
  console.log('  geminiEnabled:', s.geminiEnabled);
  console.log('  geminiApiKey:', s.geminiApiKey ? 'Present (starts with ' + s.geminiApiKey.slice(0, 6) + '...)' : 'Not Set');
  console.log('  llmProvider:', s.llmProvider);
} catch (e) {
  console.error('Error reading settings.json:', e.message);
}

console.log('llm.isReady():', llm.isReady());

async function run() {
  if (llm.isReady()) {
    console.log('Attempting to call LLM reply for user test...');
    const reply = await llm.reply('test-user', 'হ্যালো, তোমার নাম কি?');
    console.log('LLM Reply Result:', reply);
  } else {
    console.log('LLM is NOT ready. Cannot call reply.');
  }
}

run().catch(console.error);
