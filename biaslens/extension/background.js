// Background service worker
const API_URL = 'https://factify-api.onrender.com';

// Default options
const defaultOptions = {
  bias: true,
  fallacy: true,
  tactic: true
};

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeText') {
    // Open the popup - Chrome doesn't allow programmatic popup opening,
    // so we'll show inline results instead
    showInlineResults(sender.tab.id, request.text);
  }
  return true;
});

// Context menu for right-click analysis
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'factify-analyze',
    title: 'Analyze with Factify',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'factify-analyze' && info.selectionText) {
    showInlineResults(tab.id, info.selectionText);
  }
});

async function showInlineResults(tabId, text) {
  // Get saved filter options
  const result = await chrome.storage.local.get(['factifyOptions']);
  const options = result.factifyOptions || defaultOptions;
  
  // First show loading state
  chrome.tabs.sendMessage(tabId, {
    action: 'showResults',
    loading: true
  });
  
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        settings: {
          detectBias: options.bias,
          detectFallacies: options.fallacy,
          detectTactics: options.tactic
        }
      })
    });
    
    if (!response.ok) throw new Error('Analysis failed');
    
    const data = await response.json();
    
    chrome.tabs.sendMessage(tabId, {
      action: 'showResults',
      loading: false,
      data,
      filters: options
    });
    
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showResults',
      loading: false,
      error: error.message
    });
  }
}
