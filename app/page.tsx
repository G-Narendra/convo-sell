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
  CheckCircle,
  XCircle,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";
import { detectInjection, sanitizeInput } from "@/app/lib/guardrails";
import { motion, AnimatePresence } from "framer-motion";
import CafeteriaStatus from "./components/CafeteriaStatus";
import WaitTimeGames from "./components/WaitTimeGames";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface UpsellSuggestion {
  item: string;
  price: string;
  reason: string;
}

interface UpsellHistoryEntry {
  item: string;
  accepted: boolean;
}

// ─────────────────────────────────────────────────────────
// UpsellCard — rendered inline in the chat when the AI
// proposes an add-on with a pairing reason
// ─────────────────────────────────────────────────────────
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
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <ShoppingBag className="text-amber-400" size={15} />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Suggested Add-on
        </span>
        <span className="ml-auto text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">
          {suggestion.price}
        </span>
      </div>

      {/* Item name */}
      <p className="text-sm font-semibold text-neutral-100 mb-1">
        {suggestion.item}
      </p>

      {/* Pairing reason */}
      <p className="text-xs text-neutral-400 italic leading-relaxed mb-3">
        💡 {suggestion.reason}
      </p>

      {/* Accept / Decline */}
      {resolved ? (
        <div
          className={`flex items-center gap-2 text-xs font-medium ${
            accepted ? "text-green-400" : "text-neutral-500"
          }`}
        >
          {accepted ? (
            <>
              <CheckCircle size={14} /> Added to your order!
            </>
          ) : (
            <>
              <XCircle size={14} /> No thanks — noted for next time.
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold py-2 rounded-xl transition-colors"
          >
            <CheckCircle size={13} /> Yes, add it!
          </button>
          <button
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium py-2 rounded-xl transition-colors"
          >
            <XCircle size={13} /> No thanks
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────
export default function Home() {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [input, setInput] = useState("");

  // ── Guardrail error state ─────────────────────────────
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  // ── Upsell state ──────────────────────────────────────
  const [upsellHistory, setUpsellHistory] = useState<UpsellHistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("mdx_upsell_history") || "[]");
    } catch {
      return [];
    }
  });

  const [resolvedUpsells, setResolvedUpsells] = useState<
    Record<string, { accepted: boolean }>
  >({});

  const persistUpsellHistory = useCallback((next: UpsellHistoryEntry[]) => {
    setUpsellHistory(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("mdx_upsell_history", JSON.stringify(next));
    }
  }, []);

  const chatInputRef = useRef<HTMLInputElement>(null);

  const chatConfig: any = {
    body: {
      data: {
        mode: isVoiceMode ? "voice" : "text",
        upsellHistory,
      },
    },
    onFinish: (message: any) => {
      if (!message || typeof message.content !== "string") return;
      const cleanContent = message.content
        .replace(/<KITCHEN_ORDER>[\s\S]*?<\/KITCHEN_ORDER>/g, "")
        .replace(/<UPSELL>[\s\S]*?<\/UPSELL>/g, "")
        .trim();

      if (isVoiceMode && cleanContent && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(cleanContent);
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Female"))
        );
        if (englishVoice) utterance.voice = englishVoice;
        utterance.pitch = 1;
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    },
  };

  const { messages, status, sendMessage } = useChat(chatConfig) as any;
  const isLoading = status === "streaming" || status === "submitted";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const [kitchenOrder, setKitchenOrder] = useState<any>(null);

  // ── Guardrail-checked send helper ─────────────────────
  // Must be defined BEFORE the speech recognition useEffect that depends on it.
  const safeSendMessage = useCallback(
    (msg: { role: "user"; content: string }) => {
      setGuardrailError(null);
      const sanitized = sanitizeInput(msg.content);
      const check = detectInjection(sanitized);
      if (!check.safe) {
        setGuardrailError(check.reason ?? "Message blocked by security guardrail.");
        setTimeout(() => setGuardrailError(null), 5000);
        return;
      }
      sendMessage({ ...msg, content: sanitized });
    },
    [sendMessage]
  );

  // ── Speech Recognition ────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsListening(false);
          safeSendMessage({ role: "user", content: transcript });
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, [safeSendMessage]);

  const toggleVoiceMode = () => {
    if (!isVoiceMode) window.speechSynthesis.cancel();
    setIsVoiceMode(!isVoiceMode);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      window.speechSynthesis.cancel();
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // ── Auto-scroll ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Message Processing ────────────────────────────────
  const kitchenOrderRegex = /<KITCHEN_ORDER>([\s\S]*?)<\/KITCHEN_ORDER>/;
  const upsellRegex = /<UPSELL>([\s\S]*?)<\/UPSELL>/;

  const processedMessages = (messages || []).map((msg: any) => {
    if (msg.role !== "assistant") return msg;

    let content = msg.content;
    let upsell: UpsellSuggestion | null = null;

    const orderMatch = content.match(kitchenOrderRegex);
    if (orderMatch) {
      try {
        const parsedOrder = JSON.parse(orderMatch[1]);
        if (!kitchenOrder) setTimeout(() => setKitchenOrder(parsedOrder), 0);
      } catch (e) {
        console.error("Failed to parse kitchen order", e);
      }
      content = content.replace(kitchenOrderRegex, "").trim();
    }

    const upsellMatch = content.match(upsellRegex);
    if (upsellMatch) {
      try {
        upsell = JSON.parse(upsellMatch[1]) as UpsellSuggestion;
      } catch (e) {
        console.error("Failed to parse upsell", e);
      }
      content = content.replace(upsellRegex, "").trim();
    }

    return { ...msg, content, upsell };
  });

  // ── Upsell handlers ───────────────────────────────────
  const handleUpsellAccept = (msgId: string, item: string) => {
    setResolvedUpsells((prev) => ({ ...prev, [msgId]: { accepted: true } }));
    persistUpsellHistory([...upsellHistory, { item, accepted: true }]);
    // Upsell responses are system-generated — bypass guardrail check
    sendMessage({ role: "user", content: `Yes please, add the ${item} to my order!` });
  };

  const handleUpsellDecline = (msgId: string, item: string) => {
    setResolvedUpsells((prev) => ({ ...prev, [msgId]: { accepted: false } }));
    persistUpsellHistory([...upsellHistory, { item, accepted: false }]);
    sendMessage({ role: "user", content: `No thanks, I'll skip the ${item}.` });
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-1/4 max-w-sm border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          {/* Branding */}
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-orange-500/20 p-2 rounded-xl text-orange-400">
              <Utensils size={28} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Global Hub<span className="text-orange-400">@MDX</span>
            </h1>
          </div>

          <div className="space-y-6">
            {/* Session Context */}
            <div className="bg-neutral-800/50 p-5 rounded-2xl border border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                Live Session Context
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
                    {kitchenOrder?.mood || "Analyzing..."}
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

            {/* Kitchen Order */}
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

            {/* ── Enhancement 3: Wait Time Games (sidebar, after order) ── */}
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
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-500/80">
            <ShieldCheck size={13} />
            <span>Guardrails Active</span>
          </div>
          <div className="text-xs text-neutral-600">Powered by ConvoSell AI</div>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">

        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <Utensils className="text-orange-400" />
            <span className="font-bold">Global Hub @MDX</span>
          </div>
        </div>

        {/* ── Enhancement 2: Cafeteria Status Card ── */}
        <CafeteriaStatus onPreOrderClick={() => chatInputRef.current?.focus()} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">

          {/* Welcome state */}
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
                    !isVoiceMode
                      ? "bg-orange-500 text-black shadow-lg shadow-orange-500/20"
                      : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  Type Order
                </button>
                <button
                  onClick={() => setIsVoiceMode(true)}
                  className={`px-6 py-3 rounded-full font-medium flex items-center gap-2 transition-all ${
                    isVoiceMode
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                      : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  <Volume2 size={18} /> Voice Mode
                </button>
              </div>
            </div>
          )}

          {/* ── Enhancement 3: Games panel (mobile, after order) ── */}
          {kitchenOrder && (
            <div className="md:hidden mb-4">
              <WaitTimeGames />
            </div>
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {processedMessages?.map(
              (msg: any) =>
                msg.content.trim() && (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] ${
                        msg.role === "user"
                          ? "p-4 rounded-3xl bg-neutral-800 text-white rounded-br-sm"
                          : "flex flex-col"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <>
                          <div className="p-4 rounded-3xl bg-orange-950/30 border border-orange-500/20 text-neutral-200 rounded-bl-sm">
                            <div className="flex items-center gap-2 mb-2 text-orange-400">
                              <Sparkles size={14} />
                              <span className="text-xs font-semibold uppercase tracking-wider">
                                AI Host
                              </span>
                            </div>
                            <div className="whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </div>
                          </div>

                          {/* Upsell Card */}
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
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
            )}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-orange-950/30 border border-orange-500/20 p-4 rounded-3xl rounded-bl-sm flex items-center gap-3">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Guardrail Error Banner ── */}
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

        {/* ── Input Area ── */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              safeSendMessage({ role: "user", content: input });
              setInput("");
            }}
            className="max-w-4xl mx-auto flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={toggleVoiceMode}
                className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                  isVoiceMode
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                }`}
              >
                <Volume2 size={14} />{" "}
                {isVoiceMode ? "Voice Mode Active" : "Enable Voice Mode"}
              </button>

              {isListening && (
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Listening...
                </div>
              )}
            </div>

            <div className="relative flex items-center bg-neutral-900 border border-neutral-800 rounded-full shadow-xl focus-within:ring-2 focus-within:ring-orange-500/50 transition-all">
              {isVoiceMode ? (
                <div className="flex-1 px-6 py-4 text-neutral-400 font-medium">
                  {isListening ? "Speak now..." : "Tap the microphone to speak"}
                </div>
              ) : (
                <input
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isVoiceMode}
                  className="flex-1 bg-transparent pl-6 py-4 focus:outline-none font-medium text-neutral-100 placeholder:text-neutral-500 disabled:opacity-50"
                  placeholder={
                    kitchenOrder
                      ? "Chat while you wait..."
                      : "Type your cravings (e.g. stressed and hungry)..."
                  }
                />
              )}

              <div className="pr-2 flex items-center">
                {isVoiceMode ? (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-3 rounded-full transition-all ${
                      isListening
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse"
                        : "bg-blue-500 text-white hover:bg-blue-400"
                    }`}
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

          <div className="text-center mt-4 text-xs text-neutral-600">
            {kitchenOrder
              ? "Kitchen staff preparing your order."
              : "Using AI sentiment analysis to find exactly what hits the spot."}
          </div>
        </div>
      </div>
    </div>
  );
}
