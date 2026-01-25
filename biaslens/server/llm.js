// server/llm.js
import OpenAI from "openai";

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const ARGUMENT_SCHEMA = {
  name: "argument_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overall", "findings"],
    properties: {
      overall: {
        type: "object",
        additionalProperties: false,
        required: ["fallacyScore", "biasScore", "tacticScore", "verifiabilityScore"],
        properties: {
          fallacyScore: { type: "integer", minimum: 0, maximum: 100 },
          biasScore: { type: "integer", minimum: 0, maximum: 100 },
          tacticScore: { type: "integer", minimum: 0, maximum: 100 },
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
            "category",
            "categoryId",
            "label",
            "severity",
            "confidence",
            "start",
            "end",
            "quote",
            "explanation"
          ],
          properties: {
            id: { type: "string" },

            // category determines tabs + highlight color in UI
            category: { type: "string", enum: ["fallacy", "bias", "tactic"] },

            // e.g. "straw_man", "confirmation_bias", "loaded_language"
            categoryId: { type: "string" },

            // human-friendly label
            label: { type: "string" },

            // drives highlight intensity
            severity: { type: "string", enum: ["low", "medium", "high"] },

            confidence: { type: "number", minimum: 0, maximum: 1 },
            start: { type: "integer", minimum: 0 },
            end: { type: "integer", minimum: 0 },

            // MUST match text.slice(start, end)
            quote: { type: "string" },

            // why it was flagged
            explanation: { type: "string" }
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
    "You analyze text for (1) logical fallacies, (2) cognitive biases, and (3) manipulative rhetoric/persuasion tactics.",
    "Return ONLY a JSON object that matches the provided schema.",
    "All indices are CHARACTER indices into the exact input string.",
    "For each finding: quote MUST equal text.slice(start, end) exactly.",
    "Do not produce overlapping spans.",
    `Return at most ${maxFindings} findings total across ALL categories.`,
    "Try to include a balanced mix across fallacy/bias/tactic when present, but do not invent findings.",
    "Severity should reflect impact on reasoning/manipulation: low, medium, high.",
    "If uncertain, return fewer findings with lower confidence."
  ].join(" ");

  // Use a configurable model so you can swap quickly if needed
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Using the Responses API; structured outputs are configured via text.format. :contentReference[oaicite:2]{index=2}
  const resp = await getClient().responses.create({
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "argument_analysis",
        strict: true,
        schema: ARGUMENT_SCHEMA.schema,
      },
    },
  });

  // The SDK returns a convenience string, but we want the parsed JSON
  // In practice, you can parse resp.output_text; structured outputs ensures validity.
  const raw = resp.output_text;
  const parsed = JSON.parse(raw);

  // hardening: clamp/repair spans + remove overlaps
  parsed.findings = clampFindingsToText(text, parsed.findings || []);

  parsed.scores = {
    // keep existing keys so ScoreCards/ControlBar logic doesn’t break
    fallacies: parsed.overall?.fallacyScore ?? 0,
    bias: parsed.overall?.biasScore ?? 0,
    tactic: parsed.overall?.tacticScore ?? 0,
    factcheck: parsed.overall?.verifiabilityScore ?? 0,
  };

  parsed.findings = (parsed.findings || []).map((f) => ({
    ...f,

    // UI expects `type` for highlighting; map it from category
    type: f.category,

    // UI sometimes expects originalText
    originalText: f.quote,

    // Back-compat helpers (optional but useful for InsightsPanel rendering)
    fallacyId: f.category === "fallacy" ? f.categoryId : undefined,
    biasId: f.category === "bias" ? f.categoryId : undefined,
    tacticId: f.category === "tactic" ? f.categoryId : undefined,
  }));

  return parsed;
}
