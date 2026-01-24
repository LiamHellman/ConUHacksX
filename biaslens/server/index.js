// server/index.js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import { analyzeWithLLM } from "./llm.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/api/analyze", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const settings = req.body?.settings ?? {};

    if (!text.trim()) return res.status(400).send("Missing 'text'");

    // Normalize line endings ONCE, then never alter the string again
    const normalized = text.replace(/\r\n/g, "\n");

    const result = await analyzeWithLLM(normalized, settings);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Analysis failed");
  }
});

const port = process.env.API_PORT || 5174;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));