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
import { execFile } from "child_process";
import { promisify } from "util";

const execFilePromise = promisify(execFile);
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
    const m = u.pathname.match(/\/(embed|v)\/([^/?]+)/);
    if (m) return m[2];
  } catch (_) {}
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

/**
 * Download YouTube audio using yt-dlp (installed via pip).
 * Tries: yt-dlp binary, python3 -m yt_dlp, python -m yt_dlp.
 */
async function downloadYouTubeAudio(videoUrl, outputPath) {
  const ytdlpArgs = [
    "-x",
    "--audio-format", "mp3",
    "--force-overwrites",
    "-o", outputPath,
    videoUrl,
  ];

  const attempts = [
    { cmd: "yt-dlp", args: ytdlpArgs },
    { cmd: "python3", args: ["-m", "yt_dlp", ...ytdlpArgs] },
    { cmd: "python", args: ["-m", "yt_dlp", ...ytdlpArgs] },
  ];

  // If YTDLP_PATH is set, try that first
  if (process.env.YTDLP_PATH?.trim()) {
    attempts.unshift({ cmd: process.env.YTDLP_PATH.trim(), args: ytdlpArgs });
  }

  const errors = [];
  for (const { cmd, args } of attempts) {
    try {
      console.log(`  Trying: ${cmd} ${args[0]}...`);
      await execFilePromise(cmd, args, { timeout: 120000 });
      return; // success
    } catch (err) {
      errors.push(`${cmd}: ${err?.message?.split('\n')[0] || 'unknown'}`);
    }
  }

  throw new Error(`yt-dlp download failed. Tried: ${errors.join(' | ')}`);
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

// --- ROUTE: YouTube Transcription (yt-dlp + Whisper) ---
app.post("/api/youtube", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: "Could not extract video ID from URL" });

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const timestamp = Date.now();
  const tempPath = path.resolve(__dirname, "uploads", `yt_${timestamp}.mp3`);

  try {
    console.log(`🚀 Downloading audio for: ${videoUrl}`);

    // 1. Download audio as MP3 via yt-dlp
    await downloadYouTubeAudio(videoUrl, tempPath);

    // Verify file exists
    if (!fs.existsSync(tempPath)) {
      throw new Error("Audio download completed but file not found");
    }

    console.log("✅ Download complete. Transcribing with OpenAI Whisper...");

    // 2. Transcribe with Whisper
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    console.log(`✅ Transcription complete: ${transcription.text.length} chars`);
    return res.json({ transcript: transcription.text });
  } catch (error) {
    console.error("❌ YouTube Route Error:", error.message);
    res.status(500).json({
      error: "YouTube processing failed.",
      details: error.message,
    });
  } finally {
    // Always clean up temp file
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
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
