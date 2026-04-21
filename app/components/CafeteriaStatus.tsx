"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, Zap, ChevronRight } from "lucide-react";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type CrowdLevel = "quiet" | "moderate" | "busy";

interface CafeteriaData {
  level: CrowdLevel;
  waitMin: number;
  waitMax: number;
  label: string;
  emoji: string;
  description: string;
}

// ─────────────────────────────────────────────────────────
// Helpers — derive crowd level from the current hour/minute
// Campus schedule logic:
//   11:30–13:30  → 🔴 Busy      (peak lunch rush)
//   10:00–11:30  → 🟡 Moderate  (pre-lunch build-up)
//   13:30–14:30  → 🟡 Moderate  (post-lunch tail)
//   else         → 🟢 Quiet
// ─────────────────────────────────────────────────────────
function getCafeteriaData(now: Date = new Date()): CafeteriaData {
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  const PEAK_START = 11 * 60 + 30;  // 11:30
  const PEAK_END   = 13 * 60 + 30;  // 13:30
  const PRE_START  = 10 * 60;        // 10:00
  const POST_END   = 14 * 60 + 30;  // 14:30

  if (totalMinutes >= PEAK_START && totalMinutes < PEAK_END) {
    // Add slight variation within the busy window
    const peakProgress = (totalMinutes - PEAK_START) / (PEAK_END - PEAK_START);
    const midPeak = peakProgress > 0.3 && peakProgress < 0.7;
    return {
      level: "busy",
      waitMin: midPeak ? 22 : 18,
      waitMax: midPeak ? 35 : 28,
      label: "Busy",
      emoji: "🔴",
      description: "Lunch rush is on — queue building fast",
    };
  }

  if (
    (totalMinutes >= PRE_START && totalMinutes < PEAK_START) ||
    (totalMinutes >= PEAK_END && totalMinutes < POST_END)
  ) {
    return {
      level: "moderate",
      waitMin: 8,
      waitMax: 15,
      label: "Moderate",
      emoji: "🟡",
      description: "Steady flow — reasonable wait expected",
    };
  }

  return {
    level: "quiet",
    waitMin: 2,
    waitMax: 5,
    label: "Quiet",
    emoji: "🟢",
    description: "Great time to order — almost no queue",
  };
}

// ─────────────────────────────────────────────────────────
// Colour mappings per crowd level
// ─────────────────────────────────────────────────────────
const LEVEL_STYLES: Record<
  CrowdLevel,
  { pill: string; bar: string; border: string; glow: string }
> = {
  quiet: {
    pill:   "bg-emerald-500/20 text-emerald-400",
    bar:    "bg-emerald-500",
    border: "border-emerald-500/20",
    glow:   "shadow-emerald-500/10",
  },
  moderate: {
    pill:   "bg-amber-500/20 text-amber-400",
    bar:    "bg-amber-500",
    border: "border-amber-500/20",
    glow:   "shadow-amber-500/10",
  },
  busy: {
    pill:   "bg-red-500/20 text-red-400",
    bar:    "bg-red-500",
    border: "border-red-500/20",
    glow:   "shadow-red-500/10",
  },
};

// ─────────────────────────────────────────────────────────
// Fill percentage for visual bar
// ─────────────────────────────────────────────────────────
const LEVEL_FILL: Record<CrowdLevel, number> = {
  quiet:    20,
  moderate: 58,
  busy:     90,
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
interface CafeteriaStatusProps {
  /** Called when user clicks "Pre-Order to Skip the Queue" CTA */
  onPreOrderClick?: () => void;
}

export default function CafeteriaStatus({ onPreOrderClick }: CafeteriaStatusProps) {
  const [data, setData]       = useState<CafeteriaData>(() => getCafeteriaData());
  const [tick, setTick]       = useState(0); // drives the "last updated" clock
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh data every 60 seconds (simulating a live feed)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setData(getCafeteriaData());
      setTick((t) => t + 1);
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const styles  = LEVEL_STYLES[data.level];
  const fill    = LEVEL_FILL[data.level];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`
        mx-4 md:mx-8 mt-4 mb-2
        rounded-2xl border ${styles.border}
        bg-neutral-900/60 backdrop-blur-sm
        shadow-lg ${styles.glow}
        p-4
      `}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">

        {/* ── Left: Icon + Label ── */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-xl ${styles.pill} shrink-0`}>
            <Users size={16} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Cafeteria Status
              </span>
              {/* Animated live dot */}
              <span className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${styles.bar} ${
                    data.level === "busy" ? "animate-pulse" : ""
                  }`}
                />
                <span className="text-xs text-neutral-500">Live</span>
              </span>
            </div>

            {/* Crowd label + description */}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${styles.pill}`}>
                {data.emoji} {data.label}
              </span>
              <span className="text-xs text-neutral-500 truncate hidden sm:block">
                {data.description}
              </span>
            </div>
          </div>
        </div>

        {/* ── Centre: Visual capacity bar + wait time ── */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Mobile description */}
          <p className="text-xs text-neutral-500 sm:hidden">{data.description}</p>

          {/* Capacity bar */}
          <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${styles.bar} rounded-full`}
              initial={{ width: "0%" }}
              animate={{ width: `${fill}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {/* Wait time */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Clock size={11} className="shrink-0" />
            <AnimatePresence mode="wait">
              <motion.span
                key={`${data.level}-${tick}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                {data.level === "quiet"
                  ? `Est. ${data.waitMin}–${data.waitMax} min wait`
                  : `Est. ${data.waitMin}–${data.waitMax} min wait for walk-in`}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right: Pre-Order CTA ── */}
        {data.level !== "quiet" && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onClick={onPreOrderClick}
            className={`
              shrink-0 flex items-center gap-1.5
              text-xs font-semibold px-3 py-2 rounded-xl
              ${styles.pill}
              border ${styles.border}
              hover:scale-105 active:scale-95
              transition-transform cursor-pointer
              whitespace-nowrap
            `}
          >
            <Zap size={13} />
            Skip the Queue
            <ChevronRight size={11} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
