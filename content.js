// content.js - Injects page hook and acts as a message bridge

let recruiterProfileData = null;

// Debug: Log when content script loads
console.log('RapidMatch: Content script loaded on:', window.location.href);

// Inject the page hook script to intercept network requests in the page context
function injectPageHook() {
  console.log('RapidMatch: Injecting page hook script...');
  
  const hookScript = document.createElement('script');
  hookScript.src = chrome.runtime.getURL('pageHook.js');
  hookScript.onload = () => {
    console.log('RapidMatch: Page hook script loaded successfully');
    hookScript.remove(); // Clean up the script tag after loading
  };
  (document.head || document.documentElement).appendChild(hookScript);
}

// Listen for profile data captured by the page hook
window.addEventListener('rapidMatchProfileDataCaptured', (event) => {
  console.log('RapidMatch: Received profile data from page hook:', event.detail);
  recruiterProfileData = event.detail;
  // Forward the data to the background script for processing and storage
  chrome.runtime.sendMessage({ action: 'processProfileData', payload: recruiterProfileData });
});

// Listener for messages from the popup (panel.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;
  
  console.log('RapidMatch: Content script received message:', action, payload);
  
  // Asynchronously handle messages and send responses
  (async () => {
    if (action === 'extractProfile') {
      console.log('RapidMatch: Extracting profile, current data:', recruiterProfileData);
      // The profile data is now captured passively by the hook.
      // We can send back the most recently captured data.
      if (recruiterProfileData) {
        sendResponse({ data: recruiterProfileData, debug: { extractionMethod: 'JSON', source: 'passive' } });
      } else {
        // If no data has been captured, try to extract basic page info as fallback
        console.log('RapidMatch: No profile data captured, trying fallback extraction');
        const fallbackData = {
          pageUrl: window.location.href,
          pageTitle: document.title,
          isLinkedIn: window.location.hostname.includes('linkedin.com'),
          timestamp: Date.now()
        };
        sendResponse({ 
          data: fallbackData, 
          debug: { 
            error: 'No profile data captured yet, using fallback data.',
            fallback: true 
          } 
        });
      }
    }
  })();
  
  // Return true to indicate that the response will be sent asynchronously.
  return true;
});

// Initialize the page hook injection
injectPageHook();

console.log('RapidMatch: Content script loaded and ready.'); 