const API_URL = 'https://factify-api.onrender.com';

// DOM Elements
const instructions = document.getElementById('instructions');
const selectedTextContainer = document.getElementById('selectedTextContainer');
const selectedTextEl = document.getElementById('selectedText');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const closeResultsBtn = document.getElementById('closeResults');
const scoreValue = document.getElementById('scoreValue');
const findings = document.getElementById('findings');
const rewriteSection = document.getElementById('rewriteSection');
const rewriteText = document.getElementById('rewriteText');
const copyRewriteBtn = document.getElementById('copyRewrite');

// YouTube DOM Elements
const youtubeSection = document.getElementById('youtubeSection');
const youtubeTranscribeBtn = document.getElementById('youtubeTranscribeBtn');
const ytBtnText = document.getElementById('ytBtnText');
const ytBtnLoader = document.getElementById('ytBtnLoader');
const youtubeStatus = document.getElementById('youtubeStatus');
const youtubeDesc = document.getElementById('youtubeDesc');
const transcriptSection = document.getElementById('transcriptSection');
const transcriptText = document.getElementById('transcriptText');

// Options
const optStructure = document.getElementById('optStructure');
const optRelevance = document.getElementById('optRelevance');
const optEvidence = document.getElementById('optEvidence');
const optFraming = document.getElementById('optFraming');
const optLanguage = document.getElementById('optLanguage');

let currentSelectedText = '';
let currentYouTubeTabId = null;

// Default options state
const defaultOptions = {
  structure: true,
  relevance: true,
  evidence: true,
  framing: true,
  language: true
};

// Check if a URL is a YouTube video page
function isYouTubeVideoUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com' || parsed.hostname === 'm.youtube.com') &&
      (parsed.pathname === '/watch' || parsed.pathname.startsWith('/shorts/'))
    );
  } catch (_) {
    return false;
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved options state
  await loadOptions();
  
  // Set up toggle button click handlers
  setupOptionButtons();
  
  // Check if we're on a YouTube video page
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && isYouTubeVideoUrl(tab.url)) {
      currentYouTubeTabId = tab.id;
      showYouTubeMode();
    }
  } catch (e) {
    console.log('[Factify Popup] Could not check tab URL:', e);
  }

  // Get selected text from storage (set by content script)
  const result = await chrome.storage.local.get(['selectedText']);
  if (result.selectedText) {
    currentSelectedText = result.selectedText;
    showSelectedText(currentSelectedText);
    // Clear storage
    chrome.storage.local.remove(['selectedText']);
  }

  // Strategy 2: Also try to query the active tab's selection directly
  if (!currentSelectedText) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Use scripting API to get selection (more reliable than messaging)
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString().trim()
        });
        const text = results?.[0]?.result;
        if (text && text.length > 5) {
          currentSelectedText = text;
          showSelectedText(currentSelectedText);
          // Also store it for consistency
          chrome.storage.local.set({ selectedText: text });
        }
      }
    } catch (e) {
      console.log('[Factify Popup] scripting query failed:', e);
      // Fallback: try messaging the content script
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
          if (response?.text && response.text.length > 5) {
            currentSelectedText = response.text;
            showSelectedText(currentSelectedText);
          }
        }
      } catch (e2) {
        console.log('[Factify Popup] message fallback failed:', e2);
      }
    }
  }
});

// ─── YouTube Mode ───────────────────────────────────────────────────

function showYouTubeMode() {
  youtubeSection.style.display = 'block';
  instructions.style.display = 'none';
}

function setYouTubeStatus(msg, isError) {
  youtubeStatus.style.display = msg ? 'block' : 'none';
  youtubeStatus.textContent = msg;
  youtubeStatus.classList.toggle('error', !!isError);
}

function setYouTubeBtnState(text, loading, disabled) {
  ytBtnText.textContent = text;
  ytBtnLoader.style.display = loading ? 'block' : 'none';
  youtubeTranscribeBtn.disabled = !!disabled;
}

