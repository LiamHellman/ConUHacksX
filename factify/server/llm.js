// server/llm.js
import { GoogleGenAI } from "@google/genai";

// ─── Developer toggle ────────────────────────────────────────────────────────
// Flip USE_NLP_SERVICE to true to route /api/analyze through the Python NLP
// micro-service instead of Gemini.  Not exposed to users.
const USE_NLP_SERVICE = false;
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL ?? 'http://localhost:8000';

let ai = null;

function getClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
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
        required: [
          "structureScore",
          "relevanceScore",
          "evidenceScore",
          "framingScore",
          "languageScore",
          "verifiabilityScore",
        ],
        properties: {
          structureScore:     { type: "integer", minimum: 0, maximum: 100 },
          relevanceScore:     { type: "integer", minimum: 0, maximum: 100 },
          evidenceScore:      { type: "integer", minimum: 0, maximum: 100 },
          framingScore:       { type: "integer", minimum: 0, maximum: 100 },
          languageScore:      { type: "integer", minimum: 0, maximum: 100 },
          verifiabilityScore: { type: "integer", minimum: 0, maximum: 100 },
        },
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
            "explanation",
          ],
          properties: {
            id: { type: "string" },

            // category determines tabs + highlight color in UI
            category: { type: "string", enum: ["structure", "relevance", "evidence", "framing", "language"] },

            // e.g. "circular_reasoning", "red_herring", "cherry_picking"
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
            explanation: { type: "string" },
          },
        },
      },
    },
  },
};

/**
 * Snap an offset to word boundaries so highlights never cut mid-word.
 */
