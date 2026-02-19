from models import get_classifier
from translation import make_finding

CATEGORY = "evidence"
THRESHOLD = 0.45
NEUTRAL_LABEL = "well-supported evidence"
BAD_LABELS = [
    "hasty generalization",
    "cherry-picking evidence",
    "confusing correlation with causation",
    "anecdotal evidence",
]


def analyze(spans: list) -> list[dict]:
    clf = get_classifier()
    findings = []
    for start, end, sentence in spans:
        result = clf(
            sentence,
            candidate_labels=[*BAD_LABELS, NEUTRAL_LABEL],
            multi_label=True,
        )
        label_scores = dict(zip(result["labels"], result["scores"]))
        for label in BAD_LABELS:
            score = label_scores.get(label, 0.0)
            if score >= THRESHOLD:
                findings.append(
                    make_finding(sentence, start, end, label, score, CATEGORY)
                )
    return findings
