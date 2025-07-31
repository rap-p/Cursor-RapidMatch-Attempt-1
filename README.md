# RapidMatch Chrome Extension

## Overview
RapidMatch is a Chrome extension designed to extract comprehensive LinkedIn profile data from Recruiter pages by intercepting network requests and parsing JSON payloads. It aims to provide AI-powered analysis to match candidate profiles against job roles.

**Senior Code Reviewer's Note:** This project has undergone a significant architectural refactoring to align with modern Chrome extension best practices and the rules defined in the `.cursor/rules` directory. The previous monolithic structure has been broken down into a more robust, secure, and maintainable architecture.

## Current Implementation Status

### ✅ What's Working
1.  **Modern Extension Architecture**
    -   **`manifest.json`**: Configured for Manifest V3 with a background service worker, action popup, and appropriate permissions. Extension name updated to "Cursor Refactor v1 - RapidMatch" for easy identification.
    -   **`background.js`**: A dedicated service worker handles all state management, including `chrome.storage` API calls for roles.
    -   **`content.js`**: Lightweight script that injects `pageHook.js` and acts as a message bridge to the background script.
    -   **Separation of Concerns**: Clear architectural separation between the UI (`panel`), background logic (`background.js`), page-level interception (`pageHook.js`), and content script bridging (`content.js`).

2.  **Network Interception**
    -   `pageHook.js` successfully intercepts `fetch` and `XMLHttpRequest` calls on LinkedIn pages.
    -   It correctly rewrites URLs for `/talent/api/` endpoints to request more comprehensive data.
    -   **Enhanced API Detection**: Now works on both LinkedIn Recruiter (`/talent/api/`) and regular LinkedIn pages (`/voyager/api/`, profile endpoints).
    -   Intercepted profile data is dispatched via a custom event (`rapidMatchProfileDataCaptured`) to the content script.

3.  **Communication**
    -   A robust messaging pipeline is in place: `pageHook.js` -> `content.js` -> `background.js` -> `panel.js`.
    -   Communication uses the standard and secure `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` APIs.

4.  **UI and User Experience**
    -   **Fixed Popup Sizing**: Extension popup now has correct dimensions (400x550px) and displays content properly.
    -   **Functional UI**: All buttons and tabs are working with proper event listeners.
    -   **Debug Mode**: Comprehensive console logging and fallback data mechanism for troubleshooting.
    -   **Cross-Platform Compatibility**: Works on both LinkedIn Recruiter and regular LinkedIn profile pages.

### ❌ What's Not Working / Needs Improvement
1.  **Data Processing Logic**:
    -   The complex data extraction and parsing logic that previously existed in `content.js` has been **removed**.
    -   The `background.js` script currently only stores the *raw* JSON data it receives. It does **not** yet parse this data to extract specific fields like education, skills, or experience. **This is the primary blocker.**

2.  **UI Functionality**:
    -   The panel UI (`panel.js`) has been refactored to use the new communication architecture, but its matching logic is rudimentary and operating on placeholder assumptions about the data structure. It will not work correctly until the background script provides properly structured data.
    -   The UI styling is basic and does not use a modern framework like React/Shadcn/Tailwind as recommended by the project rules.

3.  **LinkedIn Profile Data Capture**:
    -   While the extension now works on both LinkedIn Recruiter and regular LinkedIn pages, the profile data capture is still in development.
    -   The fallback debug mode provides basic page information but full profile extraction needs to be implemented.

## Technical Architecture (Post-Refactoring)

### File Structure
```
cursor v1/
├── background.js       # (New) Service worker for state management
├── content.js          # (Refactored) Injects hook, bridges messages
├── pageHook.js         # (Refactored) Network interception in page context
├── panel.html          # Popup UI structure
├── panel.js            # (Refactored) Popup UI logic
├── style.css           # Popup styling
├── manifest.json       # Extension manifest (requires manual update)
└── README.md           # This documentation
```

### Key Components

#### `manifest.json`
- **Purpose**: Defines the extension's structure, permissions, and capabilities.
- **Required Manual Update**: Needs to be updated to include the `background` service worker, `action` popup, and correct `host_permissions`.

#### `background.js`
- **Purpose**: Central hub for the extension. Handles all state, data processing, and communication with `chrome.storage`.
- **Next Steps**: Implement the data parsing logic to transform raw JSON into a structured profile object.

#### `content.js`
- **Purpose**: A lightweight bridge between the web page and the extension's background script.
- **Responsibilities**:
  1.  Injects `pageHook.js` into the page.
  2.  Listens for the `rapidMatchProfileDataCaptured` event from the page hook.
  3.  Forwards the captured data to `background.js` for processing.

#### `pageHook.js`
- **Purpose**: Intercepts network requests in the page's context.
- **Responsibilities**:
  1.  Wraps `fetch` and `XMLHttpRequest`.
  2.  Rewrites profile API URLs to request full data.
  3.  Dispatches the raw JSON response in a custom event.

#### `panel.js`
- **Purpose**: Manages the user interface of the popup.
- **Responsibilities**:
  1.  Communicates with `background.js` to get roles and profile data.
  2.  Renders the UI for role management and scan results.
  - **Note**: The UI logic is currently simplified and needs to be updated once the background script provides structured data.

### Data Flow
1.  User opens the extension popup (`panel.html`).
2.  `content.js` on a LinkedIn page injects `pageHook.js`.
3.  `pageHook.js` intercepts a LinkedIn profile API call, rewrites the URL, and captures the JSON response.
4.  `pageHook.js` dispatches a `rapidMatchProfileDataCaptured` event containing the raw JSON.
5.  `content.js` listens for this event and forwards the data to `background.js` using `chrome.runtime.sendMessage`.
6.  `background.js` receives the raw data, stores it, and (in the future) will process it into a clean format.
7.  The user clicks "Scan" in the popup. `panel.js` requests the data from the `background.js`, which returns the latest captured information.
8.  The panel displays the results.

## Next Steps for Future Development
1.  **Implement Data Parsing in `background.js`**: This is the most critical next step. Create robust functions in the service worker to parse the raw, nested JSON from the LinkedIn API into a clean, flat profile object containing `name`, `headline`, `experience`, `education`, and `skills`.
2.  **Refine Panel UI Logic**: Once `background.js` provides structured data, update `panel.js` to consume it and perform accurate matching and scoring.
3.  **Modernize the UI**: Rewrite the panel using React, Shadcn UI, and Tailwind CSS to create a professional and maintainable user interface.
4.  **Improve Error Handling**: Add more robust error handling throughout the message-passing pipeline.
5.  **Enhanced Profile Data Capture**: Implement comprehensive profile data extraction for both LinkedIn Recruiter and regular LinkedIn pages.

## Installation
1.  Clone the repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the directory where the extension is located.
5.  The extension will appear as "Cursor Refactor v1 - RapidMatch" in your extensions list.

## Usage
1.  Navigate to any LinkedIn page (Recruiter or regular LinkedIn profiles).
2.  Click the extension icon in your browser toolbar.
3.  The popup will show the "Scan" and "Roles" tabs.
4.  Click "⚡ Scan Now" to capture profile data (currently shows debug information).
5.  Use the "Roles" tab to create and manage job roles for matching. 