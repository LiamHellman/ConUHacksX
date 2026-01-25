// server/index.js
import dotenv from "dotenv";
dotenv.config();

import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import { analyzeWithLLM } from "./llm.js";

// Custom YouTube transcript fetcher
async function fetchYouTubeTranscript(videoId) {
  // First, fetch the video page to get caption tracks
  const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  const html = await videoPageResponse.text();
  
  // Extract captions data from the page
  const captionMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!captionMatch) {
    throw new Error("No captions found for this video");
  }
  
  let captionTracks;
  try {
    captionTracks = JSON.parse(captionMatch[1]);
  } catch (e) {
    throw new Error("Failed to parse caption data");
  }
  
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error("No caption tracks available");
  }
  
  // Prefer English, fallback to first available
  let captionUrl = captionTracks.find(t => t.languageCode === 'en')?.baseUrl 
    || captionTracks[0]?.baseUrl;
  
  if (!captionUrl) {
    throw new Error("No caption URL found");
  }
  
  // Fetch the actual captions (XML format)
  const captionResponse = await fetch(captionUrl);
  const captionXml = await captionResponse.text();
  
  // Parse XML and extract text
  const textMatches = captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
  const texts = [];
  for (const match of textMatches) {
    // Decode HTML entities
    let text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ');
    texts.push(text);
  }
  
  return texts.join(' ');
}

// Setup Environment Variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize App and OpenAI
const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: "uploads/" });

// CORS - allow your frontend domain
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://factify.tech",
      "https://www.factify.tech",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

// --- ROUTE: Audio/Video Transcription (Whisper) ---
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
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// --- ROUTE: YouTube Transcription (using captions) ---
app.post("/api/youtube", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    console.log(`🚀 Fetching YouTube captions for: ${url}`);

    // Extract video ID from URL
    const videoIdMatch = url.match(/(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }
    const videoId = videoIdMatch[1];

    // Fetch transcript using custom function
    const transcript = await fetchYouTubeTranscript(videoId);

    console.log("✅ Transcript fetched successfully, length:", transcript.length);

    return res.json({ transcript });
  } catch (error) {
    console.error("❌ YouTube Route Error:", error.message);
    res.status(500).json({ 
      error: "YouTube transcription failed. Video may not have captions.", 
      details: error.message 
    });
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
const port = process.env.PORT || process.env.API_PORT || 5174;
app.listen(port, () => {
  const uploadsDir = path.resolve(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  console.log(`🚀 API running on http://localhost:${port}`);
});
