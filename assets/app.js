/**
 * Chores → Payday App
 * A family chore tracking and rewards system
 */

(function () {
  // Utility functions
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => document.querySelectorAll(selector);
  
  function formatJSON(el, obj) {
    el.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function token() {
    return localStorage.getItem("ADMIN_TOKEN") || "";
  }

  function setToken(v) {
    localStorage.setItem("ADMIN_TOKEN", v);
  }

  function childId() {
    return localStorage.getItem("CHILD_ID") || "";
  }

  function setChildId(v) {
    localStorage.setItem("CHILD_ID", v);
  }

  // Calculate days until Friday (payday)
  function daysUntilPayday() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 5 = Friday
    let daysLeft = (5 - day + 7) % 7;
    if (daysLeft === 0) {
      // It's Friday!
      return 0;
    }
    return daysLeft;
  }

  function formatPaydayCountdown() {
    const days = daysUntilPayday();
    if (days === 0) {
      return "🎉 It's Payday!";
    } else if (days === 1) {
      return "1 day";
    } else {
      return `${days} days`;
    }
  }

  // API helper
  async function api(path, opts = {}) {
    const headers = Object.assign(
      { "content-type": "application/json" },
      opts.headers || {}
    );
    
    if (path.startsWith("/api/parent/")) {
      headers["authorization"] = "Bearer " + token();
    }
    
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    const text = await r.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    if (!r.ok) {
      throw new Error(data && data.error ? data.error : "HTTP " + r.status);
    }
    
    return data;
  }

  // Toast notifications
  function showToast(message, type = "success") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
      <span class="toast-message">${message}</span>
    `;
    
    // Add toast styles if not present
    if (!document.querySelector("#toast-styles")) {
      const style = document.createElement("style");
      style.id = "toast-styles";
      style.textContent = `
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: #1E1E2E;
          color: white;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
          z-index: 1000;
        }
        .toast-success { border-left: 4px solid #10B981; }
        .toast-error { border-left: 4px solid #EF4444; }
        .toast-info { border-left: 4px solid #5D4EE8; }
        .toast-icon { font-size: 16px; }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(20px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Loading button state
  function setButtonLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span>';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
  }

  // ============================================
  // PARENT DASHBOARD
  // ============================================
  
  window.AppParent = {
    async init() {
      const debugOut = $("debugOut");
      const tokenInput = $("adminToken");
      
      // Load saved token
      if (tokenInput) {
        tokenInput.value = token();
      }

      // Save token
      const saveTokenBtn = $("saveToken");
      if (saveTokenBtn) {
        saveTokenBtn.onclick = () => {
          setToken(tokenInput.value.trim());
          showToast("Token saved!", "success");
          formatJSON(debugOut, { ok: true, saved: true });
        };
      }

      // Add child
      const addChildBtn = $("addChild");
      if (addChildBtn) {
        addChildBtn.onclick = async () => {
          const nameInput = $("childName");
          const name = nameInput.value.trim();
          
          if (!name) {
            showToast("Please enter a name", "error");
            return;
          }
          
          setButtonLoading(addChildBtn, true);
          
          try {
            const data = await api("/api/parent/children", {
              method: "POST",
              body: JSON.stringify({ name })
            });
            nameInput.value = "";
            showToast(`${name} added successfully!`, "success");
            formatJSON(debugOut, data);
            this.loadChildren();
          } catch (e) {
            showToast(String(e), "error");
            formatJSON(debugOut, String(e));
          } finally {
            setButtonLoading(addChildBtn, false);
          }
        };
      }

      // Refresh children
      const refreshChildrenBtn = $("refreshChildren");
      if (refreshChildrenBtn) {
        refreshChildrenBtn.onclick = () => this.loadChildren();
      }

      // Add chore
      const addChoreBtn = $("addChore");
      if (addChoreBtn) {
        addChoreBtn.onclick = async () => {
          const title = $("choreTitle").value.trim();
          const points = Number($("chorePoints").value || 0);
          const is_required = $("choreRequired").checked;

          if (!title) {
            showToast("Please enter a chore title", "error");
            return;
          }

          setButtonLoading(addChoreBtn, true);

          try {
            const data = await api("/api/parent/chores", {
              method: "POST",
              body: JSON.stringify({ title, points, is_required })
            });
            $("choreTitle").value = "";
            $("chorePoints").value = "";
            $("choreRequired").checked = false;
            showToast(`"${title}" chore added!`, "success");
            formatJSON(debugOut, data);
            this.loadChores();
          } catch (e) {
            showToast(String(e), "error");
            formatJSON(debugOut, String(e));
          } finally {
            setButtonLoading(addChoreBtn, false);
          }
        };
      }

      // Refresh chores
      const refreshChoresBtn = $("refreshChores");
      if (refreshChoresBtn) {
        refreshChoresBtn.onclick = () => this.loadChores();
      }

      // Refresh approvals
      const refreshApprovalsBtn = $("refreshApprovals");
      if (refreshApprovalsBtn) {
        refreshApprovalsBtn.onclick = () => this.loadApprovals();
      }

      // Run payday
      const runPaydayBtn = $("runPayday");
      if (runPaydayBtn) {
        runPaydayBtn.onclick = async () => {
          if (!confirm("Run payday now? This will calculate and distribute rewards for the week.")) {
            return;
          }
          
          setButtonLoading(runPaydayBtn, true);
          
          try {
            const data = await api("/api/parent/runPayday", { method: "POST" });
            showToast("Payday complete! 🎉", "success");
            formatJSON(debugOut, data);
          } catch (e) {
            showToast(String(e), "error");
            formatJSON(debugOut, String(e));
          } finally {
            setButtonLoading(runPaydayBtn, false);
          }
        };
      }

      // Load initial data
      this.loadChildren();
      this.loadChores();
      this.loadApprovals();
    },

    async loadChildren() {
      const list = $("childrenList");
      if (!list) return;

      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';

      try {
        const data = await api("/api/parent/children");
        
        if (!data.children || data.children.length === 0) {
          list.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">👶</div>
              <div class="empty-state-title">No children yet</div>
              <div class="empty-state-text">Add your first child above to get started</div>
            </div>
          `;
          return;
        }

        list.innerHTML = data.children.map(child => `
          <div class="item child-item fade-in">
            <div class="item-icon">${child.name.charAt(0).toUpperCase()}</div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(child.name)}</div>
              <div class="item-meta">ID: ${child.id}</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-ghost" onclick="copyToClipboard('${child.id}')">📋 Copy ID</button>
            </div>
          </div>
        `).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-text text-danger">${escapeHtml(String(e))}</div></div>`;
      }
    },

    async loadChores() {
      const list = $("choresList");
      if (!list) return;

      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';

      try {
        const data = await api("/api/parent/chores");
        
        if (!data.chores || data.chores.length === 0) {
          list.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🧹</div>
              <div class="empty-state-title">No chores yet</div>
              <div class="empty-state-text">Create your first chore above</div>
            </div>
          `;
          return;
        }

        list.innerHTML = data.chores.map(chore => `
          <div class="item chore-item ${chore.is_required ? 'required' : ''} fade-in">
            <div class="item-icon ${chore.is_required ? 'card-icon pink' : 'card-icon blue'}">
              ${chore.is_required ? '⭐' : '✨'}
            </div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(chore.title)}</div>
              <div class="item-meta">
                ${chore.is_required ? '<span class="badge badge-danger">Required</span>' : '<span class="badge badge-neutral">Bonus</span>'}
                ${chore.active ? '' : '<span class="badge badge-neutral">Inactive</span>'}
              </div>
            </div>
            <div class="points">${chore.points}</div>
          </div>
        `).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-text text-danger">${escapeHtml(String(e))}</div></div>`;
      }
    },

    async loadApprovals() {
      const list = $("approvalsList");
      if (!list) return;

      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';

      try {
        const data = await api("/api/parent/approvals");
        
        if (!data.items || data.items.length === 0) {
          list.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">✅</div>
              <div class="empty-state-title">All caught up!</div>
              <div class="empty-state-text">No chores waiting for approval</div>
            </div>
          `;
          return;
        }

        list.innerHTML = data.items.map(item => `
          <div class="approval-item fade-in" data-child="${item.child_id}" data-chore="${item.chore_id}" data-date="${item.date}">
            <div class="item-icon card-icon gold">⏳</div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(item.chore_title)}</div>
              <div class="item-meta">
                ${escapeHtml(item.child_name)} • 
                ${item.is_required ? '<span class="badge badge-danger">Required</span>' : ''}
              </div>
            </div>
            <div class="points">${item.points}</div>
            <div class="item-actions">
              <button class="btn btn-sm btn-success" onclick="AppParent.approve(this, 'approved')">✓ Approve</button>
              <button class="btn btn-sm btn-danger" onclick="AppParent.approve(this, 'rejected')">✕</button>
            </div>
          </div>
        `).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-text text-danger">${escapeHtml(String(e))}</div></div>`;
      }
    },

    async approve(btn, action) {
      const item = btn.closest(".approval-item");
      const child_id = item.dataset.child;
      const chore_id = item.dataset.chore;
      const date = item.dataset.date;

      setButtonLoading(btn, true);

      try {
        await api("/api/parent/approve", {
          method: "POST",
          body: JSON.stringify({ child_id, chore_id, date, action })
        });
        
        item.classList.add("pop");
        setTimeout(() => {
          item.style.opacity = "0";
          item.style.transform = "translateX(20px)";
          setTimeout(() => item.remove(), 300);
        }, 200);
        
        showToast(action === "approved" ? "Chore approved! 🎉" : "Chore rejected", action === "approved" ? "success" : "info");
      } catch (e) {
        showToast(String(e), "error");
      } finally {
        setButtonLoading(btn, false);
      }
    }
  };

  // ============================================
  // CHILD DASHBOARD
  // ============================================
  
  window.AppChild = {
    async init() {
      const debugOut = $("childDebug");
      const childIdInput = $("childId");
      
      // Load saved child ID
      if (childIdInput) {
        childIdInput.value = childId();
      }

      // Update payday countdown
      this.updatePaydayCountdown();

      // Save child ID
      const saveChildIdBtn = $("saveChildId");
      if (saveChildIdBtn) {
        saveChildIdBtn.onclick = () => {
          setChildId(childIdInput.value.trim());
          showToast("ID saved!", "success");
          if (debugOut) formatJSON(debugOut, { ok: true, saved: true, child_id: childId() });
          this.loadChores();
          this.loadNotifications();
        };
      }

      // Refresh chores
      const refreshBtn = $("refreshChild");
      if (refreshBtn) {
        refreshBtn.onclick = () => this.loadChores();
      }

      // Refresh notifications
      const refreshNotificationsBtn = $("refreshNotifications");
      if (refreshNotificationsBtn) {
        refreshNotificationsBtn.onclick = () => this.loadNotifications();
      }

      // Load initial data if we have a child ID
      if (childId()) {
        this.loadChores();
        this.loadNotifications();
      }
    },

    updatePaydayCountdown() {
      const countdown = $("paydayCountdown");
      if (countdown) {
        countdown.textContent = formatPaydayCountdown();
      }
    },

    async loadChores() {
      const list = $("childChoresList");
      const statsContainer = $("choreStats");
      const debugOut = $("childDebug");
      
      if (!list) return;

      const cid = childId();
      if (!cid) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔑</div>
            <div class="empty-state-title">Enter your ID</div>
            <div class="empty-state-text">Ask your parent for your Child ID to see your chores</div>
          </div>
        `;
        return;
      }

      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';

      try {
        const data = await api("/api/child/chores?child_id=" + encodeURIComponent(cid));
        if (debugOut) formatJSON(debugOut, data);
        
        if (!data.chores || data.chores.length === 0) {
          list.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🎉</div>
              <div class="empty-state-title">No chores assigned</div>
              <div class="empty-state-text">Your parent hasn't added any chores yet</div>
            </div>
          `;
          return;
        }

        // Calculate stats
        const total = data.chores.length;
        const completed = data.chores.filter(c => c.today_status === "approved" || c.today_status === "submitted").length;
        const totalPoints = data.chores.reduce((sum, c) => sum + (c.points || 0), 0);
        const earnedPoints = data.chores.filter(c => c.today_status === "approved").reduce((sum, c) => sum + (c.points || 0), 0);

        // Update stats
        if (statsContainer) {
          statsContainer.innerHTML = `
            <div class="stat-card">
              <div class="stat-value">${completed}/${total}</div>
              <div class="stat-label">Done Today</div>
            </div>
            <div class="stat-card gold">
              <div class="stat-value">${earnedPoints}</div>
              <div class="stat-label">Points Earned</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalPoints}</div>
              <div class="stat-label">Possible Points</div>
            </div>
          `;
        }

        // Render chores
        list.innerHTML = data.chores.map(chore => {
          const statusClass = chore.today_status === "approved" ? "completed" : "";
          const statusBadge = this.getStatusBadge(chore.today_status);
          
          return `
            <div class="item chore-item ${statusClass} ${chore.is_required ? 'required' : ''} fade-in" data-chore="${chore.id}">
              <div class="item-icon ${chore.is_required ? 'card-icon pink' : 'card-icon blue'}">
                ${chore.today_status === "approved" ? '✅' : chore.is_required ? '⭐' : '✨'}
              </div>
              <div class="item-content">
                <div class="item-title">${escapeHtml(chore.title)}</div>
                <div class="item-meta">
                  ${chore.is_required ? '<span class="badge badge-danger">Required</span>' : '<span class="badge badge-neutral">Bonus</span>'}
                  ${statusBadge}
                </div>
              </div>
              <div class="points">${chore.points}</div>
              <div class="item-actions">
                ${this.getActionButton(chore)}
              </div>
            </div>
          `;
        }).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-text text-danger">${escapeHtml(String(e))}</div></div>`;
        if (debugOut) formatJSON(debugOut, String(e));
      }
    },

    getStatusBadge(status) {
      switch (status) {
        case "approved":
          return '<span class="badge badge-success">Approved</span>';
        case "submitted":
          return '<span class="badge badge-warning">Waiting</span>';
        case "rejected":
          return '<span class="badge badge-danger">Try Again</span>';
        case "excused":
          return '<span class="badge badge-primary">Excused</span>';
        default:
          return '';
      }
    },

    getActionButton(chore) {
      if (chore.today_status === "approved") {
        return '<span class="badge badge-success">Done! 🎉</span>';
      } else if (chore.today_status === "submitted") {
        return '<span class="badge badge-warning">⏳ Pending</span>';
      } else {
        return `<button class="btn btn-sm btn-primary" onclick="AppChild.checkIn('${chore.id}')">✓ I did it!</button>`;
      }
    },

    async checkIn(choreId) {
      const cid = childId();
      if (!cid) {
        showToast("Please save your Child ID first", "error");
        return;
      }

      const item = document.querySelector(`[data-chore="${choreId}"]`);
      const btn = item?.querySelector(".btn-primary");
      
      if (btn) setButtonLoading(btn, true);

      try {
        await api("/api/child/checkin", {
          method: "POST",
          body: JSON.stringify({ child_id: cid, chore_id: choreId })
        });
        
        if (item) {
          item.classList.add("celebrate");
        }
        
        showToast("Great job! Waiting for approval 🎉", "success");
        this.loadChores();
      } catch (e) {
        showToast(String(e), "error");
      } finally {
        if (btn) setButtonLoading(btn, false);
      }
    },

    async loadNotifications() {
      const list = $("notificationsList");
      if (!list) return;

      const cid = childId();
      if (!cid) {
        list.innerHTML = '';
        return;
      }

      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';

      try {
        const data = await api("/api/child/notifications?child_id=" + encodeURIComponent(cid));
        
        if (!data.notifications || data.notifications.length === 0) {
          list.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">📭</div>
              <div class="empty-state-title">No notifications</div>
              <div class="empty-state-text">Complete some chores to see your progress!</div>
            </div>
          `;
          return;
        }

        list.innerHTML = data.notifications.slice(0, 10).map(notif => {
          const isPayday = notif.message.includes("Payday") || notif.message.includes("payout");
          const isSuccess = notif.message.includes("✅") || notif.message.includes("earned");
          
          return `
            <div class="notification ${isSuccess ? 'success' : 'warning'} fade-in">
              <div class="notification-icon">${isPayday ? '💰' : isSuccess ? '🎉' : '📋'}</div>
              <div class="notification-content">
                <div class="notification-message">${escapeHtml(notif.message)}</div>
                <div class="notification-time">${formatDate(notif.created_at)}</div>
              </div>
            </div>
          `;
        }).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-text text-danger">${escapeHtml(String(e))}</div></div>`;
      }
    }
  };

  // ============================================
  // LANDING PAGE
  // ============================================
  
  window.AppHome = {
    init() {
      const pingBtn = $("pingBtn");
      const pingOut = $("pingOut");
      
      if (pingBtn && pingOut) {
        pingBtn.onclick = async () => {
          setButtonLoading(pingBtn, true);
          pingOut.textContent = "Connecting...";
          
          try {
            const r = await fetch("/api/ping");
            const data = await r.text();
            pingOut.textContent = data;
            showToast("API connected!", "success");
          } catch (e) {
            pingOut.textContent = String(e);
            showToast("Connection failed", "error");
          } finally {
            setButtonLoading(pingBtn, false);
          }
        };
      }
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
    
    return date.toLocaleDateString();
  }

  // Global helper
  window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied to clipboard!", "success");
    }).catch(() => {
      showToast("Failed to copy", "error");
    });
  };
})();
