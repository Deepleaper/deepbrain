// DeepBrain Clipper — Popup Script

const DEFAULT_API = 'http://localhost:3333';

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const settings = await chrome.storage.local.get(['apiUrl', 'brain']);
  document.getElementById('apiUrl').value = settings.apiUrl || DEFAULT_API;
  document.getElementById('brain').value = settings.brain || 'default';

  // Auto-fill from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      document.getElementById('title').value = tab.title || '';
      const slug = (tab.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
      document.getElementById('slug').value = slug;

      // Try to get selected text or page content
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || document.body.innerText?.slice(0, 5000) || '',
        });
        if (result) {
          document.getElementById('content').value = result.slice(0, 5000);
        }
      } catch { /* content script may not have access */ }
    }
  } catch { /* tab access failed */ }

  // Save button
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const apiUrl = document.getElementById('apiUrl').value || DEFAULT_API;
    const brain = document.getElementById('brain').value || 'default';

    const slug = document.getElementById('slug').value.trim();
    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const type = document.getElementById('type').value;

    if (!slug || !content) {
      status.className = 'status error';
      status.textContent = '❌ Slug and content are required';
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
      const res = await fetch(`${apiUrl}/api/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title: title || slug,
          type,
          compiled_truth: content,
          brain,
        }),
      });

      if (res.ok) {
        status.className = 'status success';
        status.textContent = `✅ Saved to brain "${brain}" as ${slug}`;
      } else {
        const err = await res.text();
        status.className = 'status error';
        status.textContent = `❌ ${err || res.statusText}`;
      }
    } catch (e) {
      status.className = 'status error';
      status.textContent = `❌ Cannot connect to ${apiUrl}. Is DeepBrain server running?`;
    }

    btn.disabled = false;
    btn.textContent = '💾 Save to Brain';
  });

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', async () => {
    await chrome.storage.local.set({
      apiUrl: document.getElementById('apiUrl').value,
      brain: document.getElementById('brain').value,
    });
    alert('Settings saved!');
  });
});
