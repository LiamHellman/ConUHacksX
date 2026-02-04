// Shared highlight logic for both webapp and extension
// Exports: buildHighlightSpans, severityRank

/**
 * Severity ranking for findings
 */
export function severityRank(sev) {
  switch (sev) {
    case "high": return 3;
    case "medium": return 2;
    case "low":
    default: return 1;
  }
}

/**
 * Given overlapping findings, produce a NON-overlapping list suitable for highlighting.
 * - Partition text into boundary intervals (all starts/ends)
 * - For each interval, pick the "best" covering finding by severity/confidence/length
 * - Merge adjacent intervals with the same finding-set
 */
export function buildHighlightSpans(text, findings) {
  if (!text || !Array.isArray(findings) || findings.length === 0) return [];
  const n = text.length;
  const boundaries = new Set([0, n]);
  for (const f of findings) {
    if (!f) continue;
    const s = Math.max(0, Math.min(n, f.start));
    const e = Math.max(0, Math.min(n, f.end));
    if (e > s) {
      boundaries.add(s);
      boundaries.add(e);
    }
  }
  const pts = Array.from(boundaries).sort((a, b) => a - b);
  const pickBest = (cands) => {
    let best = null;
    let bestScore = -Infinity;
    for (const f of cands) {
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
  };
  // Build raw spans
  const spans = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b <= a) continue;
    const active = findings.filter((f) => f.start <= a && f.end >= b);
    if (active.length === 0) continue;
    // Stable key so we can merge adjacent spans with same active set
    const key = active.map((f) => f.id).sort().join("|");
    spans.push({
      start: a,
      end: b,
      quote: text.slice(a, b),
      findings: active,
      primary: pickBest(active),
      _key: key,
    });
  }
  if (spans.length === 0) return [];
  // Merge adjacent spans if the active finding-set is identical
  const merged = [];
  let cur = spans[0];
  for (let i = 1; i < spans.length; i++) {
    const nxt = spans[i];
    if (nxt.start === cur.end && nxt._key === cur._key) {
      cur = {
        ...cur,
        end: nxt.end,
        quote: text.slice(cur.start, nxt.end),
      };
    } else {
      merged.push(cur);
      cur = nxt;
    }
  }
  merged.push(cur);
  return merged.map(({ _key, ...rest }) => rest);
}