function snapToWordBounds(text, start, end) {
  const n = text.length;
  while (start > 0 && /\S/.test(text[start - 1]) && !/[.,:;!?()[\]{}""''"/\\–—\-]/.test(text[start - 1])) {
    start--;
  }
  while (end < n && /\S/.test(text[end]) && !/[.,:;!?()[\]{}""''"/\\–—\-]/.test(text[end])) {
    end++;
  }
  return { start, end };
}

/**
 * Hardening pass:
 * - Repairs/clamps spans using quote matching (same as your current behavior)
 * - Snaps start/end to word boundaries so highlights never cut mid-word
 * - IMPORTANT CHANGE: does NOT remove overlaps.
 *
 * Why: overlap resolution now happens client-side based on enabled categories + severity,
 * so disabling a category can reveal lower-severity findings underneath.
 */
function clampFindingsToText(text, findings) {
  const n = text.length;

  const repaired = (findings || [])
    .map((f) => {
      let start = Number.isInteger(f.start) ? f.start : 0;
      let end = Number.isInteger(f.end) ? f.end : 0;

      // clamp
      start = Math.max(0, Math.min(start, n));
      end = Math.max(0, Math.min(end, n));
      if (end < start) [start, end] = [end, start];

      const slice = text.slice(start, end);

      if (slice !== f.quote && typeof f.quote === "string" && f.quote.length > 0) {
        // attempt repair by locating quote in text (first occurrence)
        const idx = text.indexOf(f.quote);
        if (idx !== -1) {
          start = idx;
          end = idx + f.quote.length;
        }
      }

      // final check; if still invalid, drop it
      if (text.slice(start, end) !== f.quote) return null;

      // Snap to word boundaries
      const snapped = snapToWordBounds(text, start, end);
      start = snapped.start;
      end = snapped.end;

      return { ...f, start, end, quote: text.slice(start, end) };
    })
    .filter(Boolean);

  // NOTE: We intentionally do NOT remove overlaps here.
  // Also keep server output bounded.
  return repaired.slice(0, 12);
}

export async function analyzeWithLLM(text, settings = {}) {
  if (USE_NLP_SERVICE) return _analyzeWithNLPService(text, settings);

  const maxFindings = Math.max(1, Math.min(Number(settings.maxFindings ?? 10), 12));
  const temperature = Math.max(0, Math.min(Number(settings.temperature ?? 0.2), 1));

  const system = [
    "You are an expert critical-reasoning auditor. Your job is to find issues in text across five categories, ordered by mechanism of error:",
    "",
    "(1) STRUCTURE — Formal logic errors: invalid syllogisms, contradictions, circular reasoning.",
    "(2) RELEVANCE — Premise-conclusion connection issues: red herrings, irrelevant appeals, topic shifts.",
    "(3) EVIDENCE — Sufficiency/quality of evidence problems: hasty generalizations, cherry-picking, false causation.",
    "(4) FRAMING — Representation/presentation issues: how information is packaged, false balance, anchoring.",
    "(5) LANGUAGE — Word choice manipulation: loaded terms, emotional manipulation, euphemism/dysphemism.",
    "",
    "OUTPUT RULES:",
    "- Return ONLY a JSON object that matches the provided JSON schema exactly (no extra keys, no markdown).",
    "- All indices are CHARACTER indices into the exact input string.",
    "- For every finding: quote MUST equal text.slice(start, end) exactly.",
    "- Findings MAY overlap if warranted. Prefer minimal spans; do not suppress a legitimate finding just because it overlaps another.",
    `- Return at most ${maxFindings} findings total across ALL categories.`,
    "",
    "SCORING (0–100, integers): Higher is ALWAYS better; lower is ALWAYS worse.",
    "- structureScore (Soundness): 0 dominated by logical errors/contradictions; 100 logically rigorous.",
    "- relevanceScore (Relevance): 0 rampant non-sequiturs/red herrings; 100 every premise connects to the conclusion.",
    "- evidenceScore (Evidence): 0 unsupported claims, cherry-picking; 100 well-evidenced, representative data.",
    "- framingScore (Framing): 0 heavily distorted framing/false balance; 100 fair, proportionate representation.",
    "- languageScore (Language): 0 highly loaded/manipulative wording; 100 neutral, precise language.",
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
    "- category must be one of: structure | relevance | evidence | framing | language.",
    "- categoryId must be a stable snake_case identifier, e.g.:",
    // TODO(human): Define categoryId examples for each of the 5 categories
    "  structure: circular_reasoning, affirming_consequent, begging_the_question, equivocation,",
    "             contradiction, non_sequitur, denying_antecedent, false_dilemma",
    "  relevance: ad_hominem, red_herring, appeal_to_authority, appeal_to_emotion, tu_quoque,",
    "             straw_man, whataboutism, genetic_fallacy, appeal_to_nature, appeal_to_tradition",
    "  evidence: hasty_generalization, cherry_picking, false_cause, post_hoc, slippery_slope,",
    "            anecdotal, survivorship_bias, appeal_to_ignorance, burden_of_proof, correlation_causation",
    "  framing: false_equivalence, framing_effect, anchoring, false_balance, moving_goalposts,",
    "           availability_heuristic, bandwagon, no_true_scotsman, oversimplification",
    "  language: loaded_language, fear_appeal, guilt_trip, false_urgency, weasel_words,",
    "            thought_terminating_cliche, euphemism, dysphemism, sarcasm_as_argument",
    "- If none fit, create a reasonable snake_case id (but do not over-fragment).",
    "",
    "PROCESS (follow internally, do not output):",
    "1) Ensure a mix across categories when present, but do not force balance.",
    "2) Choose minimal spans that demonstrate each issue.",
  ].join("\n");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Gemini API with structured JSON output
  const resp = await getClient().models.generateContent({
    model,
    contents: text,
    config: {
      systemInstruction: system,
      temperature,
      responseMimeType: "application/json",
      responseSchema: ARGUMENT_SCHEMA.schema,
    },
  });

  const raw = resp.text;
  const parsed = JSON.parse(raw);

  // hardening: clamp/repair spans (NO overlap removal)
  parsed.findings = clampFindingsToText(text, parsed.findings || []);

  parsed.scores = {
    structure: parsed.overall?.structureScore ?? 0,
    relevance: parsed.overall?.relevanceScore ?? 0,
    evidence:  parsed.overall?.evidenceScore ?? 0,
    framing:   parsed.overall?.framingScore ?? 0,
    language:  parsed.overall?.languageScore ?? 0,
    factcheck: parsed.overall?.verifiabilityScore ?? 0,
  };

  parsed.findings = (parsed.findings || []).map((f) => ({
    ...f,
    type: f.category,
    originalText: f.quote,
  }));

  return parsed;
}

async function _analyzeWithNLPService(text, settings = {}) {
  const resp = await fetch(`${NLP_SERVICE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, max_findings: settings.maxFindings ?? 10 }),
  });
  if (!resp.ok) throw new Error(`NLP service: ${await resp.text()}`);
  const parsed = await resp.json();

  // Apply the same hardening + shape transformation as the Gemini path so
  // both paths produce identical output for the frontend.
  parsed.findings = clampFindingsToText(text, parsed.findings || []);

  parsed.scores = {
    structure: parsed.overall?.structureScore     ?? 0,
    relevance: parsed.overall?.relevanceScore     ?? 0,
    evidence:  parsed.overall?.evidenceScore      ?? 0,
    framing:   parsed.overall?.framingScore       ?? 0,
    language:  parsed.overall?.languageScore      ?? 0,
    factcheck: parsed.overall?.verifiabilityScore ?? 0,
  };

  parsed.findings = (parsed.findings || []).map((f) => ({
    ...f,
    type: f.category,
    originalText: f.quote,
  }));

  return parsed;
}
