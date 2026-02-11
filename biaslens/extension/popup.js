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
const optBias = document.getElementById('optBias');
const optFallacy = document.getElementById('optFallacy');
const optEthics = document.getElementById('optEthics');
const optTone = document.getElementById('optTone');

let currentSelectedText = '';
let currentYouTubeTabId = null;

// Default options state
const defaultOptions = {
  bias: true,
  fallacy: true,
  ethics: false,
  tone: false
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
  
  // Also try to get selection from active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
      if (response?.text) {
        currentSelectedText = response.text;
        showSelectedText(currentSelectedText);
      }
    }
  } catch (e) {
    // Content script might not be loaded
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
      console.log('[Factify Popup] Content script transcript failed, trying API:', contentErr);
      // Fallback: ask background script to use the server API
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

    if (!transcript || transcript.trim().length < 30) {
      throw new Error(contentScriptError || 'No transcript available for this video. It may not have captions.');
    }

    // Step 2: Show transcript preview
    transcriptSection.style.display = 'block';
    transcriptText.textContent = transcript.length > 600 ? transcript.substring(0, 600) + '...' : transcript;

    // Step 3: Automatically analyze the transcript
    setYouTubeBtnState('Analyzing...', true, true);
    setYouTubeStatus('Analyzing transcript for bias, fallacies, and manipulation...', false);

    const settings = {
      detectBias: optBias.classList.contains('active'),
      detectFallacies: optFallacy.classList.contains('active'),
      detectEthicalConcerns: optEthics.classList.contains('active'),
      analyzeTone: optTone.classList.contains('active')
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
  optBias.classList.toggle('active', options.bias);
  optFallacy.classList.toggle('active', options.fallacy);
  optEthics.classList.toggle('active', options.ethics);
  optTone.classList.toggle('active', options.tone);
}

// Save options to storage
async function saveOptions() {
  const options = {
    bias: optBias.classList.contains('active'),
    fallacy: optFallacy.classList.contains('active'),
    ethics: optEthics.classList.contains('active'),
    tone: optTone.classList.contains('active')
  };
  await chrome.storage.local.set({ factifyOptions: options });
}

// Set up click handlers for option buttons
function setupOptionButtons() {
  [optBias, optFallacy, optEthics, optTone].forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      saveOptions();
    });
  });
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
      detectBias: optBias.classList.contains('active'),
      detectFallacies: optFallacy.classList.contains('active'),
      detectEthicalConcerns: optEthics.classList.contains('active'),
      analyzeTone: optTone.classList.contains('active')
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
    displayResults(data);

    // Forward results to the content script so highlights appear on the page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'showResults', loading: false, data });
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
    const { fallacyScore, biasScore, tacticScore, verifiabilityScore } = data.overall;
    score = Math.round((fallacyScore + biasScore + tacticScore + verifiabilityScore) / 4);
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
        'fallacy': 'Logical Fallacy',
        'bias': 'Bias Detected',
        'tactic': 'Persuasion Tactic'
      };
      findingsHtml += `
        <div class="finding-item ${category}">
          <div class="finding-type">${categoryLabels[category] || 'Finding'}</div>
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
