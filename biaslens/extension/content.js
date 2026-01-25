// Content script - runs on all pages
let factifyButton = null;
let resultsPanel = null;
let isProcessingClick = false;
let highlights = []; // Track highlighted elements for cleanup

// Highlight colors matching the app
const HIGHLIGHT_COLORS = {
  fallacy: { bg: 'rgba(239, 68, 68, 0.25)', border: 'rgba(239, 68, 68, 0.6)' },
  bias: { bg: 'rgba(245, 158, 11, 0.25)', border: 'rgba(245, 158, 11, 0.6)' },
  tactic: { bg: 'rgba(59, 130, 246, 0.25)', border: 'rgba(59, 130, 246, 0.6)' }
};

// Listen for text selection
document.addEventListener('mouseup', (e) => {
  // Ignore if we just clicked the button
  if (isProcessingClick) {
    isProcessingClick = false;
    return;
  }
  
  // Ignore clicks on our own elements
  if (factifyButton && factifyButton.contains(e.target)) {
    return;
  }
  if (resultsPanel && resultsPanel.contains(e.target)) {
    return;
  }
  
  // Small delay to let selection complete
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.length > 10) {
      showFactifyButton(e.clientX, e.clientY, text);
    } else {
      hideFactifyButton();
    }
  }, 10);
});

// Hide button when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  if (factifyButton && !factifyButton.contains(e.target)) {
    hideFactifyButton();
  }
});

function showFactifyButton(x, y, text) {
  hideFactifyButton();
  
  factifyButton = document.createElement('div');
  factifyButton.id = 'factify-analyze-btn';
  factifyButton.innerHTML = `
    <span class="factify-icon">⚡</span>
    <span class="factify-text">Analyze with Factify</span>
  `;
  
  // Position near the selection
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  
  factifyButton.style.left = `${x + scrollX}px`;
  factifyButton.style.top = `${y + scrollY + 10}px`;
  
  // Store the selected text
  factifyButton.dataset.text = text;
  
  factifyButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isProcessingClick = true;
    const selectedText = factifyButton.dataset.text;
    
    // Clear the selection to prevent re-triggering
    window.getSelection().removeAllRanges();
    
    hideFactifyButton();
    
    // Store in chrome storage and trigger analysis
    chrome.storage.local.set({ selectedText }, () => {
      chrome.runtime.sendMessage({ 
        action: 'analyzeText', 
        text: selectedText 
      });
    });
  });
  
  document.body.appendChild(factifyButton);
  
  // Ensure button is visible in viewport
  const rect = factifyButton.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    factifyButton.style.left = `${window.innerWidth - rect.width - 20 + scrollX}px`;
  }
  if (rect.bottom > window.innerHeight) {
    factifyButton.style.top = `${y + scrollY - rect.height - 10}px`;
  }
}

function hideFactifyButton() {
  if (factifyButton) {
    factifyButton.remove();
    factifyButton = null;
  }
}