async function getTranscriptFromPageContext(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
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

      function parseTracksFromScripts() {
        const scripts = Array.from(document.scripts || []);
        for (const script of scripts) {
          const content = script.textContent || "";
          if (!content.includes("\"captionTracks\"")) continue;

          const arrayText = extractBalancedArray(content, "\"captionTracks\":");
          if (!arrayText) continue;

          try {
            const tracks = JSON.parse(arrayText);
            if (Array.isArray(tracks) && tracks.length > 0) return tracks;
          } catch (_) {}
        }
        return null;
      }

      function chooseTrack(tracks) {
        if (!Array.isArray(tracks) || tracks.length === 0) return null;
        const english = tracks.find((t) => /^en(-|$)/i.test(t.languageCode || ""));
        if (english) return english;
        const nonAsr = tracks.find((t) => !String(t.vssId || "").includes(".asr"));
        return nonAsr || tracks[0] || null;
      }

      let tracks =
        window?.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        tracks = parseTracksFromScripts();
      }
      const chosen = chooseTrack(tracks);
      if (!chosen?.baseUrl) {
        return { ok: false, error: "No captions found in page context" };
      }

      const url = new URL(chosen.baseUrl);
      url.searchParams.set("fmt", "json3");

      const response = await fetch(url.toString(), { credentials: "include" });
      if (!response.ok) {
        return { ok: false, error: `Caption fetch failed (${response.status})` };
      }

      const payload = await response.json();
      const chunks = [];
      (payload.events || []).forEach((event) => {
        (event.segs || []).forEach((seg) => {
          if (typeof seg.utf8 === "string") chunks.push(seg.utf8);
        });
      });

      const transcript = chunks
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/\u200b/g, "")
        .trim();

      if (!transcript || transcript.length < 30) {
        return { ok: false, error: "Transcript is empty from captions" };
      }
      return { ok: true, transcript };
    }
  });

  return results?.[0]?.result || { ok: false, error: "No result from page script" };
}

// YouTube Transcribe & Analyze button
youtubeTranscribeBtn.addEventListener('click', async () => {
  if (!currentYouTubeTabId) return;

  setYouTubeBtnState('Transcribing...', true, true);
  setYouTubeStatus('Extracting transcript from video...', false);
  transcriptSection.style.display = 'none';
  resultsSection.style.display = 'none';

  try {
    // Step 1: Try getting transcript from content-youtube.js (captions first, then API)
    let transcript = '';
    let contentScriptError = '';
    try {
      const response = await chrome.tabs.sendMessage(currentYouTubeTabId, { action: 'getYouTubeTranscript' });
      if (response?.ok && response.transcript) {
        transcript = response.transcript;
      } else {
        throw new Error(response?.error || 'Content script could not get transcript');
      }
    } catch (contentErr) {
      contentScriptError = contentErr?.message || 'Content transcript extraction failed';
      console.log('[Factify Popup] Content script transcript failed, trying page context:', contentErr);

      // Step 1b: Try running extraction directly in YouTube page context.
      setYouTubeStatus('Trying in-browser caption extraction...', false);
      try {
        const pageResult = await getTranscriptFromPageContext(currentYouTubeTabId);
        if (pageResult?.ok && pageResult.transcript) {
          transcript = pageResult.transcript;
        } else {
          throw new Error(pageResult?.error || 'Page context transcript extraction failed');
        }
      } catch (pageErr) {
        console.log('[Factify Popup] Page context transcript failed, trying API:', pageErr);

        // Step 1c: Last resort fallback is server transcription.
        setYouTubeStatus('Using server transcription (this may take a moment)...', false);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const apiResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'transcribeYouTube', url: tab.url },
            (resp) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (!resp || !resp.ok) {
                reject(new Error(resp?.error || 'Transcription API failed'));
                return;
              }
              resolve(resp);
            }
          );
        });
        transcript = apiResponse.transcript || '';
      }
    }

    if (!transcript || transcript.trim().length < 30) {
      throw new Error(contentScriptError || 'No transcript available for this video. It may not have captions.');
    }

    // Step 2: Show transcript preview
    transcriptSection.style.display = 'block';
    transcriptText.textContent = transcript.length > 600 ? transcript.substring(0, 600) + '...' : transcript;

    // Step 3: Automatically analyze the transcript
    setYouTubeBtnState('Analyzing...', true, true);
    setYouTubeStatus('Analyzing transcript for reasoning issues...', false);

    const settings = {
      detectStructure: optStructure.classList.contains('active'),
      detectRelevance: optRelevance.classList.contains('active'),
      detectEvidence: optEvidence.classList.contains('active'),
      detectFraming: optFraming.classList.contains('active'),
      detectLanguage: optLanguage.classList.contains('active')
    };

    const analyzeResponse = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcript, settings })
    });

    if (!analyzeResponse.ok) throw new Error('Analysis failed');

    const data = await analyzeResponse.json();
    displayResults(data);

    setYouTubeBtnState('Transcribe & Analyze', false, false);
    setYouTubeStatus('', false);

  } catch (error) {
    console.error('[Factify Popup] YouTube flow error:', error);
    setYouTubeBtnState('Transcribe & Analyze', false, false);
    setYouTubeStatus(error.message || 'Something went wrong. Please try again.', true);
  }
});

