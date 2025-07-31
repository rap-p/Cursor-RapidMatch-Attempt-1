// Check if panel already exists
if (!document.getElementById('rapidmatch-panel')) {
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'rapidmatch-panel';
  panel.style.position = 'fixed';
  panel.style.top = '0';
  panel.style.right = '0';
  panel.style.width = '400px';
  panel.style.height = '100vh';
  panel.style.zIndex = '999999';
  panel.style.boxShadow = '-2px 0 8px rgba(0,0,0,0.08)';
  panel.style.background = '#f7f8fa';
  panel.style.transition = 'transform 0.3s ease';
  panel.style.transform = 'translateX(100%)'; // Hidden by default
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  document.body.appendChild(panel);

  // Fetch and inject panel.html content (body only)
  fetch(chrome.runtime.getURL('panel.html'))
    .then(res => res.text())
    .then(html => {
      // Extract body content only
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      panel.innerHTML = bodyMatch ? bodyMatch[1] : html;
      // Load panel.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('panel.js');
      panel.appendChild(script);
    });

  // Inject style.css
  fetch(chrome.runtime.getURL('style.css'))
    .then(res => res.text())
    .then(css => {
      const style = document.createElement('style');
      style.textContent = css;
      panel.appendChild(style);
    });

  // Toggle button
  const toggle = document.createElement('button');
  toggle.id = 'rapidmatch-toggle';
  toggle.innerText = '▶️';
  toggle.style.position = 'fixed';
  toggle.style.top = '50%';
  toggle.style.right = '0';
  toggle.style.transform = 'translateY(-50%)';
  toggle.style.zIndex = '1000000';
  toggle.style.background = '#fff';
  toggle.style.border = '1px solid #ccc';
  toggle.style.borderRadius = '8px 0 0 8px';
  toggle.style.padding = '8px 12px';
  toggle.style.cursor = 'pointer';
  toggle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';

  document.body.appendChild(toggle);

  let open = false;
  toggle.addEventListener('click', () => {
    open = !open;
    panel.style.transform = open ? 'translateX(0)' : 'translateX(100%)';
    toggle.innerText = open ? '◀️' : '▶️';
  });
}

// Robust selectors for LinkedIn profile extraction
const selectors = {
  // Regular LinkedIn profile selectors
  basicProfile: {
    name: "h1",
    headline: "div.text-body-medium.break-words",
    location: "span.text-body-small.inline.t-black--light.break-words",
    about: "section[data-view-name='profile-card'] div.inline-show-more-text--is-collapsed > span[aria-hidden='true']",
    photo_url: "div.pv-top-card__non-self-photo-wrapper img"
  },
  // LinkedIn Recruiter profile selectors
  recruiterBasicProfile: {
    name: "h1.text-heading-xlarge, h1, .text-heading-xlarge, [data-test-profile-name], [data-test-candidate-name]",
    headline: "div.text-body-medium.break-words, .text-body-medium, [data-test-headline], [data-test-candidate-headline]",
    location: "span.text-body-small.inline.t-black--light.break-words, .text-body-small, [data-test-location], [data-test-candidate-location]",
    about: "section[data-view-name='profile-card'] div.inline-show-more-text--is-collapsed > span[aria-hidden='true'], #about p, [data-test-about] p, [data-test-summary-card-text], blockquote[data-test-summary-card-text]",
    photo_url: "div.pv-top-card__non-self-photo-wrapper img, .profile-photo img, [data-test-profile-photo] img, [data-test-candidate-photo] img"
  },
  experience: {
    jobTitle: "div.t-bold span[aria-hidden='true']",
    companyAndType: "span.t-14.t-normal > span[aria-hidden='true']",
    duration: "span.pvs-entity__caption-wrapper[aria-hidden='true']",
    location: "span.t-14.t-normal.t-black--light:not(:has(.pvs-entity__caption-wrapper)) > span[aria-hidden='true']",
    multiRole: {
      companyName: "div > a.optional-action-target-wrapper span[aria-hidden='true']",
      location: "span.t-14.t-normal.t-black--light > span[aria-hidden='true']",
      subli: {
        jobTitle: "div.t-bold span[aria-hidden='true']",
        duration: "span.t-14.t-normal.t-black--light span[aria-hidden='true']"
      }
    }
  },
  education: {
    name: "span[aria-hidden='true']:first-of-type",
    degree: ".t-14.t-normal:not(.t-black--light) > span[aria-hidden='true']",
    duration: ".t-14.t-normal.t-black--light span[aria-hidden='true']",
    grade: "div[dir='ltr'] > div[style*='-webkit-line-clamp'] span[aria-hidden='true']",
    schoolUrl: "a.optional-action-target-wrapper"
  },
  certifications: {
    name: ".t-bold span[aria-hidden='true']",
    issuer: "span.t-14.t-normal span[aria-hidden='true']",
    validity_duration: ".t-black--light span",
    credential_id : ".t-black--light + .t-black--light span",
    credential_url: "div.pvs-entity__sub-components a", 
  },
  skills: {
    name: 'a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]',
    endorsements: 'a[href*="/endorsers"] span[aria-hidden="true"]',
    experience: 'div.pvs-entity__sub-components li span[aria-hidden="true"]'
  }
};

