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
  compact = false,
}) {
  const resolvedType = useMemo(() => {
    if (type) return type;
    if (color && COLOR_TO_TYPE[color]) return COLOR_TO_TYPE[color];
    return "factcheck";
  }, [type, color]);

  const typeColor = TYPE_HEX[resolvedType] || TYPE_HEX.factcheck;

  // Circle geometry — smaller in compact mode
  const r = compact ? 22 : 36;
  const svgSize = compact ? 52 : 80;
  const cx = svgSize / 2;
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

  const sizeClass = compact ? "w-[52px] h-[52px]" : "w-20 h-20";

  return (
    <div
      className={`scorecard border bg-white ${compact ? "p-3" : "p-5"}`}
      style={{ borderColor: "#ddd6ca" }}
    >
      <div className={`scorecard-row flex items-center ${compact ? "flex-col text-center gap-2" : "gap-5"}`}>
        {/* Circular progress — thin SVG ring */}
        <div className={`scorecard-circle relative ${sizeClass} flex-shrink-0`}>
          <svg className={`${sizeClass} transform -rotate-90`} viewBox={`0 0 ${svgSize} ${svgSize}`}>
            <circle
              cx={cx}
              cy={cx}
              r={r}
              stroke="#ede7db"
              strokeWidth={compact ? 3 : 4}
              fill="none"
            />
            <circle
              cx={cx}
              cy={cx}
              r={r}
              stroke={typeColor}
              strokeWidth={compact ? 3 : 4}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`scorecard-value font-bold ${compact ? "text-sm" : "text-xl"}`}
              style={{ color: typeColor, fontFamily: "var(--font-serif)" }}
            >
              {Math.round(normalized)}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="scorecard-labels flex-1 min-w-0">
          <h3 className={`text-text-primary font-semibold ${compact ? "text-xs" : "mb-1"}`}>{label}</h3>
          {!compact && <p className="text-sm text-text-muted">{description}</p>}
        </div>
      </div>
    </div>
  );
}