// Load options from storage
async function loadOptions() {
  const result = await chrome.storage.local.get(['factifyOptions']);
  const options = result.factifyOptions || defaultOptions;

  // Apply saved state to buttons
  optStructure.classList.toggle('active', options.structure !== false);
  optRelevance.classList.toggle('active', options.relevance !== false);
  optEvidence.classList.toggle('active', options.evidence !== false);
  optFraming.classList.toggle('active', options.framing !== false);
  optLanguage.classList.toggle('active', options.language !== false);
}

// Save options to storage
async function saveOptions() {
  const options = {
    structure: optStructure.classList.contains('active'),
    relevance: optRelevance.classList.contains('active'),
    evidence: optEvidence.classList.contains('active'),
    framing: optFraming.classList.contains('active'),
    language: optLanguage.classList.contains('active')
  };
  await chrome.storage.local.set({ factifyOptions: options });
}

// Set up click handlers for option buttons
function setupOptionButtons() {
  [optStructure, optRelevance, optEvidence, optFraming, optLanguage].forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      saveOptions();
    });
  });
}

// Filter analysis results based on which category toggles are active
function filterResults(data, settings) {
  if (!data || !data.findings) return data;

  const activeCategories = [];
  if (settings.detectStructure) activeCategories.push('structure');
  if (settings.detectRelevance) activeCategories.push('relevance');
  if (settings.detectEvidence) activeCategories.push('evidence');
  if (settings.detectFraming) activeCategories.push('framing');
  if (settings.detectLanguage) activeCategories.push('language');

  // If all are active, no filtering needed
  if (activeCategories.length === 5) return data;

  return {
    ...data,
    findings: data.findings.filter(f => activeCategories.includes(f.category))
  };
}

// Add debug logging for selection and analyze button
function showSelectedText(text) {
  console.log('[Factify Popup] showSelectedText called with:', text);
  if (text && text.trim()) {
    instructions.style.display = 'none';
    selectedTextContainer.style.display = 'block';
    selectedTextEl.textContent = text.length > 500 ? text.substring(0, 500) + '...' : text;
    analyzeBtn.disabled = false;
    console.log('[Factify Popup] Analyze button enabled');
  } else {
    analyzeBtn.disabled = true;
    console.log('[Factify Popup] No text, analyze button disabled');
  }
}

// Analyze button click
analyzeBtn.addEventListener('click', async () => {
  console.log('[Factify Popup] Analyze button clicked, currentSelectedText:', currentSelectedText);
  if (!currentSelectedText) return;
  
  const btnText = analyzeBtn.querySelector('.btn-text');
  const btnLoader = analyzeBtn.querySelector('.btn-loader');
  
  // Show loading state
  btnText.textContent = 'Analyzing...';
  btnLoader.style.display = 'block';
  analyzeBtn.disabled = true;
  
  try {
    const settings = {
      detectStructure: optStructure.classList.contains('active'),
      detectRelevance: optRelevance.classList.contains('active'),
      detectEvidence: optEvidence.classList.contains('active'),
      detectFraming: optFraming.classList.contains('active'),
      detectLanguage: optLanguage.classList.contains('active')
    };
    
    // Also show loading state on the page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'showResults', loading: true });
      }
    } catch (_) {}

    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: currentSelectedText, settings })
    });
    
    if (!response.ok) throw new Error('Analysis failed');
    
    const data = await response.json();
    
    // Filter findings based on active options
    const filteredData = filterResults(data, settings);
    displayResults(filteredData);

    // Forward filtered results to the content script so highlights appear on the page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'showResults', loading: false, data: filteredData });
      }
    } catch (_) {}
    
  } catch (error) {
    console.error('Analysis error:', error);
    findings.innerHTML = `<div class="finding-item"><div class="finding-text">Error: ${error.message}</div></div>`;
    resultsSection.style.display = 'block';
  } finally {
    btnText.textContent = 'Analyze Selection';
    btnLoader.style.display = 'none';
    analyzeBtn.disabled = false;
  }
});

