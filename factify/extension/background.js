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
  } else if (request.action === 'transcribeYouTube') {
    transcribeYouTubeUrl(request.url)
      .then((transcript) => sendResponse({ ok: true, transcript }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  } else if (request.action === 'fetchCaptionTranscript') {
    fetchCaptionTranscript(request.url)
      .then((transcript) => sendResponse({ ok: true, transcript }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  // We only keep the channel open for transcribeYouTube.
  return false;
});

function decodeCaptionEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseXmlCaptionText(xml) {
  const parts = [];
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = textRegex.exec(xml)) !== null) {
    const value = decodeCaptionEntities(match[1]).replace(/<[^>]+>/g, '').trim();
    if (value) parts.push(value);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function parseJson3CaptionText(payload) {
  const chunks = [];
  (payload.events || []).forEach((event) => {
    (event.segs || []).forEach((seg) => {
      if (typeof seg.utf8 === 'string') chunks.push(seg.utf8);
    });
  });
  return chunks.join(' ').replace(/\s+/g, ' ').replace(/\u200b/g, '').trim();
}

async function fetchCaptionTranscript(captionUrl) {
  if (!captionUrl || typeof captionUrl !== 'string') {
    throw new Error('Missing caption URL');
  }

  const url = new URL(captionUrl);
  if (!url.searchParams.get('fmt')) url.searchParams.set('fmt', 'json3');

  const res = await fetch(url.toString(), { credentials: 'omit' });
  if (!res.ok) throw new Error(`Caption request failed (${res.status})`);

  const contentType = res.headers.get('content-type') || '';
  let transcript = '';

  if (contentType.includes('application/json') || url.searchParams.get('fmt') === 'json3') {
    const payload = await res.json();
    transcript = parseJson3CaptionText(payload);
  } else {
    const xml = await res.text();
    transcript = parseXmlCaptionText(xml);
  }

  if (!transcript || transcript.length < 30) {
    throw new Error('Caption transcript was empty');
  }
  return transcript;
}

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
  const options = result.factifyOptions || { structure: true, relevance: true, evidence: true, framing: true, language: true };

  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, settings: {} })
  });
  if (!response.ok) throw new Error('Analysis failed');
  const data = await response.json();

  // Filter findings based on active category toggles
  if (data.findings) {
    const allCategories = ['structure', 'relevance', 'evidence', 'framing', 'language'];
    const activeCategories = allCategories.filter(c => options[c] !== false);

    if (activeCategories.length < 5) {
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
async function transcribeYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Missing YouTube URL');
  }

  const response = await fetch(`${API_URL}/api/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    let details = '';
    try {
      const payload = await response.json();
      details = payload?.details || payload?.error || '';
    } catch (_) {
      details = '';
    }
    throw new Error(details || `YouTube transcription failed (${response.status})`);
  }

  const data = await response.json();
  const transcript = typeof data?.transcript === 'string' ? data.transcript.trim() : '';
  if (!transcript) throw new Error('No transcript returned');
  return transcript;
}
