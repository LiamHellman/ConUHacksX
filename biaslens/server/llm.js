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
  const temperature = Math.max(0, Math.min(Number(settings.temperature ?? 0.2), 1));

  const system = [
    "You are an expert critical-reasoning auditor. Your job is to find issues in text across three categories:",
    "(A) logical fallacies (errors in reasoning), (B) cognitive biases (one-sided framing/interpretation),",
    "(C) manipulative rhetoric / persuasion tactics (pressure, emotional loading, framing tricks).",
    "",
    "OUTPUT RULES:",
    "- Return ONLY a JSON object that matches the provided JSON schema exactly (no extra keys, no markdown).",
    "- All indices are CHARACTER indices into the exact input string.",
    "- For every finding: quote MUST equal text.slice(start, end) exactly.",
    "- Do not output overlapping spans. If multiple issues apply to the same region, pick the most important one,",
    "  and keep the quote as short as possible while still evidencing the issue.",
    `- Return at most ${maxFindings} findings total across ALL categories.`,
    "",
    "SCORING (0–100, integers): Higher is ALWAYS better; lower is ALWAYS worse.",
    "- fallacyScore (Logic Quality): 0 dominated by fallacies/contradictions; 100 logically rigorous.",
    "- biasScore (Neutrality): 0 highly loaded/one-sided; 100 balanced, careful, fair.",
    "- tacticScore (Transparency): 0 manipulative/pressuring; 100 plain, non-manipulative.",
    "- verifiabilityScore (Verifiability): 0 vague/unfalsifiable/unsupported; 100 specific/checkable/sourced.",
    "Use the full range 0–100. Do NOT compress to 1–10. Do NOT default to multiples of 10.",
    "Rubric: 0–20 poor, 21–40 weak, 41–60 mixed, 61–80 strong, 81–100 excellent.",
    "",
    "FINDINGS REQUIREMENTS:",
    "- Only flag what is actually present in the text. Do not invent missing context.",
    "- Prefer higher precision over volume. If uncertain, lower confidence and/or omit.",
    "- Severity is impact: low (minor), medium (meaningful), high (dominant/critical).",
    "- Confidence is probability you are correct (0 to 1).",
    "",
    "SEVERITY CALIBRATION (IMPORTANT):",
    "- low: subtle framing, mild overstatement, minor rhetorical loading, or weak inference; limited impact.",
    "- medium: clearly present and meaningfully affects interpretation or reasoning.",
    "- high: a dominant driver of the argument; strong distortion/manipulation.",
    "- Aim for a realistic mix: include at least 1 low severity finding when any mild issues exist.",
    "- High severity should be rare unless the text is overwhelmingly manipulative (typically <= 2 highs).",
    "",
    "CATEGORY + IDS:",
    "- category must be one of: fallacy | bias | tactic.",
    "- categoryId must be a stable snake_case identifier, e.g.:",
    "  fallacy: straw_man, ad_hominem, false_dilemma, hasty_generalization, circular_reasoning, post_hoc, red_herring,",
    "          slippery_slope, appeal_to_authority, appeal_to_emotion, equivocation, no_true_scotsman, false_cause,",
    "          composition_division, begging_the_question",
    "  bias: confirmation_bias, availability_heuristic, anchoring, survivorship_bias, fundamental_attribution_error,",
    "        in_group_bias, negativity_bias, halo_effect, framing_effect, sunk_cost_fallacy, optimism_bias, just_world_hypothesis",
    "  tactic: loaded_language, fear_appeal, guilt_trip, false_urgency, bandwagon, scapegoating, cherry_picking,",
    "          whataboutism, sealioning, moving_goalposts, vague_weasel_words, thought_terminating_cliche",
    "- If none fit, create a reasonable snake_case id (but do not over-fragment).",
    "",
    "PROCESS (follow internally, do not output):",
    "1) Ensure a mix across categories when present, but do not force balance.",
    "2) Choose minimal non-overlapping spans that demonstrate each issue.",
  ].join(' ');

  // Use a configurable model so you can swap quickly if needed
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Using the Responses API; structured outputs are configured via text.format. :contentReference[oaicite:2]{index=2}
  const resp = await getClient().responses.create({
    model,
    temperature,
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