function validateSelector(selector, baseNode=document) {
  const el = baseNode.querySelector(selector);
  return el ? el : null;
}

function getSectionsList() {
  // For Recruiter pages, look for different section patterns
  if (isRecruiterPage()) {
    return document.querySelectorAll("section[data-test-profile-summary-card], section[data-test-experience-section], section[data-test-education-section], section[data-test-skills-section]");
  }
  return document.querySelectorAll("section[data-view-name='profile-card']");
}

function getSectionWithId(list, sectionId) {
  return Array.from(list).find(sec => sec.children[0]?.id === sectionId) || null;
}

// Add function to detect if we're on a LinkedIn Recruiter page
function isRecruiterPage() {
  return window.location.href.includes('/talent/profile/') || 
         document.querySelector('[data-test-profile-summary-card]') !== null;
}

function getBasicProfileSection() {
  const debug = {};
  const data = {
    name: '',
    headline: '',
    location: '',
    about: '',
    photo_url: ''
  };

  if (isRecruiterPage()) {
    // LinkedIn Recruiter page selectors - try multiple patterns
    const nameSelectors = [
      'div.artdeco-entity-lockup__title',
      'h1',
      '[data-test-profile-name]',
      '[data-test-candidate-name]'
    ];
    
    const headlineSelectors = [
      'div.artdeco-entity-lockup__subtitle span[data-test-row-lockup-headline]',
      'div.artdeco-entity-lockup__subtitle',
      '[data-test-headline]',
      '[data-test-candidate-headline]'
    ];
    
    const locationSelectors = [
      'span.text-body-small.inline.t-black--light.break-words',
      '[data-test-location]',
      '[data-test-candidate-location]'
    ];
    
    const aboutSelectors = [
      'section[data-test-profile-summary-card] blockquote[data-test-summary-card-text] span.lt-line-clamp__line',
      'section[data-test-profile-summary-card] blockquote[data-test-summary-card-text]',
      'blockquote[data-test-summary-card-text]',
      '[data-test-summary-card-text]'
    ];
    
    const photoSelectors = [
      'div.artdeco-entity-lockup__image img',
      '[data-test-profile-photo] img',
      '[data-test-candidate-photo] img'
    ];

    // Try to find name
    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        data.name = el.textContent.trim();
        debug.name = selector;
        break;
      }
    }
    if (!data.name) debug.name = 'not found';

    // Try to find headline
    for (const selector of headlineSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        data.headline = el.textContent.trim();
        debug.headline = selector;
        break;
      }
    }
    if (!data.headline) debug.headline = 'not found';

    // Try to find location
    for (const selector of locationSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        data.location = el.textContent.trim();
        debug.location = selector;
        break;
      }
    }
    if (!data.location) debug.location = 'not found';

    // Try to find about
    for (const selector of aboutSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        data.about = el.textContent.trim();
        debug.about = selector;
        break;
      }
    }
    if (!data.about) debug.about = 'not found';

    // Try to find photo
    for (const selector of photoSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        data.photo_url = el.src;
        debug.photo_url = selector;
        break;
      }
    }
    if (!data.photo_url) debug.photo_url = 'not found';

  } else {
    // Regular LinkedIn profile selectors
    debug.name = 'h1';
    debug.headline = 'div.text-body-medium.break-words';
    debug.location = 'span.text-body-small.inline.t-black--light.break-words';
    debug.about = 'section[data-view-name=\'profile-card\'] div.inline-show-more-text--is-collapsed > span[aria-hidden=\'true\']';
    debug.photo_url = 'div.pv-top-card__non-self-photo-wrapper img';

    // Extract basic info
    const nameEl = document.querySelector(debug.name);
    data.name = nameEl ? nameEl.textContent.trim() : '';

    const headlineEl = document.querySelector(debug.headline);
    data.headline = headlineEl ? headlineEl.textContent.trim() : '';

    const locationEl = document.querySelector(debug.location);
    data.location = locationEl ? locationEl.textContent.trim() : '';

    const aboutEl = document.querySelector(debug.about);
    data.about = aboutEl ? aboutEl.textContent.trim() : '';

    const photoEl = document.querySelector(debug.photo_url);
    data.photo_url = photoEl ? photoEl.src : '';
  }

  return { data, debug };
}

