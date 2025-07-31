document.addEventListener('DOMContentLoaded', () => {
  console.log('RapidMatch: Panel.js loaded and DOM ready');
  
  // --- DOM Element Selectors ---
  const tabButtons = document.querySelectorAll('.rapidmatch-tab');
  const tabPanels = document.querySelectorAll('.rapidmatch-tab-panel');
  const scanBtn = document.getElementById('scan-now');
  const resultDiv = document.getElementById('scan-result');
  const addRoleBtn = document.getElementById('add-role');
  const roleModal = document.getElementById('role-modal');
  const cancelRoleBtn = document.getElementById('cancel-role');
  const roleForm = document.getElementById('role-form');
  const rolesListDiv = document.getElementById('roles-list');
  const roleDetailsDiv = document.getElementById('role-details');
  
  console.log('RapidMatch: Found elements:', {
    tabButtons: tabButtons.length,
    tabPanels: tabPanels.length,
    scanBtn: !!scanBtn,
    resultDiv: !!resultDiv,
    addRoleBtn: !!addRoleBtn
  });

  let editingRoleId = null;
  
  // --- API Communication ---
  function sendMessage(action, payload) {
    return chrome.runtime.sendMessage({ action, payload });
  }

  // --- Tab Switching Logic ---
  console.log('RapidMatch: Setting up tab switching for', tabButtons.length, 'buttons');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('RapidMatch: Tab clicked:', btn.getAttribute('data-tab'));
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      tabPanels.forEach(panel => {
        panel.style.display = panel.getAttribute('data-tab') === tab ? 'block' : 'none';
      });
      if (tab === 'roles') {
        renderRolesList();
      }
    });
  });

  // --- Scan Logic ---
  console.log('RapidMatch: Setting up scan button listener');
  scanBtn.addEventListener('click', async () => {
    console.log('RapidMatch: Scan button clicked');
    resultDiv.innerHTML = '<p>🔍 Scanning profile...</p>';
    try {
      const activeTab = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('RapidMatch: Active tab:', activeTab[0]);
      
      if (!activeTab[0]) {
        throw new Error("Could not find active tab.");
      }
      
      console.log('RapidMatch: Sending extractProfile message to tab:', activeTab[0].id);
      const profileResult = await chrome.tabs.sendMessage(activeTab[0].id, { action: 'extractProfile' });
      console.log('RapidMatch: Profile result:', profileResult);
      
      if (!profileResult || !profileResult.data) {
        throw new Error(profileResult?.debug?.error || "Failed to extract profile data. The content script may not be running or the page may not be supported.");
      }
      
      const profile = profileResult.data;
      
      // Check if this is fallback data
      if (profileResult.debug?.fallback) {
        resultDiv.innerHTML = `
          <div class="match-result">
            <h3>⚠️ Debug Mode</h3>
            <p><strong>Page:</strong> ${profile.pageTitle}</p>
            <p><strong>URL:</strong> ${profile.pageUrl}</p>
            <p><strong>Is LinkedIn:</strong> ${profile.isLinkedIn ? 'Yes' : 'No'}</p>
            <p><strong>Timestamp:</strong> ${new Date(profile.timestamp).toLocaleString()}</p>
            <p><em>This is fallback data. The extension is working but hasn't captured LinkedIn profile data yet.</em></p>
          </div>
          <details>
            <summary>Debug Info</summary>
            <pre>${JSON.stringify(profileResult, null, 2)}</pre>
          </details>
        `;
        return;
      }
      
      const activeRoleId = await sendMessage('getActiveRole');
      if (!activeRoleId) {
        resultDiv.innerHTML = '<p>❌ No active role selected. Please create and select a role first.</p>';
        return;
      }
      
      const roles = await sendMessage('getRoles');
      const activeRole = roles.find(role => role.id === activeRoleId);
      if (!activeRole) {
        resultDiv.innerHTML = '<p>❌ Active role not found. Please select a valid role.</p>';
        return;
      }
      
      // Basic matching logic (can be expanded)
      const matchedSkills = profile.profileSkills?.filter(skill => 
        activeRole.jd.toLowerCase().includes(skill.name.toLowerCase())
      ) || [];
      
      const score = Math.min((matchedSkills.length / 10) * 100, 100); // Simple scoring

      resultDiv.innerHTML = `
        <div class="match-result">
          <h3>Match Score: ${score}%</h3>
          <p><strong>Matched Skills:</strong> ${matchedSkills.map(s => s.name).join(', ') || 'None'}</p>
        </div>
        <details>
          <summary>Extracted Data</summary>
          <pre>${JSON.stringify(profile, null, 2)}</pre>
        </details>
      `;
    } catch (error) {
      resultDiv.innerHTML = `<p>❌ Error: ${error.message}</p><pre>${error.stack}</pre>`;
    }
  });

  // --- Role Management Logic ---
  function closeRoleModal() {
    roleModal.style.display = 'none';
    roleForm.reset();
    editingRoleId = null;
  }

  addRoleBtn.addEventListener('click', () => {
    document.getElementById('role-modal-title').innerText = 'Add Role';
    roleModal.style.display = 'flex';
  });

  cancelRoleBtn.addEventListener('click', closeRoleModal);

  roleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('role-title').value.trim();
    const jd = document.getElementById('role-jd').value.trim();
    const notes = document.getElementById('role-notes').value.trim();
    if (!title || !jd) return;

    const now = Date.now();
    let roleData;

    if (editingRoleId) {
      const roles = await sendMessage('getRoles');
      const existingRole = roles.find(r => r.id === editingRoleId);
      roleData = { ...existingRole, title, jd, notes, updatedAt: now };
      await sendMessage('editRole', roleData);
    } else {
      roleData = { id: 'role_' + now, title, jd, notes, createdAt: now, updatedAt: now };
      await sendMessage('saveRole', roleData);
    }
    
    closeRoleModal();
    renderRolesList();
  });

  async function renderRolesList() {
    const roles = await sendMessage('getRoles');
    const activeRoleId = await sendMessage('getActiveRole');

    if (!Array.isArray(roles) || roles.length === 0) {
      rolesListDiv.innerHTML = "<p>No roles yet. Click 'Add Role' to create one.</p>";
      roleDetailsDiv.style.display = 'none';
      return;
    }

    rolesListDiv.innerHTML = roles.map(role => `
      <div class="role-list-item${role.id === activeRoleId ? ' active' : ''}" data-roleid="${role.id}">
        <div class="role-title" data-roleid="${role.id}">${role.title}</div>
        <div class="role-actions">
          <button class="set-active-role" data-roleid="${role.id}" ${role.id === activeRoleId ? 'disabled' : ''}>${role.id === activeRoleId ? 'Active' : 'Set Active'}</button>
          <button class="edit-role" data-roleid="${role.id}">Edit</button>
          <button class="delete-role" data-roleid="${role.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // Attach event listeners
    rolesListDiv.querySelectorAll('.role-list-item .role-title').forEach(el => {
      el.addEventListener('click', () => showRoleDetails(el.getAttribute('data-roleid')));
    });
    rolesListDiv.querySelectorAll('.set-active-role').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendMessage('setActiveRole', btn.getAttribute('data-roleid')).then(renderRolesList);
      });
    });
    rolesListDiv.querySelectorAll('.edit-role').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        editingRoleId = btn.getAttribute('data-roleid');
        const role = roles.find(r => r.id === editingRoleId);
        if (role) {
          document.getElementById('role-modal-title').innerText = 'Edit Role';
          document.getElementById('role-title').value = role.title;
          document.getElementById('role-jd').value = role.jd;
          document.getElementById('role-notes').value = role.notes;
          roleModal.style.display = 'flex';
        }
      });
    });
    rolesListDiv.querySelectorAll('.delete-role').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this role?')) {
          sendMessage('deleteRole', btn.getAttribute('data-roleid')).then(renderRolesList);
        }
      });
    });

    if (activeRoleId) {
      showRoleDetails(activeRoleId);
    } else {
      roleDetailsDiv.style.display = 'none';
    }
  }

  async function showRoleDetails(roleId) {
    const roles = await sendMessage('getRoles');
    const role = roles.find(r => r.id === roleId);
    if (role) {
      roleDetailsDiv.style.display = 'block';
      roleDetailsDiv.innerHTML = `
        <h3>${role.title}</h3>
        <div><strong>Job Description:</strong><pre>${role.jd}</pre></div>
        <div style="margin-top:10px;"><strong>Intake Notes:</strong><pre>${role.notes || 'N/A'}</pre></div>
      `;
    }
  }

  // Initial Render
  renderRolesList();
  
  // Test: Add a simple click handler to test if DOM is working
  console.log('RapidMatch: Adding test click handler');
  document.body.addEventListener('click', (e) => {
    console.log('RapidMatch: Body clicked:', e.target.tagName, e.target.id);
  });
}); 