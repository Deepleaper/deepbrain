// DeepBrain Clipper — Background Service Worker

const DEFAULT_API = 'http://localhost:3333';

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'deepbrain-save',
    title: '🧠 Save to DeepBrain',
    contexts: ['selection', 'page'],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'deepbrain-save') return;

  const settings = await chrome.storage.local.get(['apiUrl', 'brain']);
  const apiUrl = settings.apiUrl || DEFAULT_API;
  const brain = settings.brain || 'default';

  // Get content from the page
  let content = info.selectionText || '';
  let title = tab?.title || 'Untitled';

  if (!content && tab?.id) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText?.slice(0, 5000) || '',
      });
      content = result || '';
    } catch { /* fallback */ }
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  // Prepend source URL
  const fullContent = `Source: ${tab?.url || 'unknown'}\n\n${content}`;

  try {
    const res = await fetch(`${apiUrl}/api/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title,
        type: 'bookmark',
        compiled_truth: fullContent,
        brain,
      }),
    });

    if (res.ok) {
      // Show success badge
      chrome.action.setBadgeText({ text: '✓', tabId: tab?.id });
      chrome.action.setBadgeBackgroundColor({ color: '#3fb950' });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab?.id }), 2000);
    }
  } catch {
    chrome.action.setBadgeText({ text: '✗', tabId: tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: '#f85149' });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab?.id }), 2000);
  }
});
