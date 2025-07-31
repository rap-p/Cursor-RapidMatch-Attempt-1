// content.js - Injects page hook and acts as a message bridge

let recruiterProfileData = null;

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
  
  // Asynchronously handle messages and send responses
  (async () => {
    if (action === 'extractProfile') {
      // The profile data is now captured passively by the hook.
      // We can send back the most recently captured data.
      if (recruiterProfileData) {
        sendResponse({ data: recruiterProfileData, debug: { extractionMethod: 'JSON', source: 'passive' } });
      } else {
        // If no data has been captured, we can't do anything.
        // The popup should ideally wait for data to be sent from the background.
        sendResponse({ data: null, debug: { error: 'No profile data captured yet.' } });
      }
    }
  })();
  
  // Return true to indicate that the response will be sent asynchronously.
  return true;
});

// Initialize the page hook injection
injectPageHook();

console.log('RapidMatch: Content script loaded and ready.'); 