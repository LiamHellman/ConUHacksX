import { useRef, useEffect, useState } from "react";

/**
 * Dark-theme friendly OKLCH palette (no "success green"):
 * - bias: magenta
 * - fallacy: amber
 * - tactic: cyan
 * - factcheck: violet (reserved / optional)
 */
const TYPE_OKLCH = {
  bias: { L: 0.72, C: 0.14, h: 340 },
  fallacy: { L: 0.74, C: 0.13, h: 75 },
  tactic: { L: 0.74, C: 0.12, h: 210 },
  factcheck: { L: 0.72, C: 0.13, h: 280 },
};

function severityAlpha(sev) {
  switch (sev) {
    case "high":
      return 0.40;
    case "medium":
      return 0.26;
    case "low":
    default:
      return 0.14;
  }
}

// --- OKLCH -> OKLab
function oklchToOklab({ L, C, h }) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  return { L, a, b };
}

// --- OKLab -> linear sRGB (Björn Ottosson OKLab)
function oklabToLinearSRGB({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return { r, g, b: bl };
}

function linearToSRGBChannel(x) {
  x = Math.min(1.0, Math.max(0.0, x));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/**
 * Blend in OKLab space (commutative):
 * - weight each category color by severityAlpha
 * - mix OKLab via weighted average
 * - compute a combined alpha: 1 - Π(1 - a_i), then cap
 */
function blendedBg(findings) {
  const cands = (findings || []).filter(Boolean);
  if (cands.length === 0) return null;

  let wSum = 0;
  let LSum = 0,
    aSum = 0,
    bSum = 0;

  let alphaComp = 1;

  for (const f of cands) {
    const oklch = TYPE_OKLCH[f.type] || TYPE_OKLCH.factcheck;
    const lab = oklchToOklab(oklch);
    const w = severityAlpha(f.severity);

    wSum += w;
    LSum += lab.L * w;
    aSum += lab.a * w;
    bSum += lab.b * w;

    alphaComp *= 1 - w;
  }

  const labMix = { L: LSum / wSum, a: aSum / wSum, b: bSum / wSum };
  const lin = oklabToLinearSRGB(labMix);

  const r = Math.round(255 * linearToSRGBChannel(lin.r));
  const g = Math.round(255 * linearToSRGBChannel(lin.g));
  const b = Math.round(255 * linearToSRGBChannel(lin.b));

  const baseAlpha = Math.min(0.40, 1 - alphaComp);

  return { r, g, b, baseAlpha };
}

function severityRank(sev) {
  switch (sev) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}

function pickPrimary(findings) {
  let best = null;
  let bestScore = -Infinity;

  for (const f of findings || []) {
    const sRank = severityRank(f.severity);
    const conf = typeof f.confidence === "number" ? f.confidence : 0;
    const len = Math.max(0, (f.end ?? 0) - (f.start ?? 0));
    const score = sRank * 1000 + conf * 100 + len * 0.001;

    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function ringClassForType(type) {
  switch (type) {
    case "bias":
      return "ring-pink-400";
    case "fallacy":
      return "ring-amber-400";
    case "tactic":
      return "ring-blue-400";
    case "factcheck":
      return "ring-purple-400";
    default:
      return "ring-purple-400";
  }
}

export default function DocumentViewer({
  content,
  spans,
  selectedFinding,
  onSelectFinding,
}) {
  const containerRef = useRef(null);
  const [renderSegments, setRenderSegments] = useState([]);

  // Optional: local hover alpha without relying on CSS files
  const [hoveredIdx, setHoveredIdx] = useState(null);

  useEffect(() => {
    if (!content) {
      setRenderSegments([]);
      return;
    }

    const hs = Array.isArray(spans)
      ? [...spans].sort((a, b) => a.start - b.start)
      : [];

    if (hs.length === 0) {
      setRenderSegments([{ text: content, span: null }]);
      return;
    }

    const segs = [];
    let lastEnd = 0;

    for (const sp of hs) {
      if (sp.start > lastEnd) {
        segs.push({ text: content.slice(lastEnd, sp.start), span: null });
      }
      segs.push({ text: content.slice(sp.start, sp.end), span: sp });
      lastEnd = sp.end;
    }

    if (lastEnd < content.length) {
      segs.push({ text: content.slice(lastEnd), span: null });
    }

    setRenderSegments(segs);
  }, [content, spans]);

  const baseClass =
    "cursor-pointer transition-all duration-200 rounded px-0.5 -mx-0.5 hover:brightness-110";

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        {/* Keep your existing empty state here if you had one */}
        <p className="text-gray-500 text-sm">No document loaded.</p>
      </div>
    );
  }

  const hasSelection = !!selectedFinding;

  const segIsSelected = (seg) => {
    if (!hasSelection || !seg?.span) return false;
    const fList = seg.span.findings || [];
    return fList.some((f) => f.id === selectedFinding.id);
  };

  const ringClass = hasSelection
    ? `ring-2 ring-offset-2 ring-offset-dark-800 ${ringClassForType(
        selectedFinding.type
      )}`
    : "";

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Document</h2>
        {spans && spans.length > 0 && (
          <div className="document-legend flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-pink-400" />
              <span className="text-gray-400">Bias</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-gray-400">Fallacy</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-gray-400">Tactic</span>
            </span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="document-content flex-1 overflow-y-auto p-6">
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
            {(() => {
              const out = [];
              let i = 0;

              while (i < renderSegments.length) {
                const seg = renderSegments[i];

                // Plain (non-highlight) text: render as-is.
                if (!seg.span) {
                  out.push(<span key={`t-${i}`}>{seg.text}</span>);
                  i++;
                  continue;
                }

                // Highlighted but NOT part of current selection: render normally (no ring).
                if (!segIsSelected(seg)) {
                  const fList = seg.span.findings || [];
                  const primary = seg.span.primary || pickPrimary(fList);
                  const mix = blendedBg(fList);

                  if (!mix) {
                    out.push(<span key={`h-${i}`}>{seg.text}</span>);
                    i++;
                    continue;
                  }

                  const alpha = hoveredIdx === i ? 0.10 : mix.baseAlpha;

                  out.push(
                    <span
                      key={`h-${i}`}
                      className={baseClass}
                      style={{
                        backgroundColor: `rgba(${mix.r}, ${mix.g}, ${mix.b}, ${alpha})`,
                      }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onClick={() => onSelectFinding(primary)}
                      title={
                        fList.length > 1
                          ? `Overlaps: ${fList.map((f) => f.label).join(", ")}`
                          : primary?.label || ""
                      }
                    >
                      {seg.text}
                    </span>
                  );

                  i++;
                  continue;
                }

                // Selected run: group consecutive selected segments and wrap them in ONE ring.
                const start = i;
                const group = [];
                while (i < renderSegments.length && segIsSelected(renderSegments[i])) {
                  group.push({ seg: renderSegments[i], idx: i });
                  i++;
                }

                out.push(
                  <span
                    key={`sel-${start}`}
                    // box-decoration-clone makes the ring behave better across line wraps
                    className={`box-decoration-clone rounded px-0.5 -mx-0.5 ${ringClass}`}
                  >
                    {group.map(({ seg: gSeg, idx }) => {
                      const fList = gSeg.span.findings || [];
                      const primary = gSeg.span.primary || pickPrimary(fList);
                      const mix = blendedBg(fList);

                      if (!mix) return <span key={`sel-inner-${idx}`}>{gSeg.text}</span>;

                      const alpha = hoveredIdx === idx ? 0.10 : mix.baseAlpha;

                      return (
                        <span
                          key={`sel-inner-${idx}`}
                          className={baseClass}
                          style={{
                            backgroundColor: `rgba(${mix.r}, ${mix.g}, ${mix.b}, ${alpha})`,
                          }}
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          onClick={() => onSelectFinding(primary)}
                          title={
                            fList.length > 1
                              ? `Overlaps: ${fList.map((f) => f.label).join(", ")}`
                              : primary?.label || ""
                          }
                        >
                          {gSeg.text}
                        </span>
                      );
                    })}
                  </span>
                );
              }

              return out;
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}