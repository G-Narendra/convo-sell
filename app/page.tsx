"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { Send, Utensils, BrainCircuit, Sparkles, ChefHat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [kitchenOrder, setKitchenOrder] = useState<any>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for specialized KITCHEN_ORDER strings from assistant
  const processedMessages = messages.map((msg) => {
    if (msg.role === "assistant") {
      const orderRegex = /<KITCHEN_ORDER>([\s\S]*?)<\/KITCHEN_ORDER>/;
      const match = msg.content.match(orderRegex);
      
      if (match) {
        try {
          const parsedOrder = JSON.parse(match[1]);
          // To avoid infinite loop or multiple sets on re-render, we might want to lift this, 
          // but doing it carefully in a useEffect is better. For now we just extract and hide it.
          // In a real app we'd dispatch this.
          if (!kitchenOrder) {
             setTimeout(() => setKitchenOrder(parsedOrder), 0);
          }
          return { ...msg, content: msg.content.replace(orderRegex, "").trim() };
        } catch (e) {
          console.error("Failed to parse kitchen order JSON", e);
        }
      }
    }
    return msg;
  });

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      {/* Sidebar / Branding */}
      <div className="w-1/4 max-w-sm border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
              <BrainCircuit size={28} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">ConvoSell<span className="text-emerald-400">.ai</span></h1>
          </div>
          
          <div className="space-y-6">
            <div className="bg-neutral-800/50 p-5 rounded-2xl border border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2">Live Session Context</h2>
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Detected Mood</span>
                  <span className="text-sm font-medium bg-neutral-800 px-2 py-1 rounded-md text-emerald-400">
                    {kitchenOrder?.mood || "Analyzing..."}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Strategy</span>
                  <span className="text-sm font-medium bg-neutral-800 px-2 py-1 rounded-md text-blue-400">
                    Emotion-matched Upsell
                  </span>
                </div>
              </div>
            </div>
            
            <AnimatePresence>
              {kitchenOrder && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-3 text-emerald-400">
                    <ChefHat size={20} />
                    <h2 className="font-semibold">Kitchen Order Sent</h2>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {kitchenOrder.items?.map((item: any, idx: number) => (
                      <li key={idx} className="text-sm flex justify-between">
                        <span className="text-neutral-300">{item.quantity}x {item.name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-neutral-500 pt-3 border-t border-emerald-500/20">
                    Spice: {kitchenOrder.preferences?.spice_level} | Alerts: {kitchenOrder.preferences?.allergies?.join(", ") || "None"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="text-xs text-neutral-600">
          Powered by Gemini 1.5 Pro
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
        {/* Header (Mobile mostly) */}
        <div className="md:hidden p-4 border-b border-neutral-800 flex items-center gap-2 bg-neutral-900/80 backdrop-blur-md z-10">
          <BrainCircuit className="text-emerald-400" />
          <span className="font-bold">ConvoSell AI</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          
          {processedMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-70">
              <Sparkles size={48} className="text-emerald-400 mb-6" />
              <h2 className="text-2xl font-medium mb-3">Welcome to your table!</h2>
              <p className="text-neutral-400">
                Hi! I'm your digital sommelier and host for tonight. How are you feeling, and what kind of flavors are you looking for?
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {processedMessages.map((msg) => (
              msg.content.trim() && (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={\`flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}
                >
                  <div className={\`max-w-[85%] md:max-w-[70%] p-4 rounded-3xl \${
                    msg.role === "user" 
                      ? "bg-neutral-800 text-white rounded-br-sm" 
                      : "bg-emerald-950/40 border border-emerald-500/20 text-neutral-200 rounded-bl-sm"
                  }\`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <Sparkles size={14} />
                        <span className="text-xs font-semibold uppercase tracking-wider">AI Host</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </motion.div>
              )
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-3xl rounded-bl-sm flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent">
          <form 
            onSubmit={handleSubmit}
            className="max-w-4xl mx-auto relative flex items-center"
          >
            <input
              value={input}
              onChange={handleInputChange}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium text-neutral-100 placeholder:text-neutral-500 shadow-xl"
              placeholder={kitchenOrder ? "Chat with me while you wait..." : "Tell me what you're craving..."}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-emerald-500"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-neutral-600">
            {kitchenOrder ? "Kitchen actively preparing your order." : "Our AI adapts to your mood and crafts the perfect recommendation."}
          </div>
        </div>
      </div>
    </div>
  );
}
