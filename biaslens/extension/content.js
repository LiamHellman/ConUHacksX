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
      data.findings.forEach((finding, index) => {
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
function buildHighlightSpans(findings) {
  if (!findings || findings.length === 0) return;
  
  // Get all text nodes in the body
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip our own elements and script/style tags
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#factify-results-panel, #factify-analyze-btn, script, style, noscript')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // For each finding, try to find and highlight the quote
  findings.forEach((finding, index) => {
    if (!finding.quote || finding.quote.length < 5) return;
    
    const category = finding.category || 'tactic';
    const colors = HIGHLIGHT_COLORS[category] || HIGHLIGHT_COLORS.tactic;
    const searchText = finding.quote.trim();
    const findingId = finding.id || `finding-${index}`;
    
    // Search through text nodes
    for (let i = 0; i < textNodes.length; i++) {
      const textNode = textNodes[i];
      if (!textNode.parentNode) continue; // Already processed
      
      const text = textNode.textContent;
      const index = text.toLowerCase().indexOf(searchText.toLowerCase());
      
      if (index !== -1) {
        // Found the text, split and wrap
        const before = text.substring(0, index);
        const match = text.substring(index, index + searchText.length);
        const after = text.substring(index + searchText.length);
        
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
        
        // Tooltip on hover
        span.title = `${finding.label || category}: ${finding.explanation}`;
        
        // Click handler to scroll to finding in panel
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          scrollToFinding(findingId);
        });
        
        // Create new structure
        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(span);
        if (after) fragment.appendChild(document.createTextNode(after));
        
        textNode.parentNode.replaceChild(fragment, textNode);
        highlights.push(span);
        
        break; // Only highlight first occurrence
      }
    }
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

// Helper: Get all text nodes within a root element
function getTextNodes(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#factify-results-panel, #factify-analyze-btn, script, style, noscript')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

// Helper: Map global offset to {node, localOffset}
function mapOffsetToNode(textNodes, offset) {
  let count = 0;
  for (const node of textNodes) {
    const len = node.textContent.length;
    if (offset < count + len) {
      return { node, localOffset: offset - count };
    }
    count += len;
  }
  // fallback: end of last node
  return { node: textNodes[textNodes.length - 1], localOffset: textNodes[textNodes.length - 1].textContent.length };
}

// Highlight spans in the DOM using start/end indices
function highlightSpansInDom(root, text, spans) {
  removeHighlights();
  const textNodes = getTextNodes(root);
  let globalOffset = 0;
  for (const span of spans) {
    const { start, end, primary } = span;
    if (end <= start) continue;
    // Map start/end to nodes
    const startMap = mapOffsetToNode(textNodes, start);
    const endMap = mapOffsetToNode(textNodes, end);
    if (!startMap.node || !endMap.node) continue;
    // If in same node
    if (startMap.node === endMap.node) {
      const node = startMap.node;
      const before = node.textContent.slice(0, startMap.localOffset);
      const match = node.textContent.slice(startMap.localOffset, endMap.localOffset);
      const after = node.textContent.slice(endMap.localOffset);
      const spanEl = document.createElement('span');
      spanEl.className = 'factify-highlight';
      spanEl.dataset.category = primary?.category || 'tactic';
      spanEl.dataset.findingId = primary?.id || '';
      spanEl.dataset.label = primary?.label || primary?.categoryId || '';
      const colors = HIGHLIGHT_COLORS[primary?.category] || HIGHLIGHT_COLORS.tactic;
      spanEl.style.cssText = `background: ${colors.bg}; border-bottom: 2px solid ${colors.border}; padding: 1px 2px; border-radius: 2px; cursor: pointer; transition: background 0.2s;`;
      spanEl.textContent = match;
      spanEl.title = `${primary?.label || primary?.category}: ${primary?.explanation || ''}`;
      spanEl.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); scrollToFinding(primary?.id || '');
      });
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(spanEl);
      if (after) frag.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(frag, node);
      highlights.push(spanEl);
    } else {
      // Multi-node: split start, wrap all in-between, split end
      // Start node
      const startNode = startMap.node;
      const startRest = startNode.textContent.slice(startMap.localOffset);
      const before = startNode.textContent.slice(0, startMap.localOffset);
      const startSpan = document.createElement('span');
      startSpan.className = 'factify-highlight';
      startSpan.dataset.category = primary?.category || 'tactic';
      startSpan.dataset.findingId = primary?.id || '';
      startSpan.dataset.label = primary?.label || primary?.categoryId || '';
      const colors = HIGHLIGHT_COLORS[primary?.category] || HIGHLIGHT_COLORS.tactic;
      startSpan.style.cssText = `background: ${colors.bg}; border-bottom: 2px solid ${colors.border}; padding: 1px 2px; border-radius: 2px; cursor: pointer; transition: background 0.2s;`;
      startSpan.textContent = startRest;
      startSpan.title = `${primary?.label || primary?.category}: ${primary?.explanation || ''}`;
      startSpan.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); scrollToFinding(primary?.id || '');
      });
      const startFrag = document.createDocumentFragment();
      if (before) startFrag.appendChild(document.createTextNode(before));
      startFrag.appendChild(startSpan);
      startNode.parentNode.replaceChild(startFrag, startNode);
      highlights.push(startSpan);
      // Middle nodes
      let idx = textNodes.indexOf(startNode) + 1;
      while (idx < textNodes.length && textNodes[idx] !== endMap.node) {
        const midNode = textNodes[idx];
        const midSpan = document.createElement('span');
        midSpan.className = 'factify-highlight';
        midSpan.dataset.category = primary?.category || 'tactic';
        midSpan.dataset.findingId = primary?.id || '';
        midSpan.dataset.label = primary?.label || primary?.categoryId || '';
        midSpan.style.cssText = `background: ${colors.bg}; border-bottom: 2px solid ${colors.border}; padding: 1px 2px; border-radius: 2px; cursor: pointer; transition: background 0.2s;`;
        midSpan.textContent = midNode.textContent;
        midSpan.title = `${primary?.label || primary?.category}: ${primary?.explanation || ''}`;
        midSpan.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation(); scrollToFinding(primary?.id || '');
        });
        midNode.parentNode.replaceChild(midSpan, midNode);
        highlights.push(midSpan);
        idx++;
      }
      // End node
      const endNode = endMap.node;
      const endBefore = endNode.textContent.slice(0, endMap.localOffset);
      const endAfter = endNode.textContent.slice(endMap.localOffset);
      const endSpan = document.createElement('span');
      endSpan.className = 'factify-highlight';
      endSpan.dataset.category = primary?.category || 'tactic';
      endSpan.dataset.findingId = primary?.id || '';
      endSpan.dataset.label = primary?.label || primary?.categoryId || '';
      endSpan.style.cssText = `background: ${colors.bg}; border-bottom: 2px solid ${colors.border}; padding: 1px 2px; border-radius: 2px; cursor: pointer; transition: background 0.2s;`;
      endSpan.textContent = endBefore;
      endSpan.title = `${primary?.label || primary?.category}: ${primary?.explanation || ''}`;
      endSpan.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); scrollToFinding(primary?.id || '');
      });
      const endFrag = document.createDocumentFragment();
      endFrag.appendChild(endSpan);
      if (endAfter) endFrag.appendChild(document.createTextNode(endAfter));
      endNode.parentNode.replaceChild(endFrag, endNode);
      highlights.push(endSpan);
    }
  }
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selection = window.getSelection().toString().trim();
    sendResponse({ text: selection });
  } else if (request.action === 'showResults') {
    showResultsPanel(request.loading, request.data, request.error);
  }
  return true;
});