function getExperienceSection() {
  const sections = getSectionsList();
  let expNode = null;
  const debug = {};
  
  if (isRecruiterPage()) {
    // For Recruiter pages, look for experience section with different patterns
    const expSelectors = [
      'section[data-test-experience-section]',
      '[data-test-experience]',
      '.experience-section',
      'section[data-test-work-experience]',
      '[data-test-work-experience]'
    ];
    
    for (const selector of expSelectors) {
      expNode = document.querySelector(selector);
      if (expNode) {
        debug.experienceSection = selector;
        break;
      }
    }
    if (!expNode) debug.experienceSection = 'not found';
  } else {
    expNode = getSectionWithId(sections, "experience");
    debug.experienceSection = expNode ? 'found' : 'not found';
  }
  
  if (!expNode) return { data: [], debug };
  
  // For Recruiter pages, try different UL patterns
  let ul = null;
  if (isRecruiterPage()) {
    const ulSelectors = [
      "ul",
      "[data-test-experience-list]",
      ".experience-list",
      "[data-test-work-experience-list]"
    ];
    
    for (const selector of ulSelectors) {
      ul = expNode.querySelector(selector);
      if (ul) {
        debug.experienceList = selector;
        break;
      }
    }
    if (!ul) debug.experienceList = 'not found';
  } else {
    ul = expNode.children[2]?.querySelector("ul") || null;
    debug.experienceList = ul ? 'found' : 'not found';
  }
  
  if (!ul) return { data: [], debug };
  
  const experience = [];
  const items = ul.querySelectorAll("li");
  
  items.forEach((item, index) => {
    if (isRecruiterPage()) {
      // Recruiter page experience extraction - try multiple patterns
      const jobTitleSelectors = [
        '[data-test-experience-job-title]',
        '.job-title',
        '[data-test-work-title]',
        '.work-title'
      ];
      
      const companySelectors = [
        '[data-test-experience-company]',
        '.company-name',
        '[data-test-work-company]',
        '.work-company'
      ];
      
      const durationSelectors = [
        '[data-test-experience-duration]',
        '.duration',
        '[data-test-work-duration]',
        '.work-duration'
      ];
      
      const locationSelectors = [
        '[data-test-experience-location]',
        '.location',
        '[data-test-work-location]',
        '.work-location'
      ];
      
      let jobTitle = '';
      let company = '';
      let duration = '';
      let location = '';
      
      // Try to find job title
      for (const selector of jobTitleSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          jobTitle = el.textContent.trim();
          break;
        }
      }
      
      // Try to find company
      for (const selector of companySelectors) {
        const el = item.querySelector(selector);
        if (el) {
          company = el.textContent.trim();
          break;
        }
      }
      
      // Try to find duration
      for (const selector of durationSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          duration = el.textContent.trim();
          break;
        }
      }
      
      // Try to find location
      for (const selector of locationSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          location = el.textContent.trim();
          break;
        }
      }
      
      if (jobTitle || company) {
        experience.push({
          jobTitle,
          companyAndType: company,
          duration,
          location
        });
      }
    } else {
      // Regular LinkedIn experience extraction
      const jobTitle = item.querySelector("div.t-bold span[aria-hidden='true']")?.textContent.trim() || '';
      const companyAndType = item.querySelector("span.t-14.t-normal > span[aria-hidden='true']")?.textContent.trim() || '';
      const duration = item.querySelector("span.pvs-entity__caption-wrapper[aria-hidden='true']")?.textContent.trim() || '';
      const location = item.querySelector("span.t-14.t-normal.t-black--light:not(:has(.pvs-entity__caption-wrapper)) > span[aria-hidden='true']")?.textContent.trim() || '';
      
      if (jobTitle || companyAndType) {
        experience.push({
          jobTitle,
          companyAndType,
          duration,
          location
        });
      }
    }
  });
  
  debug.items = items.length;
  return { data: experience, debug };
}

