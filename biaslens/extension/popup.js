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
const optEthics = document.getElementById('optEthics');
const optTone = document.getElementById('optTone');

let currentSelectedText = '';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
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

function showSelectedText(text) {
  if (text && text.trim()) {
    instructions.style.display = 'none';
    selectedTextContainer.style.display = 'block';
    selectedTextEl.textContent = text.length > 500 ? text.substring(0, 500) + '...' : text;
    analyzeBtn.disabled = false;
  }
}

// Analyze button click
analyzeBtn.addEventListener('click', async () => {
  if (!currentSelectedText) return;
  
  const btnText = analyzeBtn.querySelector('.btn-text');
  const btnLoader = analyzeBtn.querySelector('.btn-loader');
  
  // Show loading state
  btnText.textContent = 'Analyzing...';
  btnLoader.style.display = 'block';
  analyzeBtn.disabled = true;
  
  try {
    const settings = {
      detectBias: optBias.checked,
      detectFallacies: optFallacy.checked,
      detectEthicalConcerns: optEthics.checked,
      analyzeTone: optTone.checked
    };
    
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: currentSelectedText, settings })
    });
    
    if (!response.ok) throw new Error('Analysis failed');
    
    const data = await response.json();
    displayResults(data);
    
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
  // Show score
  const score = data.credibilityScore ?? data.score ?? '--';
  scoreValue.textContent = typeof score === 'number' ? Math.round(score) : score;
  
  // Build findings
  let findingsHtml = '';
  
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
  
  if (data.ethicalConcerns && data.ethicalConcerns.length > 0) {
    data.ethicalConcerns.forEach(concern => {
      findingsHtml += `
        <div class="finding-item ethics">
          <div class="finding-type">Ethical Concern</div>
          <div class="finding-text">${concern.explanation || concern.description || concern}</div>
        </div>
      `;
    });
  }
  
  if (data.tone) {
    findingsHtml += `
      <div class="finding-item tone">
        <div class="finding-type">Tone Analysis</div>
        <div class="finding-text">${data.tone.description || data.tone}</div>
      </div>
    `;
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
