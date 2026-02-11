// YouTube-specific content script: add a Factifiy button near the player,
// transcribe the current video, then route transcript to existing analysis flow.
(function () {
  const BUTTON_ID = "factify-youtube-btn";
  const MODAL_ID = "factify-youtube-modal";
  let currentVideoId = null;
  let isBusy = false;

  function getVideoIdFromUrl(url = window.location.href) {
    try {
      const parsed = new URL(url);
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const match = parsed.pathname.match(/\/shorts\/([^/?]+)/);
      return match ? match[1] : null;
    } catch (_) {
      return null;
    }
  }

  function getPlayerContainer() {
    return (
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player") ||
      document.querySelector("ytd-player")
    );
  }

  function ensureButton() {
    const videoId = getVideoIdFromUrl();
    if (!videoId) {
      removeButton();
      return;
    }

    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      removeButton();
    }

    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.textContent = "Factifiy";
    btn.title = "Transcribe and analyze this video with Factify";
    btn.addEventListener("click", onAnalyzeClick);
    document.body.appendChild(btn);
    positionButton();
  }

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
  }

  function setButtonState(text, disabled) {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    btn.textContent = text;
    btn.disabled = !!disabled;
    btn.classList.toggle("factify-youtube-busy", !!disabled);
    positionButton();
  }

  function positionButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    const player = getPlayerContainer();
    if (player) {
      const rect = player.getBoundingClientRect();
      // Keep the button near the player's top-right corner.
      const top = Math.max(12, rect.top + 10);
      const rightSpace = Math.max(12, window.innerWidth - rect.right + 10);
      btn.style.top = `${top}px`;
      btn.style.right = `${rightSpace}px`;
      return;
    }

    // Fallback position when player is not yet available.
    btn.style.top = "84px";
    btn.style.right = "20px";
  }

  async function onAnalyzeClick() {
    if (isBusy) return;

    const videoUrl = window.location.href;
    isBusy = true;
    setButtonState("Transcribing...", true);

    try {
      let transcript = await getTranscriptFromCaptions();
      if (!transcript || transcript.length < 30) {
        transcript = await getTranscriptViaApi(videoUrl);
      }

      if (!transcript || transcript.length < 30) {
        throw new Error("No transcript available for this video.");
      }

      setButtonState("Ready", false);
      openTranscriptModal(transcript);
      setButtonState("Factifiy", false);
    } catch (err) {
      console.error("[Factify][YouTube]", err);
      setButtonState("No transcript", false);
      setTimeout(() => setButtonState("Factifiy", false), 1600);
    } finally {
      isBusy = false;
    }
  }

  function extractBalancedArray(source, marker) {
    const markerIdx = source.indexOf(marker);
    if (markerIdx === -1) return null;

    const arrStart = source.indexOf("[", markerIdx);
    if (arrStart === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = arrStart; i < source.length; i++) {
      const ch = source[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
      } else if (ch === "[") {
        depth++;
      } else if (ch === "]") {
        depth--;
        if (depth === 0) {
          return source.slice(arrStart, i + 1);
        }
      }
    }

    return null;
  }

  function parseCaptionTracksFromDom() {
    // Most reliable source on current YouTube pages.
    const directTracks =
      window?.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(directTracks) && directTracks.length > 0) {
      return directTracks;
    }

    const scripts = Array.from(document.scripts || []);
    for (const script of scripts) {
      const content = script.textContent || "";
      if (!content.includes("\"captionTracks\"")) continue;

      const arrayText = extractBalancedArray(content, "\"captionTracks\":");
      if (!arrayText) continue;

      try {
        const tracks = JSON.parse(arrayText);
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      } catch (_) {
        // Continue searching other script blocks.
      }
    }

    return null;
  }

  function chooseCaptionTrack(tracks) {
    if (!tracks || tracks.length === 0) return null;

    const english = tracks.find((t) => /^en(-|$)/i.test(t.languageCode || ""));
    if (english) return english;

    const nonAsr = tracks.find((t) => !String(t.vssId || "").includes(".asr"));
    return nonAsr || tracks[0] || null;
  }

  async function getTranscriptFromCaptions() {
    const tracks = parseCaptionTracksFromDom();
    if (!tracks || tracks.length === 0) return "";

    const chosen = chooseCaptionTrack(tracks);
    if (!chosen || !chosen.baseUrl) return "";

    const url = new URL(chosen.baseUrl);
    url.searchParams.set("fmt", "json3");

    const response = await fetch(url.toString(), { credentials: "include" });
    if (!response.ok) throw new Error(`Caption fetch failed (${response.status})`);

    const payload = await response.json();
    const chunks = [];

    (payload.events || []).forEach((event) => {
      (event.segs || []).forEach((seg) => {
        if (typeof seg.utf8 === "string") chunks.push(seg.utf8);
      });
    });

    return chunks
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\u200b/g, "")
      .trim();
  }

  function getTranscriptViaApi(url) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: "transcribeYouTube", url },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!response || !response.ok) {
              reject(new Error(response?.error || "Transcription API failed"));
              return;
            }
            resolve(response.transcript || "");
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  function closeTranscriptModal() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();
  }

  function openTranscriptModal(transcript) {
    closeTranscriptModal();

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="factify-youtube-modal-card">
        <div class="factify-youtube-modal-header">
          <span>Factifiy Transcript</span>
          <button type="button" class="factify-youtube-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="factify-youtube-modal-body">
          <p class="factify-youtube-modal-help">Review or edit the transcript before analysis.</p>
          <textarea class="factify-youtube-modal-textarea"></textarea>
        </div>
        <div class="factify-youtube-modal-actions">
          <button type="button" class="factify-youtube-secondary">Cancel</button>
          <button type="button" class="factify-youtube-primary">Analyze with Factify</button>
        </div>
      </div>
    `;

    const textarea = modal.querySelector(".factify-youtube-modal-textarea");
    const closeBtn = modal.querySelector(".factify-youtube-modal-close");
    const cancelBtn = modal.querySelector(".factify-youtube-secondary");
    const analyzeBtn = modal.querySelector(".factify-youtube-primary");

    textarea.value = transcript;

    const close = () => closeTranscriptModal();
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    analyzeBtn.addEventListener("click", () => {
      const finalText = (textarea.value || "").trim();
      if (finalText.length < 30) {
        textarea.focus();
        return;
      }
      closeTranscriptModal();
      setButtonState("Analyzing...", true);
      chrome.runtime.sendMessage({
        action: "analyzeText",
        text: finalText
      });
      setTimeout(() => setButtonState("Factifiy", false), 500);
    });

    document.body.appendChild(modal);
    textarea.focus();
  }

  // Listen for messages from the popup requesting a transcript
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getYouTubeTranscript") {
      (async () => {
        try {
          let transcript = await getTranscriptFromCaptions();
          if (!transcript || transcript.length < 30) {
            transcript = await getTranscriptViaApi(window.location.href);
          }
          if (!transcript || transcript.length < 30) {
            sendResponse({ ok: false, error: "No transcript available for this video." });
          } else {
            sendResponse({ ok: true, transcript });
          }
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true; // keep the message channel open for async response
    }
    if (request.action === "isYouTubeVideo") {
      const videoId = getVideoIdFromUrl();
      sendResponse({ isYouTube: !!videoId, videoId });
      return true;
    }
  });

  // Initial and ongoing checks (YouTube is a SPA).
  ensureButton();
  const observer = new MutationObserver(() => ensureButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => {
    ensureButton();
    positionButton();
  }, 1200);
  window.addEventListener("resize", positionButton);
  window.addEventListener("scroll", positionButton, { passive: true });
  document.addEventListener("yt-navigate-finish", () => {
    currentVideoId = null;
    ensureButton();
    positionButton();
  });
})();