function getEducationSection() {
  const sections = getSectionsList();
  let eduNode = null;
  const debug = {};
  
  if (isRecruiterPage()) {
    // For Recruiter pages, look for education section with different patterns
    const eduSelectors = [
      'section[data-test-education-section]',
      '[data-test-education]',
      '.education-section',
      'section[data-test-academic]',
      '[data-test-academic]'
    ];
    
    for (const selector of eduSelectors) {
      eduNode = document.querySelector(selector);
      if (eduNode) {
        debug.educationSection = selector;
        break;
      }
    }
    if (!eduNode) debug.educationSection = 'not found';
  } else {
    eduNode = getSectionWithId(sections, "education");
    debug.educationSection = eduNode ? 'found' : 'not found';
  }
  
  if (!eduNode) return { data: [], debug };
  
  // For Recruiter pages, try different UL patterns
  let ul = null;
  if (isRecruiterPage()) {
    const ulSelectors = [
      "ul",
      "[data-test-education-list]",
      ".education-list",
      "[data-test-academic-list]"
    ];
    
    for (const selector of ulSelectors) {
      ul = eduNode.querySelector(selector);
      if (ul) {
        debug.educationList = selector;
        break;
      }
    }
    if (!ul) debug.educationList = 'not found';
  } else {
    ul = eduNode.children[2]?.querySelector("ul") || null;
    debug.educationList = ul ? 'found' : 'not found';
  }
  
  if (!ul) return { data: [], debug };
  
  const education = [];
  const items = ul.querySelectorAll("li");
  
  items.forEach((item, index) => {
    if (isRecruiterPage()) {
      // Recruiter page education extraction - try multiple patterns
      const nameSelectors = [
        '[data-test-education-school]',
        '.school-name',
        '[data-test-academic-school]',
        '.academic-school'
      ];
      
      const degreeSelectors = [
        '[data-test-education-degree]',
        '.degree',
        '[data-test-academic-degree]',
        '.academic-degree'
      ];
      
      const durationSelectors = [
        '[data-test-education-duration]',
        '.duration',
        '[data-test-academic-duration]',
        '.academic-duration'
      ];
      
      const gradeSelectors = [
        '[data-test-education-grade]',
        '.grade',
        '[data-test-academic-grade]',
        '.academic-grade'
      ];
      
      let name = '';
      let degree = '';
      let duration = '';
      let grade = '';
      let schoolUrl = '';
      
      // Try to find school name
      for (const selector of nameSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          name = el.textContent.trim();
          break;
        }
      }
      
      // Try to find degree
      for (const selector of degreeSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          degree = el.textContent.trim();
          break;
        }
      }
      
      // Try to find duration
      for (const selector of durationSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          duration = el.textContent.trim();
          break;
        }
      }
      
      // Try to find grade
      for (const selector of gradeSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          grade = el.textContent.trim();
          break;
        }
      }
      
      // Try to find school URL
      const urlEl = item.querySelector('a[href*="/company/"]');
      if (urlEl) {
        schoolUrl = urlEl.href;
      }
      
      if (name || degree) {
        education.push({
          name,
          degree,
          duration,
          grade,
          schoolUrl
        });
      }
    } else {
      // Regular LinkedIn education extraction
      const name = item.querySelector("span[aria-hidden='true']:first-of-type")?.textContent.trim() || '';
      const degree = item.querySelector(".t-14.t-normal:not(.t-black--light) > span[aria-hidden='true']")?.textContent.trim() || '';
      const duration = item.querySelector(".t-14.t-normal.t-black--light span[aria-hidden='true']")?.textContent.trim() || '';
      const grade = item.querySelector(".t-14.t-normal.t-black--light span[aria-hidden='true']:last-child")?.textContent.trim() || '';
      const schoolUrl = item.querySelector("a.optional-action-target-wrapper")?.href || '';
      
      if (name || degree) {
        education.push({
          name,
          degree,
          duration,
          grade,
          schoolUrl
        });
      }
    }
  });
  
  debug.items = items.length;
  return { data: education, debug };
}

