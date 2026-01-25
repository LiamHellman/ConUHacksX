// server/index.js
import dotenv from "dotenv";
import "dotenv/config"; // must be before other imports
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { dirname, join, resolve } from "path";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import { execFile } from "child_process";
import { promisify } from "util";
import { execFile } from "child_process";
import { promisify } from "util";
import { analyzeWithLLM } from "./llm.js";

const execFilePromise = promisify(execFile);

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
    console.error("OpenAI Whisper Error:", err.message);
    return res.status(500).send("Transcription failed");
  } finally {
    if (tempPathWithExt && fs.existsSync(tempPathWithExt))
      fs.unlinkSync(tempPathWithExt);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// --- ROUTE: YouTube Transcription (yt-dlp + Whisper) ---
app.post("/api/youtube", async (req, res) => {
  const timestamp = Date.now();
  // Using path.resolve to handle Windows spaces/OneDrive paths correctly
  const tempPath = path.resolve(__dirname, "uploads", `yt_${timestamp}.mp3`);
  const exePath = path.resolve(__dirname, "yt-dlp.exe");

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    console.log(`🚀 Executing local yt-dlp...`);

    // Arguments array avoids shell injection and path issues
    const args = [
      "-x",
      "--audio-format",
      "mp3",
      "--force-overwrites",
      "-o",
      tempPath,
      url,
    ];

    // windowsVerbatimArguments helps with complex Windows file paths
    await execFilePromise(exePath, args, { windowsVerbatimArguments: true });

    console.log("✅ Download complete. Sending to OpenAI Whisper...");

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    // Cleanup the downloaded MP3
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    return res.json({ transcript: transcription.text });
  } catch (error) {
    console.error("❌ YouTube Route Error:", error.stderr || error.message);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res
      .status(500)
      .json({ error: "YouTube processing failed.", details: error.message });
  }
});

// --- ROUTE: Text Analysis (LLM) ---
// --- ROUTE: YouTube Transcription (yt-dlp + Whisper) ---
app.post("/api/youtube", async (req, res) => {
  const timestamp = Date.now();
  // Using path.resolve to handle Windows spaces/OneDrive paths correctly
  const tempPath = path.resolve(__dirname, "uploads", `yt_${timestamp}.mp3`);
  const exePath = path.resolve(__dirname, "yt-dlp.exe");

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    console.log(`🚀 Executing local yt-dlp...`);

    // Arguments array avoids shell injection and path issues
    const args = [
      "-x",
      "--audio-format",
      "mp3",
      "--force-overwrites",
      "-o",
      tempPath,
      url,
    ];

    // windowsVerbatimArguments helps with complex Windows file paths
    await execFilePromise(exePath, args, { windowsVerbatimArguments: true });

    console.log("✅ Download complete. Sending to OpenAI Whisper...");

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    // Cleanup the downloaded MP3
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    return res.json({ transcript: transcription.text });
  } catch (error) {
    console.error("❌ YouTube Route Error:", error.stderr || error.message);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res
      .status(500)
      .json({ error: "YouTube processing failed.", details: error.message });
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
// Start Server
const port = process.env.API_PORT || 5174;
app.listen(port, () => {
  const uploadsDir = path.resolve(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  console.log(`🚀 API running on http://localhost:${port}`);
});
