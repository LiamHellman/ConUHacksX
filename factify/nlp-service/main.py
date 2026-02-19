from contextlib import asynccontextmanager

import nltk
from fastapi import FastAPI
from pydantic import BaseModel

from models import get_classifier, MODEL_NAME
from pipeline import run_pipeline


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Download NLTK data and warm up the model before serving traffic."""
    nltk.download("punkt_tab", quiet=True)
    get_classifier()  # loads bart-large-mnli into memory once
    yield


app = FastAPI(title="Factify NLP Service", lifespan=lifespan)


class AnalyzeRequest(BaseModel):
    text: str
    max_findings: int = 10


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    return run_pipeline(req.text, req.max_findings)
