"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, Star, Gift, Gamepad2 } from "lucide-react";

// ─────────────────────────────────────────────────────────
// Loyalty Points helpers (localStorage)
// ─────────────────────────────────────────────────────────
const LS_KEY = "mdx_loyalty_points";

function getPoints(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(LS_KEY) || "0", 10);
}

function addPoints(pts: number): number {
  const next = getPoints() + pts;
  localStorage.setItem(LS_KEY, String(next));
  return next;
}

// ─────────────────────────────────────────────────────────
// MemoryMatch — 4×4 grid, 8 MDX/Dubai themed pairs
// ─────────────────────────────────────────────────────────
const ICONS = ["🧆", "🥙", "🌮", "🧋", "🕌", "🏙️", "🎓", "📚"];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildCards() {
  return shuffle([...ICONS, ...ICONS]).map((icon, i) => ({
    id: i,
    icon,
    flipped: false,
    matched: false,
  }));
}

type Card = ReturnType<typeof buildCards>[number];

function MemoryMatch({ onComplete }: { onComplete: (pts: number) => void }) {
  const [cards, setCards]         = useState<Card[]>(buildCards);
  const [selected, setSelected]   = useState<number[]>([]);
  const [moves, setMoves]         = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [done, setDone]           = useState(false);
  const lockRef                   = useRef(false);

  const handleFlip = useCallback(
    (id: number) => {
      if (lockRef.current) return;
      setCards((prev) => {
        const card = prev[id];
        if (card.flipped || card.matched) return prev;
        return prev.map((c) => (c.id === id ? { ...c, flipped: true } : c));
      });
      setSelected((prev) => [...prev, id]);
    },
    []
  );

  // Check for match whenever two cards are selected
  useEffect(() => {
    if (selected.length !== 2) return;
    lockRef.current = true;
    const [a, b] = selected;

    setMoves((m) => m + 1);

    setCards((prev) => {
      const ca = prev[a];
      const cb = prev[b];
      if (ca.icon === cb.icon) {
        // Match!
        const next = prev.map((c) =>
          c.id === a || c.id === b ? { ...c, matched: true, flipped: true } : c
        );
        const newMatchCount = next.filter((c) => c.matched).length / 2;
        setTimeout(() => {
          setMatchedCount(newMatchCount);
          setSelected([]);
          lockRef.current = false;
          if (newMatchCount === ICONS.length) setDone(true);
        }, 400);
        return next;
      } else {
        // No match — flip back after delay
        setTimeout(() => {
          setCards((p) =>
            p.map((c) =>
              c.id === a || c.id === b ? { ...c, flipped: false } : c
            )
          );
          setSelected([]);
          lockRef.current = false;
        }, 800);
        return prev;
      }
    });
  }, [selected]);

  // Award points on completion
  useEffect(() => {
    if (done) {
      const pts = 50;
      onComplete(pts);
    }
  }, [done, onComplete]);

  const reset = () => {
    setCards(buildCards());
    setSelected([]);
    setMoves(0);
    setMatchedCount(0);
    setDone(false);
    lockRef.current = false;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Stats row */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-neutral-400">
          Moves: <span className="text-white font-semibold">{moves}</span>
        </span>
        <span className="text-neutral-400">
          Pairs:{" "}
          <span className="text-emerald-400 font-semibold">
            {matchedCount}/{ICONS.length}
          </span>
        </span>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* 4×4 Grid */}
      <div className="grid grid-cols-4 gap-2 w-full max-w-xs mx-auto">
        {cards.map((card) => (
          <motion.button
            key={card.id}
            onClick={() => handleFlip(card.id)}
            whileTap={{ scale: 0.92 }}
            className={`
              aspect-square rounded-xl text-xl flex items-center justify-center
              border transition-all duration-200 select-none
              ${
                card.flipped || card.matched
                  ? card.matched
                    ? "bg-emerald-500/20 border-emerald-500/40 scale-95"
                    : "bg-orange-500/20 border-orange-500/30"
                  : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600 cursor-pointer"
              }
            `}
          >
            <AnimatePresence mode="wait">
              {card.flipped || card.matched ? (
                <motion.span
                  key="face"
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {card.icon}
                </motion.span>
              ) : (
                <motion.span
                  key="back"
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="text-neutral-600 text-lg"
                >
                  ✦
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>

      {/* Completion banner */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4"
          >
            <Trophy className="mx-auto text-emerald-400 mb-1" size={28} />
            <p className="text-emerald-400 font-bold">You matched them all!</p>
            <p className="text-xs text-neutral-400 mt-1">
              +50 Loyalty Points earned in {moves} moves 🎉
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SpinWheel — SVG-based, 6 segments
// ─────────────────────────────────────────────────────────
const PRIZES = [
  { label: "5% Off",      color: "#f59e0b", points: 0,  emoji: "🏷️" },
  { label: "Free Drink",  color: "#3b82f6", points: 0,  emoji: "🧋" },
  { label: "2× Points",   color: "#8b5cf6", points: 100, emoji: "⭐" },
  { label: "Try Again",   color: "#6b7280", points: 0,  emoji: "🔄" },
  { label: "+25 Points",  color: "#10b981", points: 25, emoji: "🎯" },
  { label: "Free Cookie", color: "#ef4444", points: 0,  emoji: "🍪" },
];

const SEG_ANGLE = 360 / PRIZES.length; // 60°

function SpinWheel({ onComplete }: { onComplete: (pts: number, prize: string) => void }) {
  const [rotation, setRotation]   = useState(0);
  const [spinning, setSpinning]   = useState(false);
  const [prize, setPrize]         = useState<(typeof PRIZES)[0] | null>(null);
  const [spun, setSpun]           = useState(false);

  const spin = () => {
    if (spinning || spun) return;
    setSpinning(true);
    setPrize(null);

    // Random landing segment and extra full rotations for drama
    const landingIndex = Math.floor(Math.random() * PRIZES.length);
    const extraSpins   = 5 + Math.floor(Math.random() * 4); // 5–8 full rotations
    // Centre of landing segment (wheel spins clockwise, pointer is at top = 270° in SVG)
    const targetAngle  = landingIndex * SEG_ANGLE + SEG_ANGLE / 2;
    const totalRotation = rotation + extraSpins * 360 + (360 - targetAngle);

    setRotation(totalRotation);

    setTimeout(() => {
      setSpinning(false);
      setSpun(true);
      const won = PRIZES[landingIndex];
      setPrize(won);
      onComplete(won.points, won.label);
    }, 3500);
  };

  // Build SVG paths for each segment
  const R = 120; // radius
  const CX = 130;
  const CY = 130;

  const polarToCartesian = (angle: number) => ({
    x: CX + R * Math.sin((angle * Math.PI) / 180),
    y: CY - R * Math.cos((angle * Math.PI) / 180),
  });

  const segmentPath = (index: number) => {
    const startAngle = index * SEG_ANGLE;
    const endAngle   = startAngle + SEG_ANGLE;
    const start = polarToCartesian(startAngle);
    const end   = polarToCartesian(endAngle);
    const midAngle = startAngle + SEG_ANGLE / 2;
    const mid = {
      x: CX + (R * 0.6) * Math.sin((midAngle * Math.PI) / 180),
      y: CY - (R * 0.6) * Math.cos((midAngle * Math.PI) / 180),
    };
    return {
      d: `M ${CX} ${CY} L ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y} Z`,
      textX: mid.x,
      textY: mid.y,
      textAngle: midAngle,
    };
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Wheel with pointer */}
      <div className="relative flex items-center justify-center">
        {/* Pointer (triangle at top) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent border-t-white drop-shadow-md" />
        </div>

        {/* SVG wheel */}
        <motion.svg
          width="260"
          height="260"
          viewBox="0 0 260 260"
          style={{ rotate: rotation }}
          animate={{ rotate: rotation }}
          transition={
            spinning
              ? { duration: 3.5, ease: [0.2, 0.8, 0.4, 1] }
              : { duration: 0 }
          }
          className="drop-shadow-2xl"
        >
          {PRIZES.map((prize, i) => {
            const seg = segmentPath(i);
            return (
              <g key={i}>
                <path d={seg.d} fill={prize.color} stroke="#1a1a1a" strokeWidth="2" />
                <text
                  x={seg.textX}
                  y={seg.textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="white"
                  fontWeight="bold"
                  transform={`rotate(${seg.textAngle}, ${seg.textX}, ${seg.textY})`}
                >
                  {prize.emoji}
                </text>
              </g>
            );
          })}
          {/* Centre hub */}
          <circle cx={CX} cy={CY} r="16" fill="#1a1a1a" stroke="#374151" strokeWidth="2" />
          <circle cx={CX} cy={CY} r="6"  fill="#f59e0b" />
        </motion.svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-1.5 w-full max-w-xs">
        {PRIZES.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-neutral-400 truncate">{p.label}</span>
          </div>
        ))}
      </div>

      {/* Spin button */}
      {!spun ? (
        <motion.button
          onClick={spin}
          disabled={spinning}
          whileTap={{ scale: 0.95 }}
          className={`
            px-8 py-3 rounded-full font-bold text-sm transition-all
            ${spinning
              ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
              : "bg-gradient-to-r from-orange-500 to-amber-400 text-black hover:from-orange-400 hover:to-amber-300 shadow-lg shadow-orange-500/30"
            }
          `}
        >
          {spinning ? "Spinning..." : "🎰 Spin!"}
        </motion.button>
      ) : null}

      {/* Prize modal */}
      <AnimatePresence>
        {prize && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full text-center rounded-2xl p-4"
            style={{
              background: `${prize.color}22`,
              border: `1px solid ${prize.color}44`,
            }}
          >
            <p className="text-3xl mb-1">{prize.emoji}</p>
            <p className="font-bold text-white text-lg">{prize.label}!</p>
            {prize.points > 0 && (
              <p className="text-xs text-neutral-400 mt-1">
                +{prize.points} Loyalty Points added!
              </p>
            )}
            <p className="text-xs text-neutral-500 mt-2 italic">
              Show this screen at the counter to redeem.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// WaitTimeGames — main component
// ─────────────────────────────────────────────────────────
export default function WaitTimeGames() {
  const [tab, setTab]           = useState<"memory" | "spin">("memory");
  const [points, setPoints]     = useState<number>(getPoints);
  const [notification, setNotification] = useState<string | null>(null);

  const notifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    if (notifyTimer.current) clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setNotification(null), 3000);
  };

  const handleMemoryComplete = useCallback((pts: number) => {
    const next = addPoints(pts);
    setPoints(next);
    showNotification(`+${pts} Loyalty Points! Total: ${next} pts`);
  }, []);

  const handleSpinComplete = useCallback((pts: number, prize: string) => {
    if (pts > 0) {
      const next = addPoints(pts);
      setPoints(next);
      showNotification(`🎉 ${prize} — +${pts} pts! Total: ${next} pts`);
    } else {
      showNotification(`🎉 You won: ${prize}! Show this at the counter.`);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Gamepad2 className="text-orange-400" size={18} />
          <h3 className="font-semibold text-sm text-neutral-200">
            Wait Time Games
          </h3>
          <span className="text-xs text-neutral-500">
            — earn Loyalty Points!
          </span>
        </div>
        {/* Points badge */}
        <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full">
          <Star size={12} className="text-amber-400" />
          <span className="text-xs font-bold text-amber-400">{points} pts</span>
        </div>
      </div>

      {/* Points notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2"
          >
            <p className="text-xs text-emerald-400 font-medium text-center">
              {notification}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        {(["memory", "spin"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              flex-1 text-xs font-semibold py-2.5 transition-colors
              ${
                tab === t
                  ? "text-orange-400 border-b-2 border-orange-400"
                  : "text-neutral-500 hover:text-neutral-300 border-b-2 border-transparent"
              }
            `}
          >
            {t === "memory" ? "🃏 Memory Match" : "🎰 Spin the Wheel"}
          </button>
        ))}
      </div>

      {/* Game area */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {tab === "memory" ? (
            <motion.div
              key="memory"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
            >
              {/* Prize info banner */}
              <div className="flex items-center gap-2 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <Gift size={13} className="text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">
                  Match all 8 pairs to earn <strong>+50 Loyalty Points</strong>!
                </p>
              </div>
              <MemoryMatch onComplete={handleMemoryComplete} />
            </motion.div>
          ) : (
            <motion.div
              key="spin"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {/* Prize info banner */}
              <div className="flex items-center gap-2 mb-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2">
                <Gift size={13} className="text-purple-400 shrink-0" />
                <p className="text-xs text-purple-400">
                  Spin once per order — win discounts, free items, or bonus points!
                </p>
              </div>
              <SpinWheel onComplete={handleSpinComplete} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
