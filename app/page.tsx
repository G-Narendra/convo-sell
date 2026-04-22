"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Utensils,
  Sparkles,
  ChefHat,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShoppingCart,
  Check,
  X,
  Cpu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { detectInjection, sanitizeInput } from "@/app/lib/guardrails";
import { motion, AnimatePresence } from "framer-motion";
import CafeteriaStatus from "./components/CafeteriaStatus";
import WaitTimeGames from "./components/WaitTimeGames";

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 5px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #404040;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #525252;
  }
`;

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------
interface UpsellSuggestion {
  item: string;
  price: string;
  reason: string;
}

interface UpsellHistoryEntry {
  item: string;
  accepted: boolean;
}

// ---------------------------------------------------------
// Components
// ---------------------------------------------------------

function UpsellCard({
  suggestion,
  onAccept,
  onDecline,
  resolved,
  accepted,
}: {
  suggestion: UpsellSuggestion;
  onAccept: () => void;
  onDecline: () => void;
  resolved: boolean;
  accepted: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl max-w-[90%] mt-2 ${
        resolved ? "opacity-50 grayscale" : ""
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-amber-500 text-black p-2 rounded-lg">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="font-bold text-amber-500">How about a pairing?</h3>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {suggestion.reason}
          </p>
        </div>
      </div>

      {!resolved ? (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-colors"
          >
            Add {suggestion.item} ({suggestion.price})
          </button>
          <button
            onClick={onDecline}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-xl text-xs transition-colors"
          >
            No thanks
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          {accepted ? (
            <span className="text-amber-500 flex items-center gap-1">
              <Check size={14} /> Added to order
            </span>
          ) : (
            <span className="text-neutral-500 flex items-center gap-1">
              <X size={14} /> Declined
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function KitchenOrderCard({ order }: { order: any }) {
  return (
    <div className="space-y-4">
      <div className="bg-neutral-800/80 p-5 rounded-2xl border border-neutral-700">
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Confirmed Items</h3>
        <ul className="space-y-3">
          {order.items.map((item: any, i: number) => (
            <li key={i} className="flex justify-between items-start">
              <div>
                <p className="font-bold text-orange-400 text-sm">{item.name}</p>
                {item.notes && <p className="text-[10px] text-neutral-500 italic mt-0.5">{item.notes}</p>}
              </div>
              <span className="bg-neutral-700 text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded">x{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-800/50 p-3 rounded-xl border border-neutral-800">
          <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Spice Level</p>
          <p className="text-sm font-medium">{order.preferences?.spice_level || "Standard"}</p>
        </div>
        <div className="bg-neutral-800/50 p-3 rounded-xl border border-neutral-800">
          <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Mood</p>
          <p className="text-sm font-medium capitalize">{order.mood || "Standard"}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Main Component
// ---------------------------------------------------------
export default function Home() {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [input, setInput] = useState("");
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  // States
  const [kitchenOrder, setKitchenOrder] = useState<any>(null);
  const [cart, setCart] = useState<{ items: { name: string; quantity: number }[] } | null>(null);
  const [detectedMood, setDetectedMood] = useState<string>("Analyzing...");
  const [liveMood, setLiveMood] = useState<string>("Analyzing...");
  const [upsellHistory, setUpsellHistory] = useState<UpsellHistoryEntry[]>([]);
  const [resolvedUpsells, setResolvedUpsells] = useState<Record<string, { accepted: boolean }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mdx_upsell_history");
      if (saved) setUpsellHistory(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load upsell history", e);
    }
  }, []);

  const persistUpsellHistory = useCallback((next: UpsellHistoryEntry[]) => {
    setUpsellHistory(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("mdx_upsell_history", JSON.stringify(next));
    }
  }, []);

  // -- Mood Debounce -------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDetectedMood(liveMood);
    }, 2000); 
    return () => clearTimeout(timer);
  }, [liveMood]);

  const chatInputRef = useRef<HTMLInputElement>(null);

  const chatConfig: any = {
    body: {
      data: {
        mode: isVoiceMode ? "voice" : "text",
        upsellHistory,
      },
    },
    onFinish: (message: any) => {
      console.log("DEBUG: onFinish message object:", JSON.stringify(message, null, 2));
      if (!message) return;

      // Robust extraction for SDK v6 UIMessage
      let rawText = "";
      if (message.content && typeof message.content === "string") {
        rawText = message.content;
      }
      
      // If content is empty, try parts (standard for UIMessage)
      if (!rawText && Array.isArray(message.parts)) {
        rawText = message.parts
          .map((p: any) => {
            if (typeof p === "string") return p;
            if (p.type === "text") return p.text ?? "";
            return "";
          })
          .join("");
      }

      // Final fallback: check for a 'text' property
      if (!rawText && message.text) rawText = message.text;

      // Clean the text for speech (remove tags and asterisks)
      const cleanContent = rawText
        .replace(/<KITCHEN_ORDER>[\s\S]*?<\/KITCHEN_ORDER>/g, "")
        .replace(/<UPSELL>[\s\S]*?<\/UPSELL>/g, "")
        .replace(/<MOOD>[\s\S]*?<\/MOOD>/g, "")
        .replace(/\*/g, "") // Remove ALL asterisks
        .trim();

      console.log("DEBUG: Extracted rawText:", rawText);
      console.log("DEBUG: Cleaned for speech:", cleanContent);

      if (isVoiceMode && cleanContent && "speechSynthesis" in window) {
        console.log("Speaking now...");
        const utterance = new SpeechSynthesisUtterance(cleanContent);
        
        utterance.onend = () => {
          if (isVoiceMode) setTimeout(startListening, 300);
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        utterance.onend = () => { if (isVoiceMode) setTimeout(startListening, 300); };
      }
    },
  };

  const { messages, status, sendMessage } = useChat(chatConfig) as any;
  const isLoading = status === "streaming" || status === "submitted";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const safeSendMessage = useCallback((text: string) => {
    setGuardrailError(null);
    const sanitized = sanitizeInput(text);
    const check = detectInjection(sanitized);
    if (!check.safe) {
      setGuardrailError(check.reason ?? "Message blocked.");
      setTimeout(() => setGuardrailError(null), 5000);
      if (isVoiceMode) startListening();
      return;
    }
    sendMessage({ text: sanitized });
  }, [sendMessage, isVoiceMode]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.start(); setIsListening(true); } catch (e) {}
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch (e) {}
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsListening(false);
          // 2 seconds extra delay as requested
          setTimeout(() => { safeSendMessage(transcript); }, 2000);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, [safeSendMessage]);

  const toggleVoiceMode = () => {
    if (!isVoiceMode) {
      window.speechSynthesis.cancel();
      setTimeout(startListening, 500);
    } else {
      stopListening();
    }
    setIsVoiceMode(!isVoiceMode);
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else { window.speechSynthesis.cancel(); startListening(); }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const kitchenOrderRegex = /<KITCHEN_ORDER>([\s\S]*?)<\/KITCHEN_ORDER>/g;
  const upsellRegex = /<UPSELL>([\s\S]*?)<\/UPSELL>/g;
  const moodRegex = /<MOOD>([\s\S]*?)<\/MOOD>/g;
  const cartRegex = /<CART>([\s\S]*?)<\/CART>/g;

  const processedMessages = (messages || []).map((msg: any) => {
    if (msg.role !== "assistant") return msg;
    let content = (msg.content && typeof msg.content === "string" && msg.content.length > 0)
      ? msg.content
      : (msg.parts || [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? "")
          .join("");
    let upsell: UpsellSuggestion | null = null;
    const orderMatches = [...content.matchAll(kitchenOrderRegex)];
    if (orderMatches.length > 0) {
      try { const lastOrder = JSON.parse(orderMatches[orderMatches.length - 1][1]); setTimeout(() => setKitchenOrder(lastOrder), 0); } catch (e) {}
    }
    const cartMatches = [...content.matchAll(cartRegex)];
    if (cartMatches.length > 0) {
      try { const lastCart = JSON.parse(cartMatches[cartMatches.length - 1][1]); setTimeout(() => setCart(lastCart), 0); } catch (e) {}
    }
    const upsellMatches = [...content.matchAll(upsellRegex)];
    if (upsellMatches.length > 0) {
      try { upsell = JSON.parse(upsellMatches[upsellMatches.length - 1][1]); } catch (e) {}
    }
    const moodMatches = [...content.matchAll(moodRegex)];
    if (moodMatches.length > 0) {
      const lastMood = moodMatches[moodMatches.length - 1][1].trim();
      setTimeout(() => setLiveMood(lastMood), 0);
    }
    content = content.replace(kitchenOrderRegex, "").replace(upsellRegex, "").replace(moodRegex, "").replace(cartRegex, "").trim();
    return { ...msg, content, upsell };
  });

  const handleUpsellAccept = (msgId: string, item: string) => {
    setResolvedUpsells((prev) => ({ ...prev, [msgId]: { accepted: true } }));
    persistUpsellHistory([...upsellHistory, { item, accepted: true }]);
    sendMessage({ text: `Yes please, add the ${item} to my order!` });
  };

  const handleUpsellDecline = (msgId: string, item: string) => {
    setResolvedUpsells((prev) => ({ ...prev, [msgId]: { accepted: false } }));
    persistUpsellHistory([...upsellHistory, { item, accepted: false }]);
    sendMessage({ text: "No thanks, I'll skip that." });
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      
      {/* Sidebar */}
      <div className="w-1/4 max-w-sm border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col hidden md:flex h-full">
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-orange-500/20 p-2 rounded-xl text-orange-400">
              <Utensils size={28} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Global Hub<span className="text-orange-400">@MDX</span>
            </h1>
          </div>

          <div className="bg-neutral-800/50 p-5 rounded-2xl border border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              Session Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Mode</span>
                <span className={`text-sm font-medium px-2 py-1 rounded-md flex items-center gap-1 ${
                  isVoiceMode ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-300"
                }`}>
                  {isVoiceMode ? <><Volume2 size={14} /> Voice</> : "Text"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Detected Mood</span>
                <span className="text-sm font-medium bg-neutral-800 px-2 py-1 rounded-md text-orange-400">
                  {detectedMood}
                </span>
              </div>
              {upsellHistory.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                  <span className="text-sm text-neutral-500">Upsells accepted</span>
                  <span className="text-sm font-medium text-amber-400">
                    {upsellHistory.filter((u) => u.accepted).length} / {upsellHistory.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Cart */}
          <AnimatePresence>
            {(cart?.items?.length ?? 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-2xl"
              >
                <h2 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ShoppingCart size={14} /> Current Cart
                </h2>
                <div className="space-y-2">
                  {cart?.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-neutral-300">{item.name}</span>
                      <span className="bg-orange-500/20 text-orange-400 px-1.5 rounded font-bold">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Kitchen Order (Final) */}
          <AnimatePresence>
            {kitchenOrder && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-2xl"
              >
                <div className="flex items-center gap-2 mb-3 text-orange-400">
                  <ChefHat size={20} />
                  <h2 className="font-semibold">Order to Kitchen</h2>
                </div>
                <ul className="space-y-2 mb-4">
                  {kitchenOrder.items?.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm flex flex-col">
                      <span className="text-neutral-300 font-medium">
                        {item.quantity}x {item.name}
                      </span>
                      {item.notes && (
                        <span className="text-xs text-neutral-500 italic pl-4">
                          Note: {item.notes}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-neutral-500 pt-3 border-t border-orange-500/20">
                  Spice: {kitchenOrder.preferences?.spice_level || "Standard"} | Alerts:{" "}
                  {kitchenOrder.preferences?.allergies?.join(", ") || "None"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wait Time Games */}
          <AnimatePresence>
            {kitchenOrder && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <WaitTimeGames />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-6 mt-auto border-t border-neutral-800/50 text-[10px] text-neutral-600 flex justify-between items-center">
          <span>MDX Dubai Campus Host</span>
          <div className="flex gap-2">
            <span className="flex items-center gap-1"><Shield size={10} /> Secure</span>
            <span className="flex items-center gap-1"><Cpu size={10} /> AI Powered</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black overflow-hidden h-full">
        
        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <Utensils className="text-orange-400" />
            <span className="font-bold">Global Hub @MDX</span>
          </div>
        </div>

        <CafeteriaStatus onPreOrderClick={() => chatInputRef.current?.focus()} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
          {processedMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-70">
              <Sparkles size={48} className="text-orange-400 mb-6" />
              <h2 className="text-2xl font-medium mb-3">Welcome to Global Hub!</h2>
              <p className="text-neutral-400 mb-8">
                Your AI host for Middlesex University Dubai. Tell us what you&apos;re
                craving, or just let us know how your day is going!
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsVoiceMode(false)}
                  className={`px-6 py-3 rounded-full font-medium transition-all ${
                    !isVoiceMode ? "bg-orange-500 text-black shadow-lg shadow-orange-500/20" : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  Type Order
                </button>
                <button
                  onClick={() => setIsVoiceMode(true)}
                  className={`px-6 py-3 rounded-full font-medium flex items-center gap-2 transition-all ${
                    isVoiceMode ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  <Volume2 size={18} /> Voice Mode
                </button>
              </div>
            </div>
          )}

          {kitchenOrder && (
            <div className="md:hidden mb-4">
              <WaitTimeGames />
            </div>
          )}

          <AnimatePresence initial={false}>
            {processedMessages?.map((msg: any) => {
              const displayText: string = (msg.content && typeof msg.content === "string" && msg.content.length > 0)
                ? msg.content
                : (msg.parts || [])
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text ?? "")
                    .join("");

              return displayText.trim() && (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] md:max-w-[70%] ${msg.role === "user" ? "p-4 rounded-3xl bg-neutral-800 text-white rounded-br-sm" : "flex flex-col"}`}>
                    {msg.role === "assistant" ? (
                      <>
                        <div className="p-4 rounded-3xl bg-orange-950/30 border border-orange-500/20 text-neutral-200 rounded-bl-sm">
                          <div className="flex items-center gap-2 mb-2 text-orange-400">
                            <Sparkles size={14} />
                            <span className="text-xs font-semibold uppercase tracking-wider">AI Host</span>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{displayText}</div>
                        </div>

                        {msg.upsell && (
                          <UpsellCard
                            suggestion={msg.upsell}
                            resolved={!!resolvedUpsells[msg.id]}
                            accepted={resolvedUpsells[msg.id]?.accepted ?? false}
                            onAccept={() => handleUpsellAccept(msg.id, msg.upsell.item)}
                            onDecline={() => handleUpsellDecline(msg.id, msg.upsell.item)}
                          />
                        )}
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed">{displayText}</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-orange-950/30 border border-orange-500/20 p-4 rounded-3xl rounded-bl-sm flex items-center gap-3">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Guardrail Banner */}
        <AnimatePresence>
          {guardrailError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-4 md:mx-8 mb-2 flex items-start gap-3 bg-red-950/50 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-2xl"
            >
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-red-400" />
              <span>{guardrailError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              safeSendMessage(input);
              setInput("");
            }}
            className="max-w-4xl mx-auto flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={toggleVoiceMode}
                className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                  isVoiceMode ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                }`}
              >
                <Volume2 size={14} /> {isVoiceMode ? "Voice Mode Active" : "Enable Voice Mode"}
              </button>
              {isListening && (
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Listening...
                </div>
              )}
            </div>

            <div className="relative flex items-center bg-neutral-900 border border-neutral-800 rounded-full shadow-xl focus-within:ring-2 focus-within:ring-orange-500/50 transition-all">
              {isVoiceMode ? (
                <div className="flex-1 px-6 py-4 text-neutral-400 font-medium">{isListening ? "Speak now..." : "Tap the microphone to speak"}</div>
              ) : (
                <input
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isVoiceMode}
                  className="flex-1 bg-transparent pl-6 py-4 focus:outline-none font-medium text-neutral-100 placeholder:text-neutral-500 disabled:opacity-50"
                  placeholder={kitchenOrder ? "Chat while you wait..." : "Type your cravings (e.g. stressed and hungry)..."}
                />
              )}
              <div className="pr-2 flex items-center">
                {isVoiceMode ? (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-3 rounded-full transition-all ${isListening ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse" : "bg-blue-500 text-white hover:bg-blue-400"}`}
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading || !input?.trim()}
                    className="p-3 bg-orange-500 hover:bg-orange-400 text-black rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-orange-500"
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
          </form>
          <div className="text-center mt-4 text-xs text-neutral-600">{kitchenOrder ? "Kitchen staff preparing your order." : null}</div>
        </div>
      </div>
    </div>
  );
}
