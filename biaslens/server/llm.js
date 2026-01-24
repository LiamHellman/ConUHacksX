// server/llm.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FALLACY_SCHEMA = {
  name: "fallacy_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overall", "findings"],
    properties: {
      overall: {
        type: "object",
        additionalProperties: false,
        required: ["logicScore", "biasScore", "verifiabilityScore"],
        properties: {
          logicScore: { type: "integer", minimum: 0, maximum: 100 },
          biasScore: { type: "integer", minimum: 0, maximum: 100 },
          verifiabilityScore: { type: "integer", minimum: 0, maximum: 100 }
        }
      },
      findings: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "fallacyId",
            "label",
            "severity",
            "confidence",
            "start",
            "end",
            "quote",
            "explanation",
            "suggestion"
          ],
          properties: {
            id: { type: "string" },
            fallacyId: { type: "string" }, // e.g., "ad_hominem", "strawman"
            label: { type: "string" },     // human-friendly
            severity: { type: "string", enum: ["low", "medium", "high"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            start: { type: "integer", minimum: 0 },
            end: { type: "integer", minimum: 0 },
            quote: { type: "string" },
            explanation: { type: "string" },
            suggestion: { type: "string" }
          }
        }
      }
    }
  }
};

function clampFindingsToText(text, findings) {
  const n = text.length;

  // 1) Try to validate/repair spans using quote matching
  const repaired = findings
    .map((f) => {
      let start = Number.isInteger(f.start) ? f.start : 0;
      let end = Number.isInteger(f.end) ? f.end : 0;

      // clamp
      start = Math.max(0, Math.min(start, n));
      end = Math.max(0, Math.min(end, n));
      if (end < start) [start, end] = [end, start];

      const slice = text.slice(start, end);

      if (slice !== f.quote && typeof f.quote === "string" && f.quote.length > 0) {
        // attempt repair by locating quote in text
        const idx = text.indexOf(f.quote);
        if (idx !== -1) {
          start = idx;
          end = idx + f.quote.length;
        }
      }

      // final check; if still invalid, drop it by returning null
      if (text.slice(start, end) !== f.quote) return null;

      return { ...f, start, end };
    })
    .filter(Boolean);

  // 2) Remove overlaps (keep higher severity, then higher confidence)
  const severityRank = { low: 1, medium: 2, high: 3 };

  repaired.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept = [];
  for (const f of repaired) {
    const last = kept[kept.length - 1];
    if (!last || f.start >= last.end) {
      kept.push(f);
      continue;
    }

    // overlap -> keep the better one
    const aScore = severityRank[last.severity] * 10 + last.confidence;
    const bScore = severityRank[f.severity] * 10 + f.confidence;

    if (bScore > aScore) {
      kept[kept.length - 1] = f;
    }
  }

  return kept.slice(0, 12);
}

export async function analyzeWithLLM(text, settings = {}) {
  const maxFindings = Math.max(1, Math.min(Number(settings.maxFindings ?? 10), 12));

  const system = [
    "You are a logical fallacy detector.",
    "Return ONLY a JSON object that matches the provided schema.",
    "All indices are CHARACTER indices into the exact input string.",
    "For each finding: quote MUST equal text.slice(start, end) exactly.",
    "Do not produce overlapping spans.",
    `Return at most ${maxFindings} findings.`,
    "If uncertain, return fewer findings with lower confidence."
  ].join(" ");

  // Use a configurable model so you can swap quickly if needed
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Using the Responses API; structured outputs are configured via text.format. :contentReference[oaicite:2]{index=2}
  const resp = await client.responses.create({
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: text }
    ],
    text: {
      format: {
        type: "json_schema",
        json_schema: FALLACY_SCHEMA
      }
    }
  });

  // The SDK returns a convenience string, but we want the parsed JSON
  // In practice, you can parse resp.output_text; structured outputs ensures validity.
  const raw = resp.output_text;
  const parsed = JSON.parse(raw);

  // hardening: clamp/repair spans + remove overlaps
  parsed.findings = clampFindingsToText(text, parsed.findings || []);

  return parsed;
}
