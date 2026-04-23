# Global Hub @ MDX (ConvoSell AI)
ConvoSell AI is an AI-powered **influencing conversational agent** built for Global Hub @ Middlesex University Dubai, a multicultural cafeteria environment.

Unlike traditional chatbots that passively respond to user queries, ConvoSell AI is designed to actively **influence customer decision-making** during the ordering process. The system engages users through natural language interaction, detects mood and dietary preferences, and strategically guides conversations toward specific menu items.

By combining sentiment analysis, preference extraction, and persuasive recommendation techniques, the chatbot subtly nudges users toward alternative or higher-value food choices. It applies contextual upselling and behavioral influence strategies such as framing, suggestion sequencing, and adaptive responses to maximize order value while maintaining a natural user experience.

The system ultimately converts the conversation into a structured, kitchen-ready order, bridging the gap between user intent and operational execution.

## 🚀 Key Features

- **Multi-Modal Interaction**: Seamlessly switch between text-based chat and browser-native voice interaction.
- **Mood-Aware AI**: Powered by Google Gemini 2.0 Flash, the AI detects sentiment and tone to offer personalized, empathetic recommendations.
- **Smart Menu Recommendations**: Curated menu items tailored for MDX students (Shawarma, Butter Chicken, Vegan Bowls, etc.) with automated upselling of high-margin items.
- **Kitchen Order Integration**: Real-time structured order generation that parses AI conversation into actionable kitchen payloads.
- **Wait-Time Engagement**: Once an order is placed, the AI shifts to "Wait Time Mode," entertaining students with university trivia and Dubai facts.

## 🛠️ Technology Stack

- **Frontend**: Next.js 16 (App Router), Framer Motion, Tailwind CSS.
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash) via Vercel AI SDK.
- **UI Icons**: Lucide React.
- **Voice**: Browser-native Web Speech API (SpeechRecognition & SpeechSynthesis).

## 📋 Prerequisites

- **Node.js 18+** installed on your machine.
- **Google Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/).

## ⚙️ Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/G-Narendra/convo-sell.git
   cd convo-sell
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and add your Gemini API key:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
   ```

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm start
```

## 🌐 Deployment to Vercel

1. Push your code to a GitHub repository.
2. Connect your repository to [Vercel](https://vercel.com/).
3. **Environment Setup**: In the Vercel dashboard, go to Settings -> Environment Variables and add `GOOGLE_GENERATIVE_AI_API_KEY`.
4. Deploy!

## 🧪 Testing Voice Mode

To test voice mode, ensure you are using a modern browser (Chrome is recommended) and grant microphone permissions when prompted. The AI will speak back to you using the system's natural English voices.

---
Developed for the ConvoSell AI Hackathon - Empowering profitable influence through empathetic AI.
