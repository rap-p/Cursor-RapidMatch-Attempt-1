// pageHook.js - Runs in the page context to intercept network requests
// This file is injected by the content script to bypass CSP restrictions

console.log('RapidMatch: Page hook script loaded');

// Global variable to store captured profile data
window.rapidMatchProfileData = null;

// Function to check if the response contains profile-like data
function containsProfileData(jsonData, url) {
  const dataCandidates = [jsonData, jsonData?.data, ...(Array.isArray(jsonData?.elements) ? jsonData.elements : [])];

  for (const candidate of dataCandidates) {
    if (!candidate) continue;
    
    // The presence of a name or any detailed fields is enough to qualify it as profile data.
    if (candidate.firstName || candidate.unobfuscatedFirstName || candidate.educations || candidate.groupedWorkExperience || candidate.profileSkills) {
      return true;
    }
  }
  return false;
}

// Helper: robust deep-merge function
function mergeProfileData(base, incoming) {
  const merged = { ...(base || {}) };

  for (const key in (incoming || {})) {
      if (Object.prototype.hasOwnProperty.call(incoming, key)) {
          if (typeof incoming[key] === 'object' && incoming[key] !== null && !Array.isArray(incoming[key]) &&
              typeof merged[key] === 'object' && merged[key] !== null && !Array.isArray(merged[key])) {
              merged[key] = mergeProfileData(merged[key], incoming[key]);
          } else {
              merged[key] = incoming[key];
          }
      }
  }
  return merged;
}

// Add helper to strip XSSI prefix like "for (;;);" before JSON parsing
function stripJsonPrefix(text) {
  if (!text) return text;
  // Find first occurrence of '{' or '[' and slice from there
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let idx = -1;
  if (firstBrace === -1) {
    idx = firstBracket;
  } else if (firstBracket === -1) {
    idx = firstBrace;
  } else {
    idx = Math.min(firstBrace, firstBracket);
  }
  return idx >= 0 ? text.slice(idx) : text;
}

// Helper: process any JSON data we successfully parse
function processJsonData(jsonData, url) {
  // We only care about talent API responses.
  if (!url.includes('/talent/api/')) {
    return;
  }

  // Aggressively merge any JSON from the talent API.
  window.rapidMatchProfileData = mergeProfileData(window.rapidMatchProfileData, jsonData);
  
  // Log the state of our target arrays after every merge to see when they get populated.
  console.log(
    `RapidMatch: Merged from ${url}. ` +
    `Educations: ${window.rapidMatchProfileData?.educations?.length || 0}, ` +
    `Skills: ${window.rapidMatchProfileData?.profileSkills?.length || 0}, ` +
    `Experience: ${window.rapidMatchProfileData?.groupedWorkExperience?.length || 0}`
  );
  
  window.dispatchEvent(new CustomEvent('rapidMatchProfileDataCaptured', { detail: window.rapidMatchProfileData }));
}

// --- URL Rewriting Logic ---
const fullProfileDecoration = `(entityUrn,firstName,lastName,unobfuscatedFirstName,unobfuscatedLastName,headline,location,summary,publicProfileUrl,profilePicture(displayImageReference(vectorImage(rootUrl,artifacts))),educations*(schoolName,degreeName,fieldOfStudy,startDateOn,endDateOn,grade,schoolUrl),groupedWorkExperience*(positions*(title,companyName,startDateOn,endDateOn,location,description)),profileSkills*(name))`;

function rewriteProfileUrl(originalUrl) {
  if (originalUrl.includes('/talent/api/talentLinkedInMemberProfiles/')) {
    // Replace the existing decoration with our comprehensive one.
    const rewrittenUrl = originalUrl.replace(/decoration=\([^)]+\)/, `decoration=${fullProfileDecoration}`);
    console.log('RapidMatch: Rewriting URL to fetch full profile:', rewrittenUrl);
    return rewrittenUrl;
  }
  return originalUrl;
}
// --- End URL Rewriting Logic ---


// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let url = '';
  if (typeof args[0] === 'string') {
    url = args[0];
  } else if (args[0] && args[0].url) {
    url = args[0].url;
  }
  
  // Rewrite the URL if it's a profile request.
  const rewrittenUrl = rewriteProfileUrl(url);
  if (rewrittenUrl !== url) {
    args[0] = rewrittenUrl;
    url = rewrittenUrl;
  }
  
  const response = await originalFetch.apply(this, args);
  
  // Clone the response for our processing, and return the original to the page
  const responseClone = response.clone();

  if (responseClone.ok && responseClone.status === 200) {
    try {
      const text = await responseClone.text();
      const cleaned = stripJsonPrefix(text);
      const json = JSON.parse(cleaned);
      processJsonData(json, url);
    } catch (_) {}
  }
  
  return response;
};

// Intercept XMLHttpRequest calls
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  const rewrittenUrl = rewriteProfileUrl(url);
  this._rapidMatchUrl = rewrittenUrl; // Store the (potentially rewritten) URL
  return originalXHROpen.apply(this, [method, rewrittenUrl, ...args]);
};

XMLHttpRequest.prototype.send = function (...args) {
  const xhr = this;
  const originalOnReadyStateChange = xhr.onreadystatechange;
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const url = xhr._rapidMatchUrl || '';
      // Simplified condition to process any talent API call
      if (url.includes('/talent/api/')) {
        const handleContent = (textContent) => {
          try {
            const cleaned = stripJsonPrefix(textContent);
            const json = JSON.parse(cleaned);
            processJsonData(json, url);
          } catch (_) {}
        };

        if (xhr.responseType === '' || xhr.responseType === 'text') {
          handleContent(xhr.responseText);
        } else if (xhr.responseType === 'arraybuffer' && xhr.response instanceof ArrayBuffer) {
          const text = new TextDecoder('utf-8').decode(new Uint8Array(xhr.response));
          handleContent(text);
        } else if (xhr.responseType === 'blob') {
          const reader = new FileReader();
          reader.onload = () => handleContent(reader.result);
          reader.readAsText(xhr.response);
        }
      }
    }
    if (originalOnReadyStateChange) originalOnReadyStateChange.apply(xhr, arguments);
  };
  return originalXHRSend.apply(this, args);
};

console.log('RapidMatch: Page hook network interception active'); 