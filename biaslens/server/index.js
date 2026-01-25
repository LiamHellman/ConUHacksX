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
  // Fetch the video page to extract caption info
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cookie': 'CONSENT=YES+'
    }
  });
  
  const html = await response.text();
  
  // Look for playerCaptionsTracklistRenderer which contains caption URLs
  const captionsMatch = html.match(/"playerCaptionsTracklistRenderer":\s*(\{[^}]+\})/);
  
  // Also try to find captions in the ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
  
  let captionUrl = null;
  
  if (playerResponseMatch) {
    try {
      // Find the captions section more carefully
      const prText = playerResponseMatch[1];
      const captionTracksMatch = prText.match(/"captionTracks":\s*(\[[^\]]+\])/);
      
      if (captionTracksMatch) {
        const tracks = JSON.parse(captionTracksMatch[1]);
        // Find English or first available
        const track = tracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];
        if (track?.baseUrl) {
          captionUrl = track.baseUrl;
        }
      }
    } catch (e) {
      console.log("Parse error:", e.message);
    }
  }
  
  if (!captionUrl) {
    throw new Error("No captions available for this video");
  }
  
  // Fetch the caption XML
  const captionResponse = await fetch(captionUrl);
  const xml = await captionResponse.text();
  
  // Extract text from XML
  const texts = [];
  const regex = /<text[^>]*>([^<]*)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    let text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (text) texts.push(text);
  }
  
  if (texts.length === 0) {
    throw new Error("Could not extract transcript text");
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
