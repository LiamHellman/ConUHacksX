import nltk


def find_sentence_spans(text: str) -> list[tuple[int, int, str]]:
    """Return [(start, end, sentence), ...] for every sentence in text."""
    sentences = nltk.sent_tokenize(text)
    spans, pos = [], 0
    for s in sentences:
        start = text.find(s, pos)
        spans.append((start, start + len(s), s))
        pos = start + len(s)
    return spans
