// pageHook.js - Runs in the page context to intercept network requests.

console.log('RapidMatch: Page hook script loaded');

// Helper to strip XSSI prefix like "for (;;);" before JSON parsing
function stripJsonPrefix(text) {
  if (!text) return text;
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

// Helper to process any JSON data we successfully parse
function processJsonData(jsonData, url) {
  console.log('RapidMatch: Processing JSON data from URL:', url);
  
  // We care about both talent API responses and regular LinkedIn profile data
  const isTalentApi = url.includes('/talent/api/');
  const isVoyagerApi = url.includes('/voyager/api/');
  const isRelevantUrl = url.includes('profile') || url.includes('identity');
  
  if (!isTalentApi && !isVoyagerApi && !isRelevantUrl) {
    console.log('RapidMatch: Skipping non-relevant API URL');
    return;
  }

  // Check if the data seems to be valid profile information
  const dataCandidates = [jsonData, jsonData?.data, ...(Array.isArray(jsonData?.elements) ? jsonData.elements : [])];
  let isProfileData = false;
  for (const candidate of dataCandidates) {
    if (candidate && (
      candidate.firstName || 
      candidate.unobfuscatedFirstName || 
      candidate.educations || 
      candidate.groupedWorkExperience || 
      candidate.profileSkills ||
      candidate.publicIdentifier ||
      candidate.localizedHeadline ||
      candidate.localizedFirstName ||
      candidate.localizedLastName
    )) {
      isProfileData = true;
      break;
    }
  }

  if (isProfileData) {
    console.log(`RapidMatch: Found profile data from ${url}. Dispatching event.`);
    console.log('RapidMatch: Profile data structure:', Object.keys(jsonData || {}));
    // Dispatch an event with the captured data. The content script will listen for this.
    window.dispatchEvent(new CustomEvent('rapidMatchProfileDataCaptured', { detail: jsonData }));
  } else {
    console.log('RapidMatch: No profile data found in response');
    console.log('RapidMatch: Available data keys:', Object.keys(jsonData || {}));
  }
}

// --- URL Rewriting Logic ---
const fullProfileDecoration = `(entityUrn,firstName,lastName,unobfuscatedFirstName,unobfuscatedLastName,headline,location,summary,publicProfileUrl,profilePicture(displayImageReference(vectorImage(rootUrl,artifacts))),educations*(schoolName,degreeName,fieldOfStudy,startDateOn,endDateOn,grade,schoolUrl),groupedWorkExperience*(positions*(title,companyName,startDateOn,endDateOn,location,description)),profileSkills*(name))`;

function rewriteProfileUrl(originalUrl) {
  if (originalUrl && originalUrl.includes('/talent/api/talentLinkedInMemberProfiles/')) {
    const rewrittenUrl = originalUrl.replace(/decoration=\([^)]+\)/, `decoration=${fullProfileDecoration}`);
    console.log('RapidMatch: Rewriting URL to fetch full profile:', rewrittenUrl);
    return rewrittenUrl;
  }
  return originalUrl;
}

// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let url = (typeof args[0] === 'string') ? args[0] : args[0]?.url;
  
  const rewrittenUrl = rewriteProfileUrl(url);
  if (rewrittenUrl !== url) {
    if (typeof args[0] === 'string') {
      args[0] = rewrittenUrl;
    } else {
      args[0] = new Request(rewrittenUrl, args[0]);
    }
    url = rewrittenUrl;
  }
  
  const response = await originalFetch.apply(this, args);
  const responseClone = response.clone();

  if (responseClone.ok) {
    try {
      const text = await responseClone.text();
      const cleaned = stripJsonPrefix(text);
      const json = JSON.parse(cleaned);
      processJsonData(json, url);
    } catch (e) {
      // Ignore parsing errors, as many responses won't be JSON.
    }
  }
  
  return response;
};

// Intercept XMLHttpRequest calls
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
  const rewrittenUrl = rewriteProfileUrl(url);
  this._rapidMatchUrl = rewrittenUrl; // Store the (potentially rewritten) URL
  return originalXHROpen.apply(this, [method, rewrittenUrl, ...args]);
};

const originalXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (...args) {
  const xhr = this;
  const originalOnReadyStateChange = xhr.onreadystatechange;
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const url = xhr._rapidMatchUrl || '';
      if (url.includes('/talent/api/')) {
        try {
          const cleaned = stripJsonPrefix(xhr.responseText);
          const json = JSON.parse(cleaned);
          processJsonData(json, url);
        } catch (e) {
          // Ignore parsing errors.
        }
      }
    }
    if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
  };
  return originalXHRSend.apply(this, args);
};

console.log('RapidMatch: Page hook network interception active'); 