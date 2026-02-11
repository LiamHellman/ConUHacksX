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

// Options
const optBias = document.getElementById('optBias');
const optFallacy = document.getElementById('optFallacy');
const optTactic = document.getElementById('optTactic');

let currentSelectedText = '';

// Default options state
const defaultOptions = {
  bias: true,
  fallacy: true,
  tactic: true
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved options state
  await loadOptions();
  
  // Set up toggle button click handlers
  setupOptionButtons();
  
  // Strategy 1: Get selected text from storage (stored whenever user selects text on page)
  try {
    const result = await chrome.storage.local.get(['selectedText']);
    if (result.selectedText) {
      currentSelectedText = result.selectedText;
      showSelectedText(currentSelectedText);
    }
  } catch (e) {
    console.log('[Factify Popup] storage read failed:', e);
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

// Load options from storage
async function loadOptions() {
  const result = await chrome.storage.local.get(['factifyOptions']);
  const options = result.factifyOptions || defaultOptions;
  
  // Apply saved state to buttons
  optBias.classList.toggle('active', options.bias);
  optFallacy.classList.toggle('active', options.fallacy);
  optTactic.classList.toggle('active', options.tactic !== false);
}

// Save options to storage
async function saveOptions() {
  const options = {
    bias: optBias.classList.contains('active'),
    fallacy: optFallacy.classList.contains('active'),
    tactic: optTactic.classList.contains('active')
  };
  await chrome.storage.local.set({ factifyOptions: options });
}

// Set up click handlers for option buttons
function setupOptionButtons() {
  [optBias, optFallacy, optTactic].forEach(btn => {
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
  if (settings.detectBias) activeCategories.push('bias');
  if (settings.detectFallacies) activeCategories.push('fallacy');
  if (settings.detectTactics) activeCategories.push('tactic');
  
  // If all are active, no filtering needed
  if (activeCategories.length === 3) return data;
  
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
      detectBias: optBias.classList.contains('active'),
      detectFallacies: optFallacy.classList.contains('active'),
      detectTactics: optTactic.classList.contains('active')
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
      const dotColors = {
        'bias': '#c44030',
        'fallacy': '#b8860b',
        'tactic': '#2e7d6e'
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
