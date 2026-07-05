import { useState, useRef, useEffect } from 'react'
import { GoogleGenAI } from '@google/genai'

// Agent definitions with system prompts
const agentConfigs = {
  general: {
    name: 'Threadcon Assistant',
    emoji: '🤖',
    prompt: `You are the Threadcon AI Assistant — a premium fashion brand's intelligent shopping companion.
You help customers with styling advice, product discovery, and virtual fitting room guidance.
Be friendly, stylish, professional, and concise (2-3 paragraphs max).
If asked in Bangla, respond in Bangla.`,
  },
  styling: {
    name: 'Styling Agent',
    emoji: '👗',
    prompt: `You are the Threadcon Styling Agent — an expert fashion stylist.
Suggest outfits for different occasions (weddings, office, casual, party, etc.).
Give specific recommendations with colors, fabrics, and accessories.
Be creative, enthusiastic, and trendy. Keep responses concise.
If asked in Bangla, respond in Bangla.`,
  },
  catalog: {
    name: 'Catalog Agent',
    emoji: '📦',
    prompt: `You are the Threadcon Catalog Agent — a product search specialist.
Help users find clothing items. Provide detailed descriptions including fabric, color options, sizes, and pricing.
Suggest alternatives and complementary items. Be knowledgeable about fashion trends.
If asked in Bangla, respond in Bangla.`,
  },
  fitting: {
    name: 'Fitting Room Agent',
    emoji: '🪞',
    prompt: `You are the Threadcon Virtual Fitting Room Agent.
Help users visualize how clothes would look on them by describing in vivid detail how outfits would look, fit, and complement their body type and style.
Give sizing advice, fit tips, and styling suggestions. Be encouraging and positive.
If asked in Bangla, respond in Bangla.`,
  },
};

function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'agent',
      text: '👋 Welcome to Threadcon! I am your AI-powered Virtual Styling Assistant.\n\nI can help you with:\n• 👗 Styling suggestions for any occasion\n• 📦 Finding products from our catalog\n• 🪞 Virtual fitting room experience\n\nWhat would you like to explore today?',
      agentName: 'Threadcon Assistant',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeAgent, setActiveAgent] = useState('general');
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const prompt = inputValue;
    const userMessage = { id: Date.now(), sender: 'user', text: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const currentAgent = agentConfigs[activeAgent] || agentConfigs.general;

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'agent',
          text: '⚠️ Gemini API Key not configured. Please add your key to the .env.local file.',
          agentName: 'System',
        },
      ]);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `${currentAgent.prompt}\n\nUser: ${prompt}`,
      });

      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'agent',
          text: result.text,
          agentName: `${currentAgent.emoji} ${currentAgent.name}`,
        },
      ]);
    } catch (error) {
      console.error(error);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'agent',
          text: `Error: ${error.message}`,
          agentName: 'System',
        },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const agentButtons = [
    { key: 'general', label: '🤖 General', desc: 'General Assistant' },
    { key: 'styling', label: '👗 Styling', desc: 'Outfit Suggestions' },
    { key: 'catalog', label: '📦 Catalog', desc: 'Find Products' },
    { key: 'fitting', label: '🪞 Fitting', desc: 'Virtual Try-On' },
  ];

  return (
    <div className="app-container">
      <div className="glow-bg"></div>

      {/* Sidebar */}
      <aside className="sidebar">
        <h2
          style={{
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '2rem',
          }}
        >
          <div
            className="avatar agent"
            style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}
          >
            TC
          </div>
          Threadcon
        </h2>

        <div className="sidebar-title">Agents</div>
        {agentButtons.map((ab) => (
          <div
            key={ab.key}
            className={`nav-item ${activeAgent === ab.key ? 'active' : ''}`}
            onClick={() => {
              setActiveAgent(ab.key);
              const agent = agentConfigs[ab.key];
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now(),
                  sender: 'agent',
                  text: `🔄 Switched to ${agent.emoji} ${agent.name}. How can I help you?`,
                  agentName: `${agent.emoji} ${agent.name}`,
                },
              ]);
            }}
            style={{ cursor: 'pointer' }}
          >
            <span>{ab.label}</span>
          </div>
        ))}

        <div className="sidebar-title" style={{ marginTop: '2rem' }}>
          Tools
        </div>
        <div className="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          Lookbook
        </div>
        <div className="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Chat History
        </div>
        <div className="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          About
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <h1>
            {agentButtons.find((a) => a.key === activeAgent)?.desc || 'Threadcon'}{' '}
            <span className="header-status"></span>
          </h1>
          <span
            style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}
          >
            Active: {agentButtons.find((a) => a.key === activeAgent)?.label}
          </span>
        </header>

        <div className="chat-area">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className={`avatar ${msg.sender}`}>
                {msg.sender === 'agent' ? 'TC' : 'U'}
              </div>
              <div className="bubble">
                {msg.agentName && msg.sender === 'agent' && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {msg.agentName}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="message agent animate-fade-in">
              <div className="avatar agent">TC</div>
              <div
                className="bubble"
                style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
              >
                <span
                  className="animate-pulse"
                  style={{ fontSize: '1.5rem', lineHeight: 0 }}
                >
                  ...
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="input-container">
          <div className="input-box">
            <input
              type="text"
              placeholder="Ask Threadcon about styling, outfits, or try-on..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App
