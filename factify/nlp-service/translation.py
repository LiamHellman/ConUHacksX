# ---------------------------------------------------------------------------
# Label → categoryId mappings (one entry per bad label across all tiers)
# ---------------------------------------------------------------------------
LABEL_TO_ID: dict[str, str] = {
    # Tier 5 – language
    "loaded language":                      "loaded_language",
    "fear appeal":                          "fear_appeal",
    "euphemism":                            "euphemism",
    "dysphemism":                           "dysphemism",
    # Tier 4 – framing
    "false equivalence":                    "false_equivalence",
    "false balance":                        "false_balance",
    "oversimplification":                   "oversimplification",
    "misleading framing":                   "misleading_framing",
    # Tier 3 – evidence
    "hasty generalization":                 "hasty_generalization",
    "cherry-picking evidence":              "cherry_picking",
    "confusing correlation with causation": "correlation_causation",
    "anecdotal evidence":                   "anecdotal_evidence",
    # Tier 2 – relevance
    "ad hominem attack":                    "ad_hominem",
    "red herring":                          "red_herring",
    "straw man argument":                   "straw_man",
    "non sequitur":                         "non_sequitur",
    # Tier 1 – structure
    "circular reasoning":                   "circular_reasoning",
    "logical contradiction":                "contradiction",
    "affirming the consequent":             "affirming_consequent",
}

# Human-friendly label text shown in the UI
LABEL_TO_HUMAN: dict[str, str] = {k: k.title() for k in LABEL_TO_ID}

# Confidence thresholds that separate severity bands
_LOW_MED_BOUNDARY = 0.55
_MED_HIGH_BOUNDARY = 0.72

# Per-severity weights used in score deduction
_SEVERITY_WEIGHT = {"high": 3, "medium": 2, "low": 1}


def _severity(score: float) -> str:
    if score > _MED_HIGH_BOUNDARY:
        return "high"
    if score >= _LOW_MED_BOUNDARY:
        return "medium"
    return "low"


def make_finding(
    sentence: str,
    span_start: int,
    span_end: int,
    label: str,
    score: float,
    category: str,
    finding_id: str = "",
) -> dict:
    """Build a Finding dict that matches the Node.js schema exactly."""
    sev = _severity(score)
    return {
        "id":          finding_id,
        "category":    category,
        "categoryId":  LABEL_TO_ID.get(label, label.lower().replace(" ", "_")),
        "label":       LABEL_TO_HUMAN.get(label, label.title()),
        "severity":    sev,
        "confidence":  round(score, 4),
        "start":       span_start,
        "end":         span_end,
        "quote":       sentence,
        "explanation": f"This sentence exhibits characteristics of {label}.",
    }


def compute_score(findings: list[dict]) -> int:
    """
    Score formula:
        deduction = severity_weight * confidence   (high=3, med=2, low=1)
        score     = max(0, 100 - sum(deductions) * 12)
    """
    total = sum(
        _SEVERITY_WEIGHT[f["severity"]] * f["confidence"]
        for f in findings
    )
    return max(0, round(100 - total * 12))
