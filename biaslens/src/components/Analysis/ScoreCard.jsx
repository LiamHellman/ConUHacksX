import { useEffect, useMemo, useState } from "react";

export default function ScoreCard({ label, score, color, description, max = 100 }) {
  const colorStyles = {
    pink: { stroke: "#f472b6", bg: "bg-pink-500/10", text: "text-pink-400" },
    amber: { stroke: "#fbbf24", bg: "bg-amber-500/10", text: "text-amber-400" },
    blue: { stroke: "#60a5fa", bg: "bg-blue-500/10", text: "text-blue-400" },
    purple: { stroke: "#a78bfa", bg: "bg-purple-500/10", text: "text-purple-400" },
  };

  const styles = colorStyles[color] || colorStyles.purple;

  // Circle geometry
  const r = 36;
  const circumference = 2 * Math.PI * r;

  // Normalize + (optional) auto-scale 0–10 => 0–100
  const normalized = useMemo(() => {
    let v = Number(score);
    if (!Number.isFinite(v)) v = 0;

    v = Math.max(0, Math.min(max, v));
    return v;
  }, [score, max]);

  // Animate the fill procedurally by animating the value -> dashoffset
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    // Start from the previous value; CSS transition handles the smooth fill.
    // If you want it to "replay" from 0 every time, setAnimatedValue(0) first.
    setAnimatedValue(normalized);
  }, [normalized]);

  const fraction = max > 0 ? animatedValue / max : 0; // 0..1
  const dashOffset = circumference * (1 - fraction);  // 0 => full, C => empty

  return (
    <div className={`p-5 rounded-xl ${styles.bg} border border-dark-600`}>
      <div className="flex items-center gap-5">
        {/* Circular progress */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="40"
              cy="40"
              r={r}
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-dark-600"
            />
            {/* Progress circle */}
            <circle
              cx="40"
              cy="40"
              r={r}
              stroke={styles.stroke}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>

          {/* Score text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${styles.text}`}>
              {Math.round(normalized)}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">{label}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
}
