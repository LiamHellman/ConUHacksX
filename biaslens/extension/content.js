// Content script - runs on all pages
let factifyButton = null;
let resultsPanel = null;
let isProcessingClick = false;
let highlights = []; // Track highlighted elements for cleanup

// Highlight colors matching the paper editorial palette
const HIGHLIGHT_COLORS = {
  fallacy: { bg: 'rgba(184, 134, 11, 0.15)', border: 'rgba(184, 134, 11, 0.6)' },
  bias: { bg: 'rgba(196, 64, 48, 0.12)', border: 'rgba(196, 64, 48, 0.6)' },
  tactic: { bg: 'rgba(46, 125, 110, 0.15)', border: 'rgba(46, 125, 110, 0.6)' }
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
      // Always store current selection so popup can access it
      try { chrome.storage.local.set({ selectedText: text }); } catch(_) {}
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
    <span class="factify-icon">F</span>
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
    
    // Show loading panel immediately
    showResultsPanel(true, null, null);
    
    // Fire-and-forget to background — results come back via onMessage
    try {
      chrome.runtime.sendMessage({ action: 'analyzeText', text: selectedText });
    } catch (err) {
      console.error('[Factify] sendMessage failed:', err);
      // Fallback: do the fetch directly from the content script
      directAnalysis(selectedText);
    }
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

// Fallback: fetch analysis directly if background is unavailable
async function directAnalysis(text) {
  try {
    const response = await fetch('https://factify-api.onrender.com/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, settings: {} })
    });
    if (!response.ok) throw new Error('Analysis failed (' + response.status + ')');
    const data = await response.json();
    
    // Filter findings by active option toggles
    try {
      const result = await chrome.storage.local.get(['factifyOptions']);
      const opts = result.factifyOptions || { bias: true, fallacy: true, tactic: true };
      if (data.findings) {
        const active = [];
        if (opts.bias) active.push('bias');
        if (opts.fallacy) active.push('fallacy');
        if (opts.tactic) active.push('tactic');
        if (active.length < 3) {
          data.findings = data.findings.filter(f => active.includes(f.category));
        }
      }
    } catch (_) {}
    
    showResultsPanel(false, data, null);
  } catch (err) {
    showResultsPanel(false, null, err.message);
  }
}

function hideFactifyButton() {
  if (factifyButton) {
    factifyButton.remove();
    factifyButton = null;
  }
}

function showResultsPanel(loading, data, error) {
  hideResultsPanel();
  
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
    
    const r = 33;
    const circumference = 2 * Math.PI * r;
    const fraction = typeof score === 'number' ? Math.max(0, Math.min(100, score)) / 100 : 0;
    const dashOffset = circumference * (1 - fraction);
    contentHtml = `
      <div class="factify-score">
        <div class="factify-score-circle">
          <svg class="factify-score-ring" width="70" height="70">
            <circle cx="35" cy="35" r="${r}" stroke="#ede7db" stroke-width="4" fill="none" />
            <circle cx="35" cy="35" r="${r}" stroke="#c44030" stroke-width="4" fill="none"
              stroke-linecap="butt" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
              style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 0.7s ease-out;" />
          </svg>
          <span class="factify-score-value">${typeof score === 'number' ? Math.round(score) : score}</span>
        </div>
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
      data.findings.forEach((finding, index) => {
        const category = finding.category || 'general';
        const findingId = finding.id || `finding-${index}`;
        contentHtml += `
          <div class="factify-finding ${category}" data-finding-id="${findingId}" data-category="${category}">
            <div class="factify-finding-type">${categoryLabels[category] || 'Finding'}</div>
            <div class="factify-finding-text"><strong>${finding.label || finding.categoryId || category}:</strong> ${finding.explanation}</div>
            ${finding.quote ? `<div class="factify-finding-quote">"${finding.quote}"</div>` : ''}
          </div>
        `;
      });
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
    
    // Apply highlights to the page
    if (data.findings && data.findings.length > 0) {
      buildHighlightSpans(data.findings);
    }
  }
  
  resultsPanel.innerHTML = `
    <div class="factify-header">
      <div class="factify-logo">
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
      const category = findingEl.dataset.category || '';
      scrollToHighlight(findingId, category);
    });
  });
}

