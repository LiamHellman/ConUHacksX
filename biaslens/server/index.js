// server/index.js
import dotenv from "dotenv";
import "dotenv/config";  // must be before other imports
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import { analyzeWithLLM } from "./llm.js";

// 1. Setup Environment Variables (Teammate's logic)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

// 2. Initialize App and OpenAI
const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// 4. ROUTE: Audio/Video Transcription (Whisper)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  let tempPathWithExt = null;

  try {
    if (!req.file) return res.status(400).send("No file uploaded");

    // FIX: Multer saves files without extensions (e.g., 'abc123').
    // OpenAI Whisper requires an extension (e.g., '.mp3') to work.
    const ext = path.extname(req.file.originalname);
    tempPathWithExt = `${req.file.path}${ext}`;

    // Rename the temporary file to include the extension
    fs.renameSync(req.file.path, tempPathWithExt);

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPathWithExt),
      model: "whisper-1",
    });

    return res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("OpenAI Whisper Error:", err.response?.data || err.message);
    return res.status(500).send("Transcription failed");
  } finally {
    // CLEANUP: Delete the temp files from your server after processing
    if (tempPathWithExt && fs.existsSync(tempPathWithExt))
      fs.unlinkSync(tempPathWithExt);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// 5. ROUTE: Text Analysis (LLM)
app.post("/api/analyze", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const settings = req.body?.settings ?? {};

    if (!text.trim()) return res.status(400).send("Missing 'text'");

    // Normalize line endings to prevent character count issues
    const normalized = text.replace(/\r\n/g, "\n");

    const result = await analyzeWithLLM(normalized, settings);
    return res.json(result);
  } catch (err) {
    console.error("LLM Analysis Error:", err);
    return res.status(500).send("Analysis failed");
  }
});

// 6. Start Server
// We are using 5174 as the default to match your working terminal output
const port = process.env.API_PORT || 5174;
app.listen(port, () => {
  if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
  console.log(`🚀 API running on http://localhost:${port}`);
});
