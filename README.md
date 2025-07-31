# RapidMatch Chrome Extension

## Overview
RapidMatch is a Chrome extension designed to extract comprehensive LinkedIn profile data, specifically from LinkedIn Recruiter pages. It captures data such as education, skills, and work experience by intercepting network requests and parsing JSON payloads.

## Current Implementation Status

### ✅ What's Working
1. **Basic Extension Structure**
   - Content script (`content.js`) successfully injects into LinkedIn Recruiter pages
   - Page hook script (`pageHook.js`) intercepts network requests in page context
   - Panel UI displays extracted data and match results
   - Extension manifest properly configured for Chrome extension

2. **Network Interception**
   - Successfully intercepts `fetch` and `XMLHttpRequest` calls
   - Captures responses from `/talent/api/` endpoints
   - Handles XSSI prefixes (e.g., `for (;;);`) in JSON responses
   - Implements URL rewriting to request comprehensive profile data

3. **Data Processing**
   - Deep merge functionality for combining multiple API responses
   - JSON parsing with prefix stripping
   - Basic profile data extraction (name, headline, location, current positions)

4. **UI Components**
   - RapidMatch panel displays on LinkedIn Recruiter pages
   - Shows match percentage and skill analysis
   - Debug information panel for troubleshooting
   - Responsive design with modern styling

### ❌ What's Not Working
1. **Incomplete Profile Data Extraction**
   - **Education**: Empty arrays returned despite API calls containing education data
   - **Skills**: No skills extracted from profile data
   - **Full Work Experience**: Only current positions extracted, missing historical experience
   - **About Section**: Empty despite being available in API responses

2. **Data Extraction Logic Issues**
   - Extraction functions expect top-level arrays (`educations`, `profileSkills`, `groupedWorkExperience`)
   - Current API responses don't provide data in expected format
   - URL rewriting strategy implemented but not fully tested
   - Fallback DOM extraction not implemented for Recruiter pages

3. **API Response Structure Mismatch**
   - LinkedIn API responses contain nested data structures
   - Profile data often located in `included` arrays or nested objects
   - Current extraction logic doesn't handle complex nested structures

## Technical Architecture

### File Structure
```
cursor v1/
├── content.js          # Main content script for DOM manipulation and data extraction
├── pageHook.js         # Page context script for network interception
├── panel.html          # Extension panel UI
├── panel.js            # Panel logic and communication
├── style.css           # Extension styling
├── manifest.json       # Chrome extension manifest
└── README.md           # This documentation
```

### Key Components

#### content.js
- **Purpose**: Manages RapidMatch panel, injects pageHook.js, performs profile data extraction
- **Main Functions**:
  - `createRapidMatchPanel()`: Creates and displays the extension panel
  - `extractLinkedInProfile()`: Main extraction function for Recruiter pages
  - `extractBasicProfileFromJson()`: Extracts basic profile information
  - `extractExperienceFromJson()`: Extracts work experience (currently limited)
  - `extractEducationFromJson()`: Extracts education (currently not working)
  - `extractSkillsFromJson()`: Extracts skills (currently not working)

#### pageHook.js
- **Purpose**: Injected into page context to intercept network requests, bypassing CSP
- **Main Functions**:
  - `stripJsonPrefix()`: Removes XSSI prefixes from JSON responses
  - `mergeProfileData()`: Deep merges multiple API responses
  - `rewriteProfileUrl()`: Modifies API URLs to request comprehensive data
  - Network interception for both `fetch` and `XMLHttpRequest`

### Data Flow
1. User navigates to LinkedIn Recruiter profile page
2. `content.js` injects `pageHook.js` into page context
3. `pageHook.js` intercepts network requests to `/talent/api/` endpoints
4. URL rewriting modifies requests to include comprehensive `decoration` parameters
5. JSON responses are parsed, stripped of prefixes, and merged
6. Merged data is sent to `content.js` via `postMessage`
7. `content.js` extracts profile data and displays in panel

## Debugging Information

### Console Logs
The extension provides extensive logging:
- Network interception: `RapidMatch: Page hook processing URL:`
- Data merging: `Merged data keys: Array(X)`
- Extraction process: `RapidMatch: JSON extraction successful, data: Object`

### Current Issues
1. **API Response Structure**: LinkedIn returns data in nested structures that current extraction logic doesn't handle
2. **URL Rewriting**: While implemented, the comprehensive `decoration` parameter may not be working as expected
3. **Data Merging**: Deep merge works but may not be capturing all relevant data from nested structures

## Development Notes

### Recent Changes
- Implemented URL rewriting strategy to force comprehensive data requests
- Simplified extraction logic to expect top-level arrays
- Added deep merge functionality for combining API responses
- Removed complex nested data searching in favor of direct top-level access

### Known Limitations
- Extension only works on LinkedIn Recruiter pages
- Requires user to be logged into LinkedIn Recruiter
- Network interception may be affected by LinkedIn's security measures
- CSRF tokens prevent proactive API requests

## Installation
1. Clone the repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the directory where the extension is located.

## Usage
- Navigate to a LinkedIn Recruiter profile page.
- The extension will automatically capture and display profile data in a panel.

## Development
- The extension uses content scripts and page hooks to intercept network requests and extract data.
- JSON responses are parsed and merged to form a complete profile object.

## Next Steps for Future Development
1. **Analyze API Response Structure**: Examine actual LinkedIn API responses to understand nested data structures
2. **Implement Nested Data Extraction**: Update extraction functions to handle complex nested objects and arrays
3. **Test URL Rewriting**: Verify that comprehensive `decoration` parameters return full profile data
4. **Add DOM Fallback**: Implement DOM-based extraction for Recruiter pages as backup
5. **Error Handling**: Add robust error handling for network failures and parsing errors

## Contribution
- Fork the repository and create a new branch for your feature or bug fix.
- Submit a pull request with a detailed description of your changes.

## License
This project is licensed under the MIT License. 