function getSkillsSection() {
  const sections = getSectionsList();
  let skillNode = null;
  const debug = {};
  
  if (isRecruiterPage()) {
    // For Recruiter pages, look for skills section with different patterns
    const skillSelectors = [
      'section[data-test-skills-section]',
      '[data-test-skills]',
      '.skills-section',
      'section[data-test-expertise]',
      '[data-test-expertise]'
    ];
    
    for (const selector of skillSelectors) {
      skillNode = document.querySelector(selector);
      if (skillNode) {
        debug.skillsSection = selector;
        break;
      }
    }
    if (!skillNode) debug.skillsSection = 'not found';
  } else {
    skillNode = getSectionWithId(sections, "skills");
    debug.skillsSection = skillNode ? 'found' : 'not found';
  }
  
  if (!skillNode) return { data: [], debug };
  
  // For Recruiter pages, try different UL patterns
  let ul = null;
  if (isRecruiterPage()) {
    const ulSelectors = [
      "ul",
      "[data-test-skills-list]",
      ".skills-list",
      "[data-test-expertise-list]"
    ];
    
    for (const selector of ulSelectors) {
      ul = skillNode.querySelector(selector);
      if (ul) {
        debug.skillsList = selector;
        break;
      }
    }
    if (!ul) debug.skillsList = 'not found';
  } else {
    ul = skillNode.children[2]?.querySelector("ul") || null;
    debug.skillsList = ul ? 'found' : 'not found';
  }
  
  if (!ul) return { data: [], debug };
  
  const skills = [];
  const items = ul.querySelectorAll("li");
  
  items.forEach((item, index) => {
    if (isRecruiterPage()) {
      // Recruiter page skills extraction - try multiple patterns
      const skillSelectors = [
        '[data-test-skill-name]',
        '.skill-name',
        '[data-test-expertise-name]',
        '.expertise-name'
      ];
      
      let skill = '';
      
      // Try to find skill name
      for (const selector of skillSelectors) {
        const el = item.querySelector(selector);
        if (el) {
          skill = el.textContent.trim();
          break;
        }
      }
      
      // Fallback to item text content
      if (!skill) {
        skill = item.textContent.trim();
      }
      
      if (skill) {
        skills.push(skill);
      }
    } else {
      // Regular LinkedIn skills extraction
      const skill = item.querySelector("a[data-field='skill_card_skill_topic'] span[aria-hidden='true']")?.textContent.trim() || 
                   item.textContent.trim() || '';
      
      if (skill) {
        skills.push(skill);
      }
    }
  });
  
  debug.items = items.length;
  return { data: skills, debug };
}

// Network-based extraction for LinkedIn Recruiter pages
let recruiterProfileData = null;

// Network interception is now handled by pageHook.js in the page context

// JSON-based extraction functions for Recruiter pages
function extractBasicProfileFromJson(profileJson) {
  if (!profileJson) return { name: '', headline: '', location: '', about: '', photo_url: '' };
  
  // Handle talent API format
  const firstName = profileJson.unobfuscatedFirstName || profileJson.firstName || '';
  const lastName = profileJson.unobfuscatedLastName || profileJson.lastName || '';
  
  return {
    name: `${firstName} ${lastName}`.trim(),
    headline: profileJson.headline || '',
    location: profileJson.location?.displayName || '',
    about: profileJson.summary || '',
    photo_url: profileJson.profilePicture?.displayImageReference?.vectorImage?.rootUrl || ''
  };
}

function extractExperienceFromJson(profileJson) {
  const experiences = [];
  if (!profileJson) return experiences;

  // With the rewritten URL, we expect `groupedWorkExperience` to be present.
  if (Array.isArray(profileJson.groupedWorkExperience)) {
    profileJson.groupedWorkExperience.forEach(group => {
      if (group.positions) {
        group.positions.forEach(position => {
          experiences.push({
            jobTitle: position.title || '',
            companyAndType: position.companyName || '',
            duration: formatDuration(position.startDateOn, position.endDateOn),
            location: position.location?.displayName || ''
          });
        });
      }
    });
  } else if (Array.isArray(profileJson.currentPositions)) {
    // Fallback for any older data structures that might still appear
    profileJson.currentPositions.forEach(position => {
      experiences.push({
        jobTitle: position.title || '',
        companyAndType: position.companyName || '',
        duration: 'Current',
        location: position.location?.displayName || ''
      });
    });
  }

  return experiences;
}

