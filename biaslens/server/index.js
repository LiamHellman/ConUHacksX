// server/index.js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import { YtTranscript } from "yt-transcript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory
dotenv.config({ path: `${__dirname}/../.env` });

import { analyzeWithLLM } from "./llm.js";

const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: "uploads/" });

/**
 * Extract video ID from various YouTube URL formats.
 */
function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    // /embed/ID or /v/ID
    const m = u.pathname.match(/\/(embed|v)\/([^/?]+)/);
    if (m) return m[2];
  } catch (_) {}
  // Bare ID fallback (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

// Middleware
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

// --- ROUTE: YouTube Transcription (captions via yt-transcript) ---
app.post("/api/youtube", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: "Could not extract video ID from URL" });

  try {
    console.log(`🚀 Fetching captions for video: ${videoId}`);

    const yt = new YtTranscript({ videoId });
    const segments = await yt.getTranscript();

    if (!segments || segments.length === 0) {
      return res.status(404).json({ error: "No captions/transcript available for this video." });
    }

    // Combine all caption segments into a single string
    const transcript = segments.map(s => s.text).join(' ');

    console.log(`✅ Transcript fetched: ${transcript.length} chars`);
    return res.json({ transcript });
  } catch (error) {
    console.error("❌ YouTube Route Error:", error.message);
    res.status(500).json({
      error: "YouTube processing failed.",
      details: error.message,
    });
  }
});

// --- ROUTE: Local File Upload (Whisper) ---
app.post("/api/upload", upload.single("file"), async (req, res) => {
  let tempPathWithExt = null;
  try {
    if (!req.file) return res.status(400).send("No file uploaded");

    const ext = path.extname(req.file.originalname);
    tempPathWithExt = `${req.file.path}${ext}`;
    fs.renameSync(req.file.path, tempPathWithExt);

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPathWithExt),
      model: "whisper-1",
    });

    return res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("OpenAI Whisper Error:", err.message);
    return res.status(500).send("Transcription failed");
  } finally {
    if (tempPathWithExt && fs.existsSync(tempPathWithExt))
      fs.unlinkSync(tempPathWithExt);
    if (req.file && fs.existsSync(req.file.path))
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
  }
});

// --- ROUTE: Text Analysis (LLM) ---
app.post("/api/analyze", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const settings = req.body?.settings ?? {};

    if (!text.trim()) return res.status(400).send("Missing 'text'");

    const normalized = text.replace(/\r\n/g, "\n");
    const result = await analyzeWithLLM(normalized, settings);
    return res.json(result);
  } catch (err) {
    console.error("LLM Analysis Error:", err);
    return res.status(500).send("Analysis failed");
  }
});

// Start Server
const port = process.env.PORT || 5174;
app.listen(port, () => {
  const uploadsDir = path.resolve(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  console.log(`🚀 API running on http://localhost:${port}`);
});