function showResultsPanel(loading, data, error, filters = null) {
  hideResultsPanel();
  
  // Default filters if not provided
  const activeFilters = filters || { bias: true, fallacy: true, tactic: true };
  
  resultsPanel = document.createElement('div');
  resultsPanel.id = 'factify-results-panel';
  
  let contentHtml = '';
  
  if (loading) {
    contentHtml = `
      <div class="factify-loading">
        <div class="factify-spinner"></div>
        <div class="factify-loading-text">Analyzing text...</div>
      </div>
    `;
  } else if (error) {
    contentHtml = `
      <div class="factify-finding">
        <div class="factify-finding-text">Error: ${error}</div>
      </div>
    `;
  } else if (data) {
    // Calculate credibility score from the API response
    let score = '--';
    if (data.overall) {
      const { fallacyScore, biasScore, tacticScore, verifiabilityScore } = data.overall;
      score = Math.round((fallacyScore + biasScore + tacticScore + verifiabilityScore) / 4);
    } else if (data.credibilityScore !== undefined) {
      score = data.credibilityScore;
    } else if (data.score !== undefined) {
      score = data.score;
    }
    
    contentHtml = `
      <div class="factify-score">
        <div class="factify-score-circle">${typeof score === 'number' ? Math.round(score) : score}</div>
        <div class="factify-score-label">Credibility Score</div>
      </div>
    `;
    
    // Handle the findings array format from the API
    if (data.findings && data.findings.length > 0) {
      const categoryLabels = {
        'fallacy': 'Logical Fallacy',
        'bias': 'Bias Detected',
        'tactic': 'Persuasion Tactic'
      };
      
      // Filter findings based on active filters
      const filteredFindings = data.findings.filter(finding => {
        const category = finding.category || 'general';
        if (category === 'bias' && !activeFilters.bias) return false;
        if (category === 'fallacy' && !activeFilters.fallacy) return false;
        if (category === 'tactic' && !activeFilters.tactic) return false;
        return true;
      });
      
      filteredFindings.forEach((finding, index) => {
        const category = finding.category || 'general';
        const findingId = finding.id || `finding-${index}`;
        contentHtml += `
          <div class="factify-finding ${category}" data-finding-id="${findingId}">
            <div class="factify-finding-type">${categoryLabels[category] || 'Finding'}</div>
            <div class="factify-finding-text"><strong>${finding.label || finding.categoryId || category}:</strong> ${finding.explanation}</div>
            ${finding.quote ? `<div class="factify-finding-quote">"${finding.quote}"</div>` : ''}
          </div>
        `;
      });
      
      // Apply highlights only for filtered findings
      if (filteredFindings.length > 0) {
        applyHighlights(filteredFindings);
      }
      
      if (filteredFindings.length === 0) {
        contentHtml += `
          <div class="factify-finding">
            <div class="factify-finding-text">No issues found for the selected categories.</div>
          </div>
        `;
      }
    }
    
    // Also handle legacy format
    if (data.biases && data.biases.length > 0) {
      data.biases.forEach(bias => {
        contentHtml += `
          <div class="factify-finding bias">
            <div class="factify-finding-type">Bias Detected</div>
            <div class="factify-finding-text"><strong>${bias.type || 'Bias'}:</strong> ${bias.explanation || bias.description || bias}</div>
          </div>
        `;
      });
    }
    
    if (data.fallacies && data.fallacies.length > 0) {
      data.fallacies.forEach(fallacy => {
        contentHtml += `
          <div class="factify-finding fallacy">
            <div class="factify-finding-type">Logical Fallacy</div>
            <div class="factify-finding-text"><strong>${fallacy.type || 'Fallacy'}:</strong> ${fallacy.explanation || fallacy.description || fallacy}</div>
          </div>
        `;
      });
    }
    
    if (!data.findings?.length && !data.biases?.length && !data.fallacies?.length) {
      contentHtml += `
        <div class="factify-finding">
          <div class="factify-finding-text">No significant issues detected. The text appears to be relatively neutral and well-reasoned.</div>
        </div>
      `;
    }
  }
  
  resultsPanel.innerHTML = `
    <div class="factify-header">
      <div class="factify-logo">
        <span>⚡</span>
        <span>Factify</span>
      </div>
      <button class="factify-close">&times;</button>
    </div>
    <div class="factify-content">
      ${contentHtml}
    </div>
  `;
  
  document.body.appendChild(resultsPanel);
  
  // Close button handler
  resultsPanel.querySelector('.factify-close').addEventListener('click', hideResultsPanel);
  
  // Make panel draggable
  makeDraggable(resultsPanel);
  
  // Add click handlers to findings to scroll to highlights on page
  addFindingClickHandlers();
}

// Add click handlers to findings in the panel to scroll to highlights
function addFindingClickHandlers() {
  if (!resultsPanel) return;
  
  resultsPanel.querySelectorAll('.factify-finding[data-finding-id]').forEach(findingEl => {
    findingEl.addEventListener('click', () => {
      const findingId = findingEl.dataset.findingId;
      scrollToHighlight(findingId);
    });
  });
}

