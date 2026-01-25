import { useEffect, useMemo, useState } from "react";

const BRAND_RGB = "var(--brand, var(--type-factcheck, 168 85 247))";
const typeRgbVar = (type) => `var(--type-${type}, ${BRAND_RGB})`;
const typeBg = (type, a) => `rgb(${typeRgbVar(type)} / ${a})`;
const typeFg = (type, a = 1) => `rgb(${typeRgbVar(type)} / ${a})`;

// Backward-compatible mapping (old API: color="pink|amber|blue|purple")
const COLOR_TO_TYPE = {
  pink: "bias",
  amber: "fallacy",
  blue: "tactic",
  purple: "factcheck",
};

export default function ScoreCard({
  label,
  score,
  // NEW API:
  type,
  // OLD API (kept for compatibility):
  color,
  description,
  max = 100,
}) {
  const resolvedType = useMemo(() => {
    if (type) return type;
    if (color && COLOR_TO_TYPE[color]) return COLOR_TO_TYPE[color];
    return "factcheck";
  }, [type, color]);

  // Circle geometry
  const r = 36;
  const circumference = 2 * Math.PI * r;

  // Normalize score
  const normalized = useMemo(() => {
    let v = Number(score);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(max, v));
    return v;
  }, [score, max]);

  // Animate the fill procedurally by animating the value -> dashoffset
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    setAnimatedValue(normalized);
  }, [normalized]);

  const fraction = max > 0 ? animatedValue / max : 0; // 0..1
  const dashOffset = circumference * (1 - fraction); // 0 => full, C => empty

  // Theme-driven styles
  const cardStyle = useMemo(
    () => ({
      backgroundColor: typeBg(resolvedType, 0.10),
      borderColor: typeBg(resolvedType, 0.22),
    }),
    [resolvedType]
  );

  const scoreStyle = useMemo(
    () => ({
      color: typeFg(resolvedType, 1),
    }),
    [resolvedType]
  );

  const progressStroke = useMemo(() => typeFg(resolvedType, 1), [resolvedType]);

  return (
    <div className="p-5 rounded-xl border" style={cardStyle}>
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
              stroke={progressStroke}
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
            <span className="text-xl font-bold" style={scoreStyle}>
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