function extractEducationFromJson(profileJson) {
  const educations = [];
  if (!profileJson || !Array.isArray(profileJson.educations)) return educations;

  // We expect `educations` to be a top-level array.
  profileJson.educations.forEach(edu => {
    educations.push({
      name: edu.schoolName || '',
      degree: edu.degreeName || edu.fieldOfStudy || '',
      duration: formatDuration(edu.startDateOn, edu.endDateOn),
      grade: edu.grade || '',
      schoolUrl: edu.schoolUrl || ''
    });
  });
  
  return educations;
}

function extractSkillsFromJson(profileJson) {
  if (!profileJson || !Array.isArray(profileJson.profileSkills)) return [];

  // We expect `profileSkills` to be a top-level array.
  return profileJson.profileSkills.map(skill => skill.name).sort();
}

function formatDuration(startDate, endDate) {
  const formatDate = (dateObj) => {
    if (!dateObj) return '';
    const year = dateObj.year || '';
    const month = dateObj.month || '';
    return month && year ? `${month}/${year}` : year;
  };
  
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  
  if (start && end) {
    return `${start} - ${end}`;
  } else if (start) {
    return `${start} - Present`;
  }
  return '';
}

// Enhanced extraction function that tries JSON first, then falls back to DOM
function extractLinkedInProfile() {
  const debug = {};
  let data = {
    name: '',
    headline: '',
    location: '',
    about: '',
    photo_url: '',
    experience: [],
    education: [],
    skills: []
  };

  console.log('RapidMatch: Starting profile extraction...');

  // Try JSON-based extraction first (for Recruiter pages)
  if (recruiterProfileData && isRecruiterPage()) {
    console.log('RapidMatch: Using JSON-based extraction for Recruiter page. Keys:', Object.keys(recruiterProfileData));
    try {
      data = {
        ...extractBasicProfileFromJson(recruiterProfileData),
        experience: extractExperienceFromJson(recruiterProfileData),
        education: extractEducationFromJson(recruiterProfileData),
        skills: extractSkillsFromJson(recruiterProfileData)
      };
      debug.jsonExtraction = 'success';
      debug.extractionMethod = 'JSON';
      console.log('RapidMatch: JSON extraction successful, data:', data);
    } catch (error) {
      console.log('RapidMatch: JSON extraction failed, falling back to DOM', error);
      debug.jsonExtraction = 'failed';
    }
  }

  // If JSON extraction failed or wasn't possible, use DOM extraction
  if (!debug.jsonExtraction || debug.jsonExtraction === 'failed') {
    console.log('RapidMatch: Falling back to DOM extraction.');
    const domResult = extractFromDOM();
    data = domResult.data;
    Object.assign(debug, domResult.debug);
    debug.extractionMethod = 'DOM';
  }

  // Final debug info assembly
  debug.isRecruiterPage = isRecruiterPage();
  debug.hasRecruiterData = !!recruiterProfileData;
  debug.currentUrl = window.location.href;
  if (recruiterProfileData) {
    debug.recruiterDataKeys = Object.keys(recruiterProfileData);
  }

  return { data, debug };
}

// Keep existing DOM extraction as fallback
function extractFromDOM() {
  const debug = {};
  let data = {
    name: '',
    headline: '',
    location: '',
    about: '',
    photo_url: '',
    experience: [],
    education: [],
    skills: []
  };

  // Basic profile section
  const basicProfileResult = getBasicProfileSection();
  data = { ...data, ...basicProfileResult.data };
  Object.assign(debug, basicProfileResult.debug);

  // Experience section
  const experienceResult = getExperienceSection();
  data.experience = experienceResult.data;
  Object.assign(debug, experienceResult.debug);

  // Education section
  const educationResult = getEducationSection();
  data.education = educationResult.data;
  Object.assign(debug, educationResult.debug);

  // Skills section
  const skillsResult = getSkillsSection();
  data.skills = skillsResult.data;
  Object.assign(debug, skillsResult.debug);

  return { data, debug };
}