function displayResults(data) {
  // Calculate credibility score from the API response
  let score = '--';
  if (data.overall) {
    // Average of all scores from the API
    const { structureScore, relevanceScore, evidenceScore, framingScore, languageScore, verifiabilityScore } = data.overall;
    score = Math.round((structureScore + relevanceScore + evidenceScore + framingScore + languageScore + verifiabilityScore) / 6);
  } else if (data.credibilityScore !== undefined) {
    score = data.credibilityScore;
  } else if (data.score !== undefined) {
    score = data.score;
  }
  scoreValue.textContent = typeof score === 'number' ? Math.round(score) : score;

  // Animate the SVG score ring
  const scoreRing = document.getElementById('scoreRing');
  if (scoreRing && typeof score === 'number') {
    const r = 36;
    const circumference = 2 * Math.PI * r;
    const fraction = Math.max(0, Math.min(100, score)) / 100;
    scoreRing.style.strokeDasharray = circumference;
    scoreRing.style.strokeDashoffset = circumference * (1 - fraction);
  }
  
  // Build findings from the API response
  let findingsHtml = '';
  
  // Handle the findings array format from the API
  if (data.findings && data.findings.length > 0) {
    data.findings.forEach(finding => {
      const category = finding.category || 'general';
      const categoryLabels = {
        'structure': 'Structure Issue',
        'relevance': 'Relevance Issue',
        'evidence': 'Evidence Issue',
        'framing': 'Framing Issue',
        'language': 'Language Issue'
      };
      const dotColors = {
        'structure': '#8b7a2b',
        'relevance': '#3c81b0',
        'evidence': '#2d8d70',
        'framing': '#8f68a4',
        'language': '#ae615c'
      };
      const dotColor = dotColors[category] || '#6b6b6b';
      findingsHtml += `
        <div class="finding-item ${category}">
          <div class="finding-type"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:4px;vertical-align:middle;"></span>${categoryLabels[category] || 'Finding'}</div>
          <div class="finding-text"><strong>${finding.label || finding.categoryId || category}:</strong> ${finding.explanation}</div>
          ${finding.quote ? `<div class="finding-quote">"${finding.quote}"</div>` : ''}
        </div>
      `;
    });
  }
  
  // Also handle legacy format with separate arrays
  if (data.biases && data.biases.length > 0) {
    data.biases.forEach(bias => {
      findingsHtml += `
        <div class="finding-item bias">
          <div class="finding-type">Bias Detected</div>
          <div class="finding-text"><strong>${bias.type || 'Bias'}:</strong> ${bias.explanation || bias.description || bias}</div>
        </div>
      `;
    });
  }
  
  if (data.fallacies && data.fallacies.length > 0) {
    data.fallacies.forEach(fallacy => {
      findingsHtml += `
        <div class="finding-item fallacy">
          <div class="finding-type">Logical Fallacy</div>
          <div class="finding-text"><strong>${fallacy.type || 'Fallacy'}:</strong> ${fallacy.explanation || fallacy.description || fallacy}</div>
        </div>
      `;
    });
  }
  
  if (!findingsHtml) {
    findingsHtml = `
      <div class="finding-item">
        <div class="finding-text">No significant issues detected. The text appears to be relatively neutral and well-reasoned.</div>
      </div>
    `;
  }
  
  findings.innerHTML = findingsHtml;
  
  // Show rewrite if available
  if (data.rewrite || data.suggestedRewrite) {
    rewriteText.textContent = data.rewrite || data.suggestedRewrite;
    rewriteSection.style.display = 'block';
  } else {
    rewriteSection.style.display = 'none';
  }
  
  resultsSection.style.display = 'block';
}

// Close results
closeResultsBtn.addEventListener('click', () => {
  resultsSection.style.display = 'none';
});

// Copy rewrite
copyRewriteBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(rewriteText.textContent);
    copyRewriteBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyRewriteBtn.textContent = 'Copy Rewrite';
    }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
});
