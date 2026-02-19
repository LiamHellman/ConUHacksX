import { useRef, useEffect, useState } from "react";
import { TYPE_OKLAB, TYPE_OKLAB_DARK, TYPE_HEX, TYPE_HEX_DARK, CATEGORIES, oklabToSrgb } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";

function severityAlpha(sev) {
  switch (sev) {
    case "high":
      return 0.18;
    case "medium":
      return 0.12;
    case "low":
    default:
      return 0.07;
  }
}

/**
 * OKLab-space blending for overlapping findings on paper/white background.
 * Blending in OKLab produces perceptually linear intermediate colors
 * (e.g. blue + gold → green, not gray).
 * Returns { r, g, b, baseAlpha } for use in rgba().
 */
function blendedBg(findings, oklabMap) {
  const cands = (findings || []).filter(Boolean);
  if (cands.length === 0) return null;

  let Lsum = 0, aSum = 0, bSum = 0, wSum = 0;
  let alphaComp = 1;

  for (const f of cands) {
    const lab = oklabMap[f.type] || oklabMap.factcheck;
    const w = severityAlpha(f.severity);
    Lsum += lab.L * w;
    aSum += lab.a * w;
    bSum += lab.b * w;
    wSum += w;
    alphaComp *= 1 - w;
  }

  // Convert blended OKLab back to sRGB
  const rgb = oklabToSrgb({ L: Lsum / wSum, a: aSum / wSum, b: bSum / wSum });

  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    baseAlpha: Math.min(0.20, 1 - alphaComp),
  };
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

function borderColorForType(type, hexMap) {
  return hexMap[type] || hexMap.structure;
}

export default function DocumentViewer({
  content,
  spans,
  selectedFinding,
  onSelectFinding,
}) {
  const { theme } = useTheme();
  const oklabMap = theme === 'dark' ? TYPE_OKLAB_DARK : TYPE_OKLAB;
  const hexMap = theme === 'dark' ? TYPE_HEX_DARK : TYPE_HEX;
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
    "cursor-pointer transition-all duration-200 px-0.5 -mx-0.5 hover:opacity-80";

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <p className="text-text-faint text-sm italic">No document loaded</p>
      </div>
    );
  }

  const hasSelection = !!selectedFinding;

  const segIsSelected = (seg) => {
    if (!hasSelection || !seg?.span) return false;
    const fList = seg.span.findings || [];
    return fList.some((f) => f.id === selectedFinding.id);
  };

  // Bottom-border accent on selected text (editorial style)
  const selectedBorderColor = hasSelection
    ? borderColorForType(selectedFinding.type, hexMap)
    : "transparent";

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>Document</h2>
        {spans && spans.length > 0 && (
          <div className="document-legend flex items-center gap-3 text-xs flex-wrap">
            {CATEGORIES.map(({ key, label }) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2" style={{ backgroundColor: hexMap[key] }} />
                <span className="text-text-muted">{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="document-content flex-1 overflow-y-auto p-6">
        <div className="prose max-w-none">
          <p className="text-text-body leading-relaxed whitespace-pre-wrap text-base">
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
                  const mix = blendedBg(fList, oklabMap);

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

                // Selected run: group consecutive selected segments and wrap with bottom-border accent.
                const start = i;
                const group = [];
                while (i < renderSegments.length && segIsSelected(renderSegments[i])) {
                  group.push({ seg: renderSegments[i], idx: i });
                  i++;
                }

                out.push(
                  <span
                    key={`sel-${start}`}
                    className="px-0.5 -mx-0.5"
                    style={{
                      borderBottom: `2px solid ${selectedBorderColor}`,
                      paddingBottom: "1px",
                    }}
                  >
                    {group.map(({ seg: gSeg, idx }) => {
                      const fList = gSeg.span.findings || [];
                      const primary = gSeg.span.primary || pickPrimary(fList);
                      const mix = blendedBg(fList, oklabMap);

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