// Scroll to and highlight a highlight span on the page
function scrollToHighlight(findingId) {
  const highlightEl = document.querySelector(`.factify-highlight[data-finding-id="${findingId}"]`);
  if (!highlightEl) return;
  
  // Scroll into view
  highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Flash effect
  const originalBg = highlightEl.style.background;
  highlightEl.style.background = 'rgba(139, 92, 246, 0.5)';
  highlightEl.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.6)';
  
  setTimeout(() => {
    highlightEl.style.background = originalBg;
    highlightEl.style.boxShadow = '';
  }, 1500);
}

// Make the results panel draggable
function makeDraggable(panel) {
  const header = panel.querySelector('.factify-header');
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('factify-close')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    // Remove right positioning, switch to left
    panel.style.right = 'auto';
    panel.style.left = startLeft + 'px';
    panel.style.top = startTop + 'px';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    
    // Keep panel within viewport
    const rect = panel.getBoundingClientRect();
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
    
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function hideResultsPanel() {
  if (resultsPanel) {
    resultsPanel.remove();
    resultsPanel = null;
  }
  // Also remove highlights when closing the panel
  removeHighlights();
}

// Remove all highlights from the page
function removeHighlights() {
  highlights.forEach(el => {
    if (el && el.parentNode) {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize(); // Merge adjacent text nodes
    }
  });
  highlights = [];
}

// Highlight text on the page based on findings
function applyHighlights(findings) {
  if (!findings || findings.length === 0) return;
  
  console.log('[Factify] Applying highlights for', findings.length, 'findings');
  
  // Build a full text map of the page for cross-node searching
  const pageText = document.body.innerText || document.body.textContent;
  const normalizedPageText = pageText.replace(/\s+/g, ' ').toLowerCase();
  
  // For each finding, try multiple search strategies
  findings.forEach((finding, index) => {
    if (!finding.quote || finding.quote.length < 3) {
      console.log('[Factify] Skipping finding', index, '- no quote or too short');
      return;
    }
    
    const category = finding.category || 'tactic';
    const colors = HIGHLIGHT_COLORS[category] || HIGHLIGHT_COLORS.tactic;
    const searchText = finding.quote.trim();
    const findingId = finding.id || `finding-${index}`;
    
    console.log('[Factify] Looking for:', searchText.substring(0, 50) + '...');
    
    // Try to find and highlight using multiple strategies
    let found = false;
    
    // Strategy 1: Exact match in single text node
    found = tryHighlightExact(searchText, category, colors, findingId, finding);
    if (found) { console.log('[Factify] Found with exact match'); return; }
    
    // Strategy 2: Try unique phrases from the quote (5-8 word chunks)
    const words = searchText.split(/\s+/).filter(w => w.length > 0);
    for (let phraseLen = Math.min(8, words.length); phraseLen >= 4 && !found; phraseLen--) {
      for (let start = 0; start <= words.length - phraseLen && !found; start++) {
        const phrase = words.slice(start, start + phraseLen).join(' ');
        if (phrase.length >= 15) {
          found = tryHighlightExact(phrase, category, colors, findingId, finding);
          if (found) { console.log('[Factify] Found with phrase:', phrase.substring(0, 30)); return; }
        }
      }
    }
    
    // Strategy 3: Try distinctive 3-4 word phrases
    for (let i = 0; i < words.length - 2 && !found; i++) {
      const threeWords = words.slice(i, i + 3).join(' ');
      if (threeWords.length >= 12) {
        found = tryHighlightExact(threeWords, category, colors, findingId, finding);
        if (found) { console.log('[Factify] Found with 3 words:', threeWords); return; }
      }
    }
    
    // Strategy 4: Try quoted text if present
    const quotedMatch = searchText.match(/"([^"]+)"|'([^']+)'|"([^"]+)"/);
    if (quotedMatch) {
      const quoted = quotedMatch[1] || quotedMatch[2] || quotedMatch[3];
      if (quoted && quoted.length > 10) {
        found = tryHighlightExact(quoted, category, colors, findingId, finding);
        if (found) { console.log('[Factify] Found quoted text'); return; }
      }
    }
    
    console.log('[Factify] Could not find text for finding', index, '- quote:', searchText.substring(0, 60));
  });
}

// Build a map of the page text for searching
function getPageTextMap() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#factify-results-panel, #factify-analyze-btn, .factify-highlight, script, style, noscript, head')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.length === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  return textNodes;
}

