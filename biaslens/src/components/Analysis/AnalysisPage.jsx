import { useState, useEffect, useMemo, useRef } from "react";
import { applyThemeVars } from "../../theme/colors";
import UploadPanel from "./UploadPanel";
import ControlBar from "./ControlBar";
import DocumentViewer from "./DocumentViewer";
import InsightsPanel from "./InsightsPanel";
import AnimatedContent from "../AnimatedContent/AnimatedContent";
import Split from "react-split";
import { analyzeText } from "../../api/analyze";
import { FileText, Youtube, Music, Video as VideoIcon } from "lucide-react";

/**
 * Map UI toggle keys -> finding.type values coming from llm.js
 * (ControlBar uses `fallacies`, but llm.js outputs `type: "fallacy"`.)
 */
const CHECK_TO_TYPES = {
  bias: new Set(["bias"]),
  fallacies: new Set(["fallacy"]),
  tactic: new Set(["tactic"]),
};

function severityRank(sev) {
  switch (sev) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}


