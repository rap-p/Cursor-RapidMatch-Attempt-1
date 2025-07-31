// background.js - Service worker for RapidMatch extension

// Helper function to format dates
function formatDate(dateObj) {
  if (!dateObj) return "";
  if (dateObj.year && dateObj.month) {
    return `${dateObj.year}-${String(dateObj.month).padStart(2, '0')}`;
  }
  if (dateObj.year) {
    return `${dateObj.year}`;
  }
  return "";
}

// LinkedIn Profile Data Extraction Functions

function extractBasicProfile(profileJson) {
  try {
    return {
      name: `${profileJson.firstName || ""} ${profileJson.lastName || ""}`.trim(),
      publicProfileUrl: profileJson.publicProfileUrl || "",
      headline: profileJson.headline || "",
      currentPositions: (profileJson.currentPositions || []).map(pos => ({
        title: pos.title || "",
        company: pos.companyName || ""
      })),
      location: profileJson.location?.displayName || ""
    };
  } catch (error) {
    console.error('Error extracting basic profile:', error);
    return { name: "", publicProfileUrl: "", headline: "", currentPositions: [], location: "" };
  }
}

function extractEducation(profileJson) {
  try {
    return (profileJson.educations || []).map(edu => ({
      school: edu.schoolName || "",
      degree: edu.degreeName || edu.fieldOfStudy || "",
      start: formatDate(edu.startDateOn),
      end: formatDate(edu.endDateOn)
    }));
  } catch (error) {
    console.error('Error extracting education:', error);
    return [];
  }
}

function extractExperience(profileJson) {
  try {
    const experiences = [];
    (profileJson.groupedWorkExperience || []).forEach(group => {
      (group.positions || []).forEach(position => {
        experiences.push({
          title: position.title || "",
          company: position.companyName || "",
          location: position.location?.displayName || "",
          from: formatDate(position.startDateOn),
          to: formatDate(position.endDateOn),
          description: position.description || ""
        });
      });
    });
    return experiences;
  } catch (error) {
    console.error('Error extracting experience:', error);
    return [];
  }
}

function extractSkillsRecruiter(profileJson) {
  try {
    const skills = new Set();
    (profileJson.groupedWorkExperience || []).forEach(group => {
      (group.positions || []).forEach(position => {
        (position.associatedProfileSkillNames || []).forEach(skill => {
          skills.add(skill);
        });
      });
    });
    return Array.from(skills).sort();
  } catch (error) {
    console.error('Error extracting skills:', error);
    return [];
  }
}

function extractRecommendations(profileJson) {
  try {
    return profileJson.recommendations || [];
  } catch (error) {
    console.error('Error extracting recommendations:', error);
    return [];
  }
}

function extractContactInfo(profileJson) {
  try {
    const contactInfo = profileJson.contactInfo || {};
    return {
      email: contactInfo.emailAddress || "",
      phone: contactInfo.phoneNumber || "",
      urls: contactInfo.websites || []
    };
  } catch (error) {
    console.error('Error extracting contact info:', error);
    return { email: "", phone: "", urls: [] };
  }
}

function extractSummary(profileJson) {
  try {
    return profileJson.summary || "";
  } catch (error) {
    console.error('Error extracting summary:', error);
    return "";
  }
}

function extractCertifications(profileJson) {
  try {
    return (profileJson.certifications || []).map(cert => ({
      name: cert.name || "",
      organization: cert.issuingOrganization || "",
      license: cert.licenseNumber || "",
      start: formatDate(cert.startDateOn),
      end: formatDate(cert.endDateOn)
    }));
  } catch (error) {
    console.error('Error extracting certifications:', error);
    return [];
  }
}

function extractLanguages(profileJson) {
  try {
    return (profileJson.languages || []).map(lang => ({
      language: lang.name || "",
      proficiency: lang.proficiency || ""
    }));
  } catch (error) {
    console.error('Error extracting languages:', error);
    return [];
  }
}

function extractHonors(profileJson) {
  try {
    return (profileJson.honors || []).map(honor => ({
      title: honor.title || "",
      issuer: honor.issuer || "",
      date: formatDate(honor.date || honor.issueDate)
    }));
  } catch (error) {
    console.error('Error extracting honors:', error);
    return [];
  }
}

function extractCourses(profileJson) {
  try {
    return (profileJson.courses || []).map(course => ({
      title: course.name || "",
      number: course.number || ""
    }));
  } catch (error) {
    console.error('Error extracting courses:', error);
    return [];
  }
}

function extractPublications(profileJson) {
  try {
    return (profileJson.publications || []).map(pub => ({
      title: pub.title || pub.name || "",
      publisher: pub.publisher || "",
      date: formatDate(pub.publicationDate)
    }));
  } catch (error) {
    console.error('Error extracting publications:', error);
    return [];
  }
}

function extractOrganizations(profileJson) {
  try {
    return (profileJson.organizations || []).map(org => ({
      name: org.name || org.organizationName || "",
      role: org.role || org.positionTitle || "",
      start: formatDate(org.startDateOn),
      end: formatDate(org.endDateOn)
    }));
  } catch (error) {
    console.error('Error extracting organizations:', error);
    return [];
  }
}

// Function to process and store profile data received from the content script
function processProfileData(data) {
  try {
    console.log('Background: Processing profile data...', data);
    
    // Extract structured data from the raw JSON
    const processedData = {
      basic: extractBasicProfile(data),
      education: extractEducation(data),
      experience: extractExperience(data),
      skills: extractSkillsRecruiter(data),
      recommendations: extractRecommendations(data),
      contactInfo: extractContactInfo(data),
      summary: extractSummary(data),
      certifications: extractCertifications(data),
      languages: extractLanguages(data),
      honors: extractHonors(data),
      courses: extractCourses(data),
      publications: extractPublications(data),
      organizations: extractOrganizations(data),
      raw: data // Keep the original data for debugging
    };
    
    console.log('Background: Processed profile data:', processedData);
    chrome.storage.local.set({ lastProfileData: processedData });
    
    return processedData;
  } catch (error) {
    console.error('Background: Error processing profile data:', error);
    chrome.storage.local.set({ lastProfileData: data });
    return data;
  }
}

// Main message listener for the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

  // Asynchronously handle actions
  (async () => {
    if (action === 'processProfileData') {
      const processedData = processProfileData(payload);
      sendResponse({ status: 'success', message: 'Data received and processed by background script.', data: processedData });
    } else if (action === 'getProfileData') {
      const { lastProfileData } = await chrome.storage.local.get(['lastProfileData']);
      sendResponse(lastProfileData || null);
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