// Message bridge for panel <-> content script communication
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.source !== 'rapidmatch-panel') return;
  const { action, payload, requestId } = event.data;
  
  if (action === 'extractProfile') {
    const result = extractLinkedInProfile();
    window.postMessage({ source: 'rapidmatch-content', action: 'profileExtracted', payload: result, requestId }, '*');
  } else if (action === 'getRoles') {
    chrome.storage.local.get(['roles'], (data) => {
      window.postMessage({ source: 'rapidmatch-content', action: 'roles', payload: data.roles || [], requestId }, '*');
    });
  } else if (action === 'saveRole') {
    chrome.storage.local.get(['roles'], (data) => {
      const roles = Array.isArray(data.roles) ? data.roles : [];
      roles.push(payload);
      chrome.storage.local.set({ roles }, () => {
        window.postMessage({ source: 'rapidmatch-content', action: 'roles', payload: roles, requestId }, '*');
      });
    });
  } else if (action === 'setActiveRole') {
    chrome.storage.local.set({ activeRoleId: payload }, () => {
      window.postMessage({ source: 'rapidmatch-content', action: 'activeRole', payload, requestId }, '*');
    });
  } else if (action === 'getActiveRole') {
    chrome.storage.local.get(['activeRoleId'], (data) => {
      window.postMessage({ source: 'rapidmatch-content', action: 'activeRole', payload: data.activeRoleId, requestId }, '*');
    });
  } else if (action === 'editRole') {
    chrome.storage.local.get(['roles'], (data) => {
      let roles = Array.isArray(data.roles) ? data.roles : [];
      roles = roles.map(r => r.id === payload.id ? { ...r, ...payload } : r);
      chrome.storage.local.set({ roles }, () => {
        window.postMessage({ source: 'rapidmatch-content', action: 'roles', payload: roles, requestId }, '*');
      });
    });
  } else if (action === 'deleteRole') {
    chrome.storage.local.get(['roles'], (data) => {
      let roles = Array.isArray(data.roles) ? data.roles : [];
      roles = roles.filter(r => r.id !== payload);
      chrome.storage.local.set({ roles }, () => {
        window.postMessage({ source: 'rapidmatch-content', action: 'roles', payload: roles, requestId }, '*');
      });
    });
  }
}); 

// Inject the page hook script to intercept network requests in the page context
function injectPageHook() {
  console.log('RapidMatch: Injecting page hook script...');
  
  const hookScript = document.createElement('script');
  hookScript.src = chrome.runtime.getURL('pageHook.js');
  hookScript.onload = () => {
    console.log('RapidMatch: Page hook script loaded successfully');
  };
  (document.head || document.documentElement).appendChild(hookScript);
  hookScript.remove(); // Clean up the script tag after loading
}

// Listen for profile data captured by the page hook
window.addEventListener('rapidMatchProfileDataCaptured', (event) => {
  console.log('RapidMatch: Received profile data from page hook:', event.detail);
  recruiterProfileData = event.detail;
});

// Also listen for any custom events from the page hook for debugging
window.addEventListener('message', (event) => {
  if (event.data && event.data.source === 'rapidmatch-hook') {
    console.log('RapidMatch: Received message from page hook:', event.data);
    recruiterProfileData = event.data.data;
  }
});

// Initialize the page hook injection
injectPageHook();

// Also try to capture data when the page loads (in case network interception missed it)
if (isRecruiterPage()) {
  console.log('RapidMatch: On Recruiter page, setting up data capture...');
  
  // Wait a bit for the page to load, then try to capture any existing data
  setTimeout(() => {
    console.log('RapidMatch: Attempting to capture existing profile data...');
    
    // Look for profile data in the page's existing JavaScript variables
    try {
      // Check for any global variables that might contain profile data
      const globalVars = [
        window.__INITIAL_STATE__,
        window.INITIAL_STATE,
        window.profileData,
        window.__APOLLO_STATE__,
        window.__REDUX_DEVTOOLS_EXTENSION__
      ];
      
      for (const value of globalVars) {
        if (value && typeof value === 'object') {
          console.log('RapidMatch: Found potential global variable:', Object.keys(value));
          // Look for profile data within the global variable
          if (value.firstName || value.lastName || value.headline) {
            recruiterProfileData = value;
            console.log('RapidMatch: Found profile data in global variable', value);
            break;
          }
          // Also check nested objects
          for (const key in value) {
            if (value[key] && typeof value[key] === 'object' && 
                (value[key].firstName || value[key].lastName || value[key].headline)) {
              recruiterProfileData = value[key];
              console.log('RapidMatch: Found profile data in nested global variable', value[key]);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.log('RapidMatch: Error searching global variables:', error);
    }
  }, 2000);
} 