// Scroll to and highlight a highlight span on the page
function scrollToHighlight(findingId, category) {
  // Find any highlight span whose data-finding-ids list contains this ID
  const allHighlights = document.querySelectorAll('.factify-highlight[data-finding-ids]');
  const matchingEls = [];
  for (const el of allHighlights) {
    const ids = (el.dataset.findingIds || '').split(',');
    if (ids.includes(findingId)) {
      matchingEls.push(el);
    }
  }
  if (matchingEls.length === 0) return;

  // Strong highlight colors per category — opaque enough to override any existing color
  const highlightStyles = {
    bias:    { bg: 'rgba(196, 64, 48, 0.25)',  border: '3px solid #c44030', shadow: '0 0 12px rgba(196, 64, 48, 0.5)' },
    fallacy: { bg: 'rgba(184, 134, 11, 0.25)', border: '3px solid #b8860b', shadow: '0 0 12px rgba(184, 134, 11, 0.5)' },
    tactic:  { bg: 'rgba(46, 125, 110, 0.25)', border: '3px solid #2e7d6e', shadow: '0 0 12px rgba(46, 125, 110, 0.5)' }
  };
  const style = highlightStyles[category] || highlightStyles.tactic;

  // First, dim ALL highlights to make the selected one stand out
  allHighlights.forEach(el => {
    el.dataset.origBg = el.style.background;
    el.dataset.origBorder = el.style.borderBottom;
    el.dataset.origShadow = el.style.boxShadow || '';
    el.style.background = 'rgba(200, 192, 180, 0.08)';
    el.style.borderBottom = '2px solid rgba(200, 192, 180, 0.3)';
    el.style.boxShadow = '';
  });

  // Scroll to first matching element
  matchingEls[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Then strongly highlight the matching spans in the correct category color
  matchingEls.forEach(el => {
    el.style.background = style.bg;
    el.style.borderBottom = style.border;
    el.style.boxShadow = style.shadow;
  });

  // Restore all highlights after a delay
  setTimeout(() => {
    allHighlights.forEach(el => {
      el.style.background = el.dataset.origBg || '';
      el.style.borderBottom = el.dataset.origBorder || '';
      el.style.boxShadow = el.dataset.origShadow || '';
    });
  }, 2500);
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
// Uses a sweep-line approach: concatenate all text nodes to search across node
// boundaries, then process each node once with all its intersecting highlights.
function buildHighlightSpans(findings) {
  if (!findings || findings.length === 0) return;
  removeHighlights();

  // 1. Collect every text node in the body (skip our UI, scripts, styles)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('#factify-results-panel, #factify-analyze-btn, script, style, noscript'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodeEntries = []; // {node, globalStart, globalEnd}
  let fullText = '';
  let n;
  while ((n = walker.nextNode())) {
    const start = fullText.length;
    fullText += n.textContent;
    nodeEntries.push({ node: n, globalStart: start, globalEnd: fullText.length });
  }

  if (!fullText) return;

  // 2. Locate every finding's quote inside the concatenated page text
  const ranges = [];

  findings.forEach((finding, idx) => {
    const quote = finding.quote;
    if (!quote || quote.trim().length < 2) return;

    const findingId = finding.id || `finding-${idx}`;
    const category = finding.category || 'tactic';

    let pos = -1;
    let matchLen = quote.length;

    // Exact match
    pos = fullText.indexOf(quote);

    // Case-insensitive fallback
    if (pos === -1) {
      pos = fullText.toLowerCase().indexOf(quote.toLowerCase());
    }

    // Whitespace-normalised regex fallback (handles line-break / multi-space diffs)
    if (pos === -1) {
      try {
        const escaped = quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escaped.replace(/\s+/g, '\\s+');
        const m = fullText.match(new RegExp(pattern, 'i'));
        if (m) { pos = m.index; matchLen = m[0].length; }
      } catch (_) { /* regex compilation failed – skip */ }
    }

    if (pos !== -1) {
      ranges.push({ start: pos, end: pos + matchLen, findingId, category, finding });
    }
  });

  if (ranges.length === 0) return;

  // 3. For each text node, apply every intersecting highlight in a single pass.
  //    We iterate nodes in document order; each node is replaced at most once,
  //    so there are no stale-reference issues.
  nodeEntries.forEach(entry => {
    const { node, globalStart, globalEnd } = entry;
    if (!node.parentNode) return;

    // Collect ranges that touch this node
    const intersecting = ranges.filter(r => r.start < globalEnd && r.end > globalStart);
    if (intersecting.length === 0) return;

    // Build a sorted set of cut-points (local offsets within this node)
    const cuts = new Set([0, node.textContent.length]);
    intersecting.forEach(r => {
      cuts.add(Math.max(0, r.start - globalStart));
      cuts.add(Math.min(node.textContent.length, r.end - globalStart));
    });
    const sorted = [...cuts].sort((a, b) => a - b);

    // Produce a document fragment with plain-text and highlight segments
    const fragment = document.createDocumentFragment();
    const text = node.textContent;

    for (let i = 0; i < sorted.length - 1; i++) {
      const segStart = sorted[i];
      const segEnd   = sorted[i + 1];
      const segText  = text.substring(segStart, segEnd);
      if (!segText) continue;

      // Does any highlight fully cover this segment?
      const gSegStart = globalStart + segStart;
      const gSegEnd   = globalStart + segEnd;
      const covering  = intersecting.filter(r => r.start <= gSegStart && r.end >= gSegEnd);

      if (covering.length > 0) {
        // Use the first finding's category for the primary color,
        // but store ALL finding IDs so every panel item can target this span
        const primary = covering[0];
        const { category, finding } = primary;
        const colors = HIGHLIGHT_COLORS[category] || HIGHLIGHT_COLORS.tactic;
        const allIds = covering.map(c => c.findingId);
        const allLabels = covering.map(c => {
          const f = c.finding;
          return `${f.label || f.categoryId || c.category}: ${f.explanation}`;
        });

        // If multiple categories overlap, use a combined border
        const uniqueCategories = [...new Set(covering.map(c => c.category))];
        let borderStyle;
        if (uniqueCategories.length > 1) {
          // Multi-category: thicker dashed border
          const borderColors = uniqueCategories.map(cat => {
            const c = HIGHLIGHT_COLORS[cat] || HIGHLIGHT_COLORS.tactic;
            return c.border;
          });
          borderStyle = `border-bottom: 3px solid ${borderColors[0]}; border-image: linear-gradient(to right, ${borderColors.join(', ')}) 1;`;
        } else {
          borderStyle = `border-bottom: 2px solid ${colors.border};`;
        }

        const span = document.createElement('span');
        span.className = 'factify-highlight';
        span.dataset.category = category;
        span.dataset.findingIds = allIds.join(',');
        span.dataset.label = covering.map(c => c.finding.label || c.finding.categoryId || c.category).join(' | ');
        span.style.cssText = `
          background: ${colors.bg};
          ${borderStyle}
          padding: 1px 2px;
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.2s;
        `;
        span.textContent = segText;
        span.title = allLabels.join('\n');
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Scroll to the first finding in the panel
          scrollToFinding(primary.findingId);
        });

        fragment.appendChild(span);
        highlights.push(span);
      } else {
        fragment.appendChild(document.createTextNode(segText));
      }
    }

    node.parentNode.replaceChild(fragment, node);
  });
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
    return false; // synchronous response, no need to keep channel open
  } else if (request.action === 'showResults') {
    showResultsPanel(request.loading, request.data, request.error);
  }
  return false;
});
