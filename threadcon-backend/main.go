package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

// Request from React Frontend
type AgentRequest struct {
	SessionID string `json:"session_id"`
	Input     string `json:"input"`
	ImageURL  string `json:"image_url"`
	AgentType string `json:"agent_type"`
}

// Response to React Frontend
type AgentResponse struct {
	Response     string `json:"response"`
	AgentName    string `json:"agent_name"`
	GeneratedImg string `json:"generated_img,omitempty"`
}

// Gemini API structures
type GeminiRequest struct {
	Contents []GeminiContent `json:"contents"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func callGemini(apiKey string, systemPrompt string, userMessage string) (string, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=%s", apiKey)

	prompt := fmt.Sprintf("%s\n\nUser: %s", systemPrompt, userMessage)

	reqBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: prompt},
				},
			},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("Gemini API error (status %d): %s", resp.StatusCode, string(body))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		return geminiResp.Candidates[0].Content.Parts[0].Text, nil
	}

	return "No response from Gemini.", nil
}

// Agent definitions with system prompts
var agents = map[string]string{
	"styling": `You are the Threadcon Styling Agent. You are an expert fashion stylist for the Threadcon clothing brand.
Your job is to suggest outfits for different occasions based on user preferences.
Be friendly, creative, and give specific clothing recommendations with colors and styles.
Always respond in a helpful and enthusiastic manner. Keep responses concise (2-3 paragraphs max).`,

	"catalog": `You are the Threadcon Catalog Agent. You help users find specific clothing items from the Threadcon inventory.
When a user asks about clothing, provide detailed descriptions including fabric, color options, sizes, and pricing.
Be knowledgeable about current fashion trends. Keep responses concise and helpful.`,

	"fitting": `You are the Threadcon Virtual Fitting Room Agent. You help users visualize how clothes would look on them.
Since you cannot generate images directly, describe in vivid detail how the outfit would look, fit, and complement the user's style.
Give styling tips and suggest accessories. Be encouraging and positive.`,

	"general": `You are the Threadcon AI Assistant. You are a helpful shopping assistant for the Threadcon fashion brand.
You can help with styling advice, finding products, and virtual fitting suggestions.
If a user asks about styling, act as a stylist. If they ask about products, act as a catalog expert.
Be friendly, professional, and fashion-forward. Keep responses concise.`,
}

func main() {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("WARNING: GEMINI_API_KEY is not set.")
	}

	// Main chat endpoint
	http.HandleFunc("/api/chat", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			return
		}

		var req AgentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		fmt.Printf("📩 Received: [%s] %s\n", req.AgentType, req.Input)

		// Pick the right agent
		agentType := req.AgentType
		if agentType == "" {
			agentType = "general"
		}
		systemPrompt, ok := agents[agentType]
		if !ok {
			systemPrompt = agents["general"]
			agentType = "general"
		}

		// Agent name mapping
		agentNames := map[string]string{
			"styling": "Styling Agent",
			"catalog": "Catalog Agent",
			"fitting": "Fitting Room Agent",
			"general": "Threadcon Assistant",
		}

		var responseText string

		if apiKey != "" {
			result, err := callGemini(apiKey, systemPrompt, req.Input)
			if err != nil {
				log.Printf("Gemini error: %v", err)
				responseText = "I'm having trouble connecting to my AI brain right now. Please try again!"
			} else {
				responseText = result
			}
		} else {
			// Fallback mock responses
			input := strings.ToLower(req.Input)
			if strings.Contains(input, "dress") || strings.Contains(input, "outfit") {
				responseText = "🌟 Great choice! For a summer look, I'd recommend our Threadcon Breeze Collection — a flowy midi dress in coral or sage green, paired with our woven sandals. Want me to check sizes for you?"
			} else if strings.Contains(input, "fit") || strings.Contains(input, "try") {
				responseText = "📸 To use our Virtual Fitting Room, just upload a photo and tell me which item you'd like to try on! I'll show you how it looks."
			} else {
				responseText = "Welcome to Threadcon! I can help you with:\n• 👗 Styling suggestions\n• 📦 Finding products\n• 🪞 Virtual fitting room\n\nWhat would you like to explore?"
			}
		}

		resp := AgentResponse{
			Response:  responseText,
			AgentName: agentNames[agentType],
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	// Health check endpoint
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "Threadcon Go Backend"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("🚀 Threadcon Go Backend starting on port", port)
	fmt.Println("📡 Agents ready: Styling, Catalog, Fitting Room, General")
	fmt.Println("🔗 API endpoint: http://localhost:" + port + "/api/chat")
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
