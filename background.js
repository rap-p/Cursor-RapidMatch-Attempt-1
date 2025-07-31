// background.js - Service worker for RapidMatch extension

// Function to process and store profile data received from the content script
function processProfileData(data) {
  // In a real application, you would perform more complex processing here,
  // such as validating, cleaning, and structuring the data before storage.
  console.log('Background: Received profile data, storing...', data);
  chrome.storage.local.set({ lastProfileData: data });
}

// Main message listener for the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

  // Asynchronously handle actions
  (async () => {
    if (action === 'processProfileData') {
      processProfileData(payload);
      sendResponse({ status: 'success', message: 'Data received by background script.' });
    } else if (action === 'getRoles') {
      const { roles } = await chrome.storage.local.get(['roles']);
      sendResponse(roles || []);
    } else if (action === 'saveRole') {
      const { roles } = await chrome.storage.local.get(['roles']);
      const updatedRoles = [...(roles || []), payload];
      await chrome.storage.local.set({ roles: updatedRoles });
      sendResponse(updatedRoles);
    } else if (action === 'editRole') {
      const { roles } = await chrome.storage.local.get(['roles']);
      const updatedRoles = (roles || []).map(r => r.id === payload.id ? { ...r, ...payload } : r);
      await chrome.storage.local.set({ roles: updatedRoles });
      sendResponse(updatedRoles);
    } else if (action === 'deleteRole') {
      const { roles } = await chrome.storage.local.get(['roles']);
      const updatedRoles = (roles || []).filter(r => r.id !== payload);
      await chrome.storage.local.set({ roles: updatedRoles });
      sendResponse(updatedRoles);
    } else if (action === 'setActiveRole') {
      await chrome.storage.local.set({ activeRoleId: payload });
      sendResponse({ status: 'success' });
    } else if (action === 'getActiveRole') {
      const { activeRoleId } = await chrome.storage.local.get(['activeRoleId']);
      sendResponse(activeRoleId);
    }
  })();

  // Return true to indicate that the response will be sent asynchronously.
  return true;
});

console.log("RapidMatch: Background service worker started."); 