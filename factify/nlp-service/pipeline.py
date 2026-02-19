from utils import find_sentence_spans
from translation import compute_score
from tiers import tier1_structure, tier2_relevance, tier3_evidence, tier4_framing, tier5_language

# Ordered by tier number (structure → language)
_TIERS = [
    ("structure", tier1_structure),
    ("relevance", tier2_relevance),
    ("evidence",  tier3_evidence),
    ("framing",   tier4_framing),
    ("language",  tier5_language),
]


def run_pipeline(text: str, max_findings: int = 10) -> dict:
    """
    Run all five zero-shot tiers over `text` and return the combined result.

    Returns a dict matching the Node.js Gemini schema:
        { overall: { ...6 scores }, findings: [...] }
    """
    spans = find_sentence_spans(text)

    # Collect findings from every tier
    all_findings: list[dict] = []
    for _category, tier_module in _TIERS:
        all_findings.extend(tier_module.analyze(spans))

    # Sort by confidence descending so we keep the most certain findings
    all_findings.sort(key=lambda f: f["confidence"], reverse=True)
    all_findings = all_findings[:max_findings]

    # Assign stable IDs after the final cut
    for i, f in enumerate(all_findings, 1):
        f["id"] = f"nlp_{i}"

    # Compute per-category scores from the retained findings only
    category_scores: dict[str, int] = {}
    for category, _ in _TIERS:
        cat_findings = [f for f in all_findings if f["category"] == category]
        category_scores[category] = compute_score(cat_findings)

    return {
        "overall": {
            "structureScore":     category_scores["structure"],
            "relevanceScore":     category_scores["relevance"],
            "evidenceScore":      category_scores["evidence"],
            "framingScore":       category_scores["framing"],
            "languageScore":      category_scores["language"],
            # Verifiability is not assessed by this pipeline; use neutral default
            "verifiabilityScore": 50,
        },
        "findings": all_findings,
    }
