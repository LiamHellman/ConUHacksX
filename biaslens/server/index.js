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
 * Fetch YouTube transcript by scraping the watch page for caption tracks.
 * Works with both manual and auto-generated captions. No external dependencies.
 */
async function fetchYouTubeTranscript(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 1. Fetch the YouTube watch page
  const pageRes = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!pageRes.ok) throw new Error(`Failed to fetch YouTube page (${pageRes.status})`);
  const html = await pageRes.text();

  // 2. Extract captions player response JSON
  //    YouTube embeds this in a script tag as ytInitialPlayerResponse = {...};
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|const|let|<\/script)/s);
  if (!playerMatch) {
    throw new Error('Could not find player response on YouTube page');
  }

  let playerResponse;
  try {
    playerResponse = JSON.parse(playerMatch[1]);
  } catch (e) {
    throw new Error('Failed to parse YouTube player response JSON');
  }

  // 3. Find caption tracks
  const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captions || captions.length === 0) {
    throw new Error('No captions available for this video (no auto-generated or manual subtitles found)');
  }

  // Prefer English, fall back to first available
  let track = captions.find(t => t.languageCode === 'en');
  if (!track) track = captions.find(t => t.languageCode?.startsWith('en'));
  if (!track) track = captions[0]; // any language

  const captionUrl = track.baseUrl;
  if (!captionUrl) throw new Error('Caption track has no URL');

  console.log(`  Using caption track: ${track.name?.simpleText || track.languageCode} (${track.kind || 'manual'})`);

  // 4. Fetch the caption XML
  const captionRes = await fetch(captionUrl);
  if (!captionRes.ok) throw new Error(`Failed to fetch captions XML (${captionRes.status})`);
  const xml = await captionRes.text();

  // 5. Parse the XML to extract text segments
  //    Format: <text start="1.23" dur="4.56">caption text here</text>
  const segments = [];
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = textRegex.exec(xml)) !== null) {
    let text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, '') // strip any inner tags
      .trim();
    if (text) segments.push(text);
  }

  if (segments.length === 0) {
    throw new Error('Captions XML contained no text segments');
  }

  return segments.join(' ');
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

// --- ROUTE: YouTube Transcription (scrape captions directly) ---
app.post("/api/youtube", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: "Could not extract video ID from URL" });

  try {
    console.log(`🚀 Fetching transcript for video: ${videoId}`);
    const transcript = await fetchYouTubeTranscript(videoId);
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
