// Background service worker
const API_URL = 'https://factify-api.onrender.com';

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeText') {
    // Run analysis and send response back via sendResponse
    doAnalysis(request.text)
      .then(data => {
        // Also push results to the content script's panel
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showResults',
            loading: false,
            data
          }).catch(() => {});
        }
        sendResponse({ success: true, data });
      })
      .catch(err => {
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showResults',
            loading: false,
            error: err.message
          }).catch(() => {});
        }
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep message channel open for async sendResponse
  }
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
  const options = result.factifyOptions || { bias: true, fallacy: true, ethics: false, tone: false };
  const settings = {
    detectBias: options.bias,
    detectFallacies: options.fallacy,
    detectEthicalConcerns: options.ethics,
    analyzeTone: options.tone
  };
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, settings })
  });
  if (!response.ok) throw new Error('Analysis failed');
  return await response.json();
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
