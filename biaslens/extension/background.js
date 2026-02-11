// Background service worker
const API_URL = 'https://factify-api.onrender.com';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeText' && sender.tab?.id) {
    const tabId = sender.tab.id;
    // Show loading on the page
    chrome.tabs.sendMessage(tabId, { action: 'showResults', loading: true }).catch(() => {});
    // Do analysis and send results back
    doAnalysis(request.text)
      .then(data => {
        chrome.tabs.sendMessage(tabId, { action: 'showResults', loading: false, data }).catch(() => {});
      })
      .catch(err => {
        chrome.tabs.sendMessage(tabId, { action: 'showResults', loading: false, error: err.message }).catch(() => {});
      });
  }
  // Always return false — we don't use sendResponse
  return false;
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

// Perform analysis via API
async function doAnalysis(text) {
  const result = await chrome.storage.local.get(['factifyOptions']);
  const options = result.factifyOptions || { bias: true, fallacy: true, tactic: true };
  
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, settings: {} })
  });
  if (!response.ok) throw new Error('Analysis failed');
  const data = await response.json();
  
  // Filter findings based on active category toggles
  if (data.findings) {
    const activeCategories = [];
    if (options.bias) activeCategories.push('bias');
    if (options.fallacy) activeCategories.push('fallacy');
    if (options.tactic) activeCategories.push('tactic');
    
    if (activeCategories.length < 3) {
      data.findings = data.findings.filter(f => activeCategories.includes(f.category));
    }
  }
  
  return data;
}

// Show inline results for context menu (no sendResponse available)
async function showInlineResults(tabId, text) {
  chrome.tabs.sendMessage(tabId, {
    action: 'showResults',
    loading: true
  }).catch(() => {});
  try {
    const data = await doAnalysis(text);
    chrome.tabs.sendMessage(tabId, {
      action: 'showResults',
      loading: false,
      data
    }).catch(() => {});
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showResults',
      loading: false,
      error: error.message
    }).catch(() => {});
  }
}
