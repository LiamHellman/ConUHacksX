from transformers import pipeline

_clf = None

# Swap to "microsoft/deberta-large-mnli" for higher accuracy (needs more RAM/VRAM)
MODEL_NAME = "cross-encoder/nli-deberta-v3-base"


def get_classifier():
    global _clf
    if _clf is None:
        _clf = pipeline(
            "zero-shot-classification",
            model=MODEL_NAME,
            device=-1,  # CPU; set device=0 for GPU
        )
    return _clf