// Try exact match highlighting
function tryHighlightExact(searchText, category, colors, findingId, finding) {
  if (!searchText || searchText.length < 3) return false;
  
  // Normalize search text
  const normalizedSearchText = searchText
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#factify-results-panel, #factify-analyze-btn, .factify-highlight, script, style, noscript, head')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (!node.parentNode) continue;
    
    const text = node.textContent;
    // Normalize page text the same way
    const normalizedText = text
      .replace(/[''`]/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    const matchIndex = normalizedText.indexOf(normalizedSearchText);
    
    if (matchIndex !== -1) {
      // Find approximate position in original text
      // Count characters up to match point
      let origIndex = 0;
      let normIndex = 0;
      while (normIndex < matchIndex && origIndex < text.length) {
        if (/\s/.test(text[origIndex])) {
          // Skip extra whitespace in original
          while (origIndex < text.length - 1 && /\s/.test(text[origIndex + 1])) {
            origIndex++;
          }
        }
        origIndex++;
        normIndex++;
      }
      
      highlightTextNode(node, origIndex, searchText.length, category, colors, findingId, finding);
      return true;
    }
  }
  return false;
}

// Helper to highlight a portion of a text node
function highlightTextNode(textNode, startIndex, length, category, colors, findingId, finding) {
  const text = textNode.textContent;
  const endIndex = Math.min(startIndex + length, text.length);
  
  const before = text.substring(0, startIndex);
  const match = text.substring(startIndex, endIndex);
  const after = text.substring(endIndex);
  
  const span = document.createElement('span');
  span.className = 'factify-highlight';
  span.dataset.category = category;
  span.dataset.findingId = findingId;
  span.dataset.label = finding.label || finding.categoryId || category;
  span.style.cssText = `
    background: ${colors.bg};
    border-bottom: 2px solid ${colors.border};
    padding: 1px 2px;
    border-radius: 2px;
    cursor: pointer;
    transition: background 0.2s;
  `;
  span.textContent = match;
  span.title = `${finding.label || category}: ${finding.explanation}`;
  
  span.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrollToFinding(findingId);
  });
  
  const fragment = document.createDocumentFragment();
  if (before) fragment.appendChild(document.createTextNode(before));
  fragment.appendChild(span);
  if (after) fragment.appendChild(document.createTextNode(after));
  
  textNode.parentNode.replaceChild(fragment, textNode);
  highlights.push(span);
}

// Scroll to and highlight a finding in the results panel
function scrollToFinding(findingId) {
  if (!resultsPanel) return;
  
  const findingEl = resultsPanel.querySelector(`[data-finding-id="${findingId}"]`);
  if (!findingEl) return;
  
  // Remove previous highlighting
  resultsPanel.querySelectorAll('.factify-finding.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });
  
  // Add highlighting
  findingEl.classList.add('highlighted');
  
  // Scroll into view
  findingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Remove highlight after a delay
  setTimeout(() => {
    findingEl.classList.remove('highlighted');
  }, 2000);
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selection = window.getSelection().toString().trim();
    sendResponse({ text: selection });
  } else if (request.action === 'showResults') {
    showResultsPanel(request.loading, request.data, request.error, request.filters);
  }
  return true;
});
