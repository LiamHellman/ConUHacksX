// server/index.js
import "dotenv/config";
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