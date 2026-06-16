require('dotenv').config();
const llm = require('./llm-router');

async function runTest() {
  console.log('Testing LLM Integration...');
  console.log('llm.isReady() ->', llm.isReady());
  
  if (llm.isReady()) {
    console.log('Sending message to LLM: "হাই বন্ধু"');
    const reply = await llm.reply('test_user_1', 'হাই বন্ধু');
    console.log('LLM Reply:', reply);
  } else {
    console.log('LLM is NOT ready. It would fall back to template answers.');
  }
}

runTest();
