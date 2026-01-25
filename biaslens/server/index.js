import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import { analyzeWithLLM } from "./llm.js";
import ytdl from "@distube/ytdl-core"; //

// Load .env from root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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

app.use(express.json({ limit: "5mb" }));

// --- ROUTE: Audio/Video Transcription (File Upload) ---
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
    if (tempPathWithExt && fs.existsSync(tempPathWithExt)) {
      try {
        fs.unlinkSync(tempPathWithExt);
      } catch (e) {}
    }
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
  }
});

// --- NEW ROUTE: YouTube Transcription ---
app.post("/api/youtube", async (req, res) => {
  const { url } = req.body;
  const tempId = Date.now();
  const tempFilePath = path.resolve(__dirname, `uploads/yt_${tempId}.webm`);

  try {
    if (!url || !ytdl.validateURL(url)) {
      return res.status(400).send("Invalid YouTube URL");
    }

    console.log(`Downloading YouTube audio: ${url}`);

    // Stream audio from YouTube to a file
    // We use a Promise to wait for the download to finish before sending to OpenAI
    await new Promise((resolve, reject) => {
      const stream = ytdl(url, {
        quality: "lowestaudio", // Get audio only to save bandwidth
        filter: "audioonly",
      });

      const fileWriter = fs.createWriteStream(tempFilePath);

      stream.pipe(fileWriter);

      stream.on("error", reject);
      fileWriter.on("finish", resolve);
      fileWriter.on("error", reject);
    });

    console.log("Download complete. Transcribing...");

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    return res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("YouTube Error:", err);
    // Handle 403 Forbidden (common with cloud IPs)
    if (err.statusCode === 403) {
      return res
        .status(403)
        .send(
          "Server blocked by YouTube. Try a different video or upload manually.",
        );
    }
    return res.status(500).send("YouTube processing failed");
  } finally {
    // Cleanup
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
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
