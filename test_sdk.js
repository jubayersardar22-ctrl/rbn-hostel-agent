require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testSDK() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No API key found in .env");
    return;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello!");
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("SDK Error:", err.message);
  }
}

testSDK();
