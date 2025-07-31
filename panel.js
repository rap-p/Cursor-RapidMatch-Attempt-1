function attachRapidMatchListeners(attempt = 0) {
  // Tab switching logic
  const tabButtons = document.querySelectorAll('.rapidmatch-tab');
  const tabPanels = document.querySelectorAll('.rapidmatch-tab-panel');
  const addRoleBtn = document.getElementById('add-role');
  const roleModal = document.getElementById('role-modal');
  const cancelRoleBtn = document.getElementById('cancel-role');
  const roleForm = document.getElementById('role-form');
  const rolesListDiv = document.getElementById('roles-list');

  // If any required element is missing, retry
  if (!tabButtons.length || !tabPanels.length || !addRoleBtn || !roleModal || !cancelRoleBtn || !roleForm || !rolesListDiv) {
    if (attempt < 10) {
      setTimeout(() => attachRapidMatchListeners(attempt + 1), 100);
    }
    return;
  }

  // Messaging helpers
  let requestIdCounter = 0;
  function sendRapidMatchMessage(action, payload) {
    return new Promise((resolve) => {
      const requestId = 'req_' + (++requestIdCounter);
      function handler(event) {
        if (event.data && event.data.source === 'rapidmatch-content' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ source: 'rapidmatch-panel', action, payload, requestId }, '*');
    });
  }

  let editingRoleId = null;

  // On first load, create a default Software Engineer role if none exist
  async function ensureDefaultRole() {
    const roles = await sendRapidMatchMessage('getRoles');
    if (!Array.isArray(roles) || roles.length === 0) {
      const now = Date.now();
      const defaultRole = {
        id: 'role_' + now,
        title: 'Software Engineer',
        jd: `We are seeking a Software Engineer with experience in:
- JavaScript, TypeScript, React, Node.js
- REST APIs, SQL/NoSQL databases
- Git, CI/CD, cloud platforms (AWS/GCP)
- Writing clean, maintainable code
- Collaborating in agile teams

Bonus: Experience with Docker, GraphQL, or microservices.
`,
        notes: 'Looking for strong problem-solving skills, good communication, and a track record of shipping features in production.',
        rip: {
          mustHaveSkills: [
            'JavaScript', 'TypeScript', 'React', 'Node.js', 'REST', 'SQL', 'Git', 'AWS', 'CI/CD'
          ],
          niceToHaveSkills: [
            'Docker', 'GraphQL', 'Microservices', 'GCP', 'Kubernetes'
          ],
          minYearsExperience: 2,
          education: 'Bachelor\'s in Computer Science or related field (or equivalent experience)'
        },
        createdAt: now,
        updatedAt: now
      };
      await sendRapidMatchMessage('saveRole', defaultRole);
      await sendRapidMatchMessage('setActiveRole', defaultRole.id);
      window.location.reload(); // Force reload so UI picks up the new role
    }
  }

  // Reset to default role
  async function resetToDefaultRole() {
    if (confirm('This will delete all existing roles and create a default Software Engineer role. Continue?')) {
      // Delete all roles
      const roles = await sendRapidMatchMessage('getRoles');
      for (const role of roles) {
        await sendRapidMatchMessage('deleteRole', role.id);
      }
      // Create default role
      const now = Date.now();
      const defaultRole = {
        id: 'role_' + now,
        title: 'Software Engineer',
        jd: `We are seeking a Software Engineer with experience in:
- JavaScript, TypeScript, React, Node.js
- REST APIs, SQL/NoSQL databases
- Git, CI/CD, cloud platforms (AWS/GCP)
- Writing clean, maintainable code
- Collaborating in agile teams

Bonus: Experience with Docker, GraphQL, or microservices.
`,
        notes: 'Looking for strong problem-solving skills, good communication, and a track record of shipping features in production.',
        rip: {
          mustHaveSkills: [
            'JavaScript', 'TypeScript', 'React', 'Node.js', 'REST', 'SQL', 'Git', 'AWS', 'CI/CD'
          ],
          niceToHaveSkills: [
            'Docker', 'GraphQL', 'Microservices', 'GCP', 'Kubernetes'
          ],
          minYearsExperience: 2,
          education: 'Bachelor\'s in Computer Science or related field (or equivalent experience)'
        },
        createdAt: now,
        updatedAt: now
      };
      await sendRapidMatchMessage('saveRole', defaultRole);
      await sendRapidMatchMessage('setActiveRole', defaultRole.id);
      window.location.reload();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      tabPanels.forEach(panel => {
        panel.style.display = panel.getAttribute('data-tab') === tab ? 'block' : 'none';
      });
    });
  });

  // Scan button logic
  const scanBtn = document.getElementById('scan-now');
  const resultDiv = document.getElementById('scan-result');
  if (scanBtn && resultDiv) {
    scanBtn.addEventListener('click', async () => {
      resultDiv.innerHTML = '<p>🔍 Scanning profile...</p>';
      
      try {
        // Extract profile data
        const profileResult = await sendRapidMatchMessage('extractProfile');
        const profile = profileResult.data;
        const debug = profileResult.debug;
        
        // Get active role
        const activeRoleId = await sendRapidMatchMessage('getActiveRole');
        if (!activeRoleId) {
          resultDiv.innerHTML = '<p>❌ No active role selected. Please create and select a role first.</p>';
          return;
        }
        
        // Get the full role object
        const roles = await sendRapidMatchMessage('getRoles');
        const activeRole = roles.find(role => role.id === activeRoleId);
        if (!activeRole || !activeRole.rip) {
          resultDiv.innerHTML = '<p>❌ Active role not found or missing RIP data. Please select a valid role.</p>';
          return;
        }
        
        // Perform matching
        const rip = activeRole.rip;
        const matchedMustHave = rip.mustHaveSkills.filter(skill => 
          profile.skills.some(profileSkill => 
            profileSkill.toLowerCase().includes(skill.toLowerCase())
          )
        );
        
        const matchedNiceToHave = rip.niceToHaveSkills.filter(skill => 
          profile.skills.some(profileSkill => 
            profileSkill.toLowerCase().includes(skill.toLowerCase())
          )
        );
        
        // Calculate years of experience from first job start date
        let estimatedYears = 0;
        if (profile.experience && profile.experience.length > 0) {
          // Find the earliest job by looking for start dates in duration strings
          let earliestYear = new Date().getFullYear(); // Default to current year
          
          profile.experience.forEach(exp => {
            const duration = exp.duration || '';
            // Look for year patterns like "2020 - 2022" or "2020 - Present"
            const yearMatch = duration.match(/(\d{4})/);
            if (yearMatch) {
              const jobYear = parseInt(yearMatch[1]);
              if (jobYear < earliestYear) {
                earliestYear = jobYear;
              }
            }
          });
          
          // Calculate years from earliest job to now
          const currentYear = new Date().getFullYear();
          estimatedYears = currentYear - earliestYear;
        }
        
        // Calculate score
        const mustHaveScore = (matchedMustHave.length / rip.mustHaveSkills.length) * 60;
        const niceToHaveScore = (matchedNiceToHave.length / rip.niceToHaveSkills.length) * 20;
        const experienceScore = Math.min(estimatedYears / rip.minYearsExperience, 1) * 20;
        const totalScore = Math.round(mustHaveScore + niceToHaveScore + experienceScore);
        
        // Determine label
        let label, explanation;
        if (totalScore >= 80) {
          label = 'Near Perfect Fit';
          explanation = 'Excellent match with most requirements.';
        } else if (totalScore >= 60) {
          label = 'Great Fit';
          explanation = 'Strong match with key requirements.';
        } else if (totalScore >= 40) {
          label = 'Weak Fit';
          explanation = 'Some relevant experience but missing key requirements.';
        } else {
          label = 'Likely Not a Fit';
          explanation = 'Many must-have skills or experience requirements are missing.';
        }
        
        // Display results
        resultDiv.innerHTML = `
          <div class="match-result">
            <h3>${label} (${totalScore}%)</h3>
            <p>${explanation}</p>
            <p><strong>Matched must-have skills:</strong> ${matchedMustHave.length > 0 ? matchedMustHave.join(', ') : 'None'}</p>
            <p><strong>Matched nice-to-have skills:</strong> ${matchedNiceToHave.length > 0 ? matchedNiceToHave.join(', ') : 'None'}</p>
            <p><strong>Estimated years experience:</strong> ${estimatedYears} (required: ${rip.minYearsExperience})</p>
          </div>
          <details>
            <summary>Debug Info</summary>
            <pre>${JSON.stringify(debug, null, 2)}</pre>
          </details>
          <details>
            <summary>Extracted Data</summary>
            <pre>${JSON.stringify(profile, null, 2)}</pre>
          </details>
        `;
        
      } catch (error) {
        resultDiv.innerHTML = `<p>❌ Error: ${error.message}</p>`;
      }
    });
  }

  // Add debug button
  const debugBtn = document.createElement('button');
  debugBtn.textContent = '🔍 Debug Data';
  debugBtn.style.marginTop = '10px';
  debugBtn.style.padding = '5px 10px';
  debugBtn.style.fontSize = '12px';
  debugBtn.addEventListener('click', async () => {
    try {
      const profileResult = await sendRapidMatchMessage('extractProfile');
      const debug = profileResult.debug;
      
      const debugInfo = `
        <h4>Debug Information:</h4>
        <ul>
          <li>Is Recruiter Page: ${debug.isRecruiterPage}</li>
          <li>Has Recruiter Data: ${debug.hasRecruiterData}</li>
          <li>Current URL: ${debug.currentUrl}</li>
          <li>Extraction Method: ${debug.extractionMethod}</li>
          ${debug.recruiterDataKeys ? `<li>Recruiter Data Keys: ${debug.recruiterDataKeys.join(', ')}</li>` : ''}
        </ul>
        <h4>Full Debug Object:</h4>
        <pre>${JSON.stringify(debug, null, 2)}</pre>
      `;
      
      resultDiv.innerHTML = debugInfo;
    } catch (error) {
      resultDiv.innerHTML = `<p>❌ Debug Error: ${error.message}</p>`;
    }
  });
  
  if (resultDiv) {
    resultDiv.appendChild(debugBtn);
  }

  // Role modal logic
  function closeRoleModal() {
    roleModal.style.display = 'none';
    roleForm.reset();
  }

  addRoleBtn.addEventListener('click', () => {
    document.getElementById('role-modal-title').innerText = 'Add Role';
    roleModal.style.display = 'flex';
  });
  cancelRoleBtn.addEventListener('click', closeRoleModal);

  // Save role (add or edit)
  roleForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('role-title').value.trim();
    const jd = document.getElementById('role-jd').value.trim();
    const notes = document.getElementById('role-notes').value.trim();
    if (!title || !jd) return;
    const now = Date.now();
    let newRole;
    if (editingRoleId) {
      newRole = {
        id: editingRoleId,
        title,
        jd,
        notes,
        rip: {
          mustHaveSkills: [],
          niceToHaveSkills: [],
          minYearsExperience: 0,
          education: ''
        },
        updatedAt: now
      };
      await sendRapidMatchMessage('editRole', newRole);
    } else {
      newRole = {
        id: 'role_' + now,
        title,
        jd,
        notes,
        rip: {
          mustHaveSkills: [],
          niceToHaveSkills: [],
          minYearsExperience: 0,
          education: ''
        },
        createdAt: now,
        updatedAt: now
      };
      await sendRapidMatchMessage('saveRole', newRole);
    }
    closeRoleModal();
    editingRoleId = null;
    renderRolesList();
  });

  // Set active role
  async function setActiveRole(roleId) {
    await sendRapidMatchMessage('setActiveRole', roleId);
    renderRolesList();
  }

  // Delete role
  async function deleteRole(roleId) {
    if (confirm('Delete this role?')) {
      await sendRapidMatchMessage('deleteRole', roleId);
      renderRolesList();
    }
  }

  // Show role details
  function showRoleDetails(role) {
    const detailsDiv = document.getElementById('role-details');
    detailsDiv.style.display = 'block';
    detailsDiv.innerHTML = `
      <h3>${role.title}</h3>
      <div><strong>Job Description:</strong><br>${role.jd.replace(/\n/g, '<br>')}</div>
      <div style="margin-top:10px;"><strong>Intake Notes:</strong><br>${role.notes.replace(/\n/g, '<br>')}</div>
    `;
  }

  // Render roles list
  async function renderRolesList() {
    const [roles, activeRoleId] = await Promise.all([
      sendRapidMatchMessage('getRoles'),
      sendRapidMatchMessage('getActiveRole')
    ]);
    if (!Array.isArray(roles) || roles.length === 0) {
      rolesListDiv.innerHTML = "<p>No roles yet. Click 'Add Role' to create one.</p>";
      document.getElementById('role-details').style.display = 'none';
    } else {
      rolesListDiv.innerHTML = roles.map(role => `
        <div class="role-list-item${role.id === activeRoleId ? ' active' : ''}" data-roleid="${role.id}">
          <div class="role-title">${role.title}</div>
          <div class="role-snippet">${role.jd.slice(0, 60)}${role.jd.length > 60 ? '...' : ''}</div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button class="set-active-role" data-roleid="${role.id}">${role.id === activeRoleId ? 'Active' : 'Set Active'}</button>
            <button class="edit-role" data-roleid="${role.id}">Edit</button>
            <button class="delete-role" data-roleid="${role.id}">Delete</button>
          </div>
        </div>
      `).join('');
      // Add reset button
      rolesListDiv.innerHTML += `
        <div style="margin-top:20px;padding:16px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">
          <button id="reset-to-default" style="background:#dc3545;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:0.95rem;">Reset to Default Role</button>
          <p style="margin:8px 0 0 0;font-size:0.9rem;color:#6c757d;">Creates a default Software Engineer role for testing</p>
        </div>
      `;
      // Attach listeners for Set Active, Edit, Delete
      rolesListDiv.querySelectorAll('.set-active-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const roleId = btn.getAttribute('data-roleid');
          setActiveRole(roleId);
        });
      });
      rolesListDiv.querySelectorAll('.edit-role').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const roleId = btn.getAttribute('data-roleid');
          const roles = await sendRapidMatchMessage('getRoles');
          const role = roles.find(r => r.id === roleId);
          if (role) {
            editingRoleId = role.id;
            document.getElementById('role-modal-title').innerText = 'Edit Role';
            document.getElementById('role-title').value = role.title;
            document.getElementById('role-jd').value = role.jd;
            document.getElementById('role-notes').value = role.notes;
            document.getElementById('role-modal').style.display = 'flex';
          }
        });
      });
      rolesListDiv.querySelectorAll('.delete-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const roleId = btn.getAttribute('data-roleid');
          deleteRole(roleId);
        });
      });
      // Reset to default button
      const resetBtn = document.getElementById('reset-to-default');
      if (resetBtn) {
        resetBtn.addEventListener('click', resetToDefaultRole);
      }
      // Show details on click
      rolesListDiv.querySelectorAll('.role-list-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          if (e.target.tagName === 'BUTTON') return; // Don't trigger on button click
          const roleId = item.getAttribute('data-roleid');
          const roles = await sendRapidMatchMessage('getRoles');
          const role = roles.find(r => r.id === roleId);
          if (role) showRoleDetails(role);
        });
      });
    }
  }

  // At the end of attachRapidMatchListeners, ensure default role and then render
  ensureDefaultRole().then(renderRolesList);
}
attachRapidMatchListeners(); 