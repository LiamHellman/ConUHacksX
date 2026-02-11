import { useEffect, useMemo, useState } from "react";

// Paper palette category colors
const TYPE_HEX = {
  bias: "#c44030",
  fallacy: "#b8860b",
  tactic: "#2e7d6e",
  factcheck: "#7850a0",
};

// Backward-compatible mapping
const COLOR_TO_TYPE = {
  pink: "bias",
  amber: "fallacy",
  blue: "tactic",
  purple: "factcheck",
};

export default function ScoreCard({
  label,
  score,
  type,
  color,
  description,
  max = 100,
}) {
  const resolvedType = useMemo(() => {
    if (type) return type;
    if (color && COLOR_TO_TYPE[color]) return COLOR_TO_TYPE[color];
    return "factcheck";
  }, [type, color]);

  const typeColor = TYPE_HEX[resolvedType] || TYPE_HEX.factcheck;

  // Circle geometry
  const r = 36;
  const circumference = 2 * Math.PI * r;

  const normalized = useMemo(() => {
    let v = Number(score);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(max, v));
    return v;
  }, [score, max]);

  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    setAnimatedValue(normalized);
  }, [normalized]);

  const fraction = max > 0 ? animatedValue / max : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div
      className="scorecard p-5 border bg-white"
      style={{ borderColor: "#ddd6ca" }}
    >
      <div className="scorecard-row flex items-center gap-5">
        {/* Circular progress — thin SVG ring */}
        <div className="scorecard-circle relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={r}
              stroke="#ede7db"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="40"
              cy="40"
              r={r}
              stroke={typeColor}
              strokeWidth="4"
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="scorecard-value text-xl font-bold"
              style={{ color: typeColor, fontFamily: "var(--font-serif)" }}
            >
              {Math.round(normalized)}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="scorecard-labels flex-1">
          <h3 className="text-text-primary font-semibold mb-1">{label}</h3>
          <p className="text-sm text-text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
