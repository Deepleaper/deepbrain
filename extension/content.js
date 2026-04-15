// DeepBrain Clipper — Content Script
// Adds "Save to DeepBrain" option to right-click context menu via messaging

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SELECTION') {
    const selection = window.getSelection()?.toString() || '';
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    const pageContent = selection || document.body.innerText?.slice(0, 5000) || '';
    sendResponse({ selection, pageTitle, pageUrl, pageContent });
  }
  return true;
});
