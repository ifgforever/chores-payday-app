/**
 * Chores → Payday App
 * With Authentication Support
 */

(function () {
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ============================================
  // AUTH STATE
  // ============================================
  
  let currentUser = null;
  let currentUserType = null;

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.authenticated) {
          currentUser = data.user;
          currentUserType = data.userType;
          return { authenticated: true, userType: data.userType, user: data.user };
        }
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    }
    currentUser = null;
    currentUserType = null;
    return { authenticated: false };
  }

  // ============================================
  // API HELPERS
  // ============================================
  
  async function api(path, opts = {}) {
    const headers = { "content-type": "application/json", ...(opts.headers || {}) };
    const res = await fetch(path, { ...opts, headers, credentials: "include" });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ============================================
  // UI HELPERS
  // ============================================
  
  function showToast(message, type = "success") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span><span>${message}</span>`;
    if (!document.querySelector("#toast-styles")) {
      const style = document.createElement("style");
      style.id = "toast-styles";
      style.textContent = `.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:14px 20px;background:#1E1E2E;color:white;border-radius:12px;font-weight:600;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:toastIn .3s ease,toastOut .3s ease 2.7s forwards;z-index:1000}.toast-success{border-left:4px solid #10B981}.toast-error{border-left:4px solid #EF4444}.toast-info{border-left:4px solid #5D4EE8}@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(20px)}}`;
      document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      btn.dataset.text = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span>';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.text || btn.innerHTML;
    }
  }

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
    return date.toLocaleDateString();
  }

  function daysUntilPayday() {
    const day = new Date().getDay();
    let days = (5 - day + 7) % 7;
    return days === 0 ? 0 : days;
  }

  // ============================================
  // PARENT AUTH
  // ============================================

  window.AppParentLogin = {
    async init() {
      const auth = await checkAuth();
      if (auth.authenticated && auth.userType === "parent") {
        window.location.href = "/parent.html";
        return;
      }

      const form = $("loginForm");
      const errorDiv = $("errorMsg");
      
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type=submit]");
        const email = $("email").value.trim();
        const password = $("password").value;
        
        errorDiv.classList.add("hidden");
        setLoading(btn, true);
        
        try {
          await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
          });
          showToast("Login successful!", "success");
          setTimeout(() => window.location.href = "/parent.html", 500);
        } catch (e) {
          errorDiv.textContent = e.message;
          errorDiv.classList.remove("hidden");
        } finally {
          setLoading(btn, false);
        }
      });
    }
  };

  window.AppParentSignup = {
    async init() {
      const auth = await checkAuth();
      if (auth.authenticated && auth.userType === "parent") {
        window.location.href = "/parent.html";
        return;
      }

      const form = $("signupForm");
      const errorDiv = $("errorMsg");
      
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type=submit]");
        const email = $("email").value.trim();
        const password = $("password").value;
        const confirmPassword = $("confirmPassword").value;
        const displayName = $("displayName")?.value.trim();
        
        if (password !== confirmPassword) {
          errorDiv.textContent = "Passwords do not match";
          errorDiv.classList.remove("hidden");
          return;
        }
        
        errorDiv.classList.add("hidden");
        setLoading(btn, true);
        
        try {
          await api("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ email, password, display_name: displayName })
          });
          showToast("Account created!", "success");
          setTimeout(() => window.location.href = "/parent.html", 500);
        } catch (e) {
          errorDiv.textContent = e.message;
          errorDiv.classList.remove("hidden");
        } finally {
          setLoading(btn, false);
        }
      });
    }
  };

  // ============================================
  // PARENT DASHBOARD
  // ============================================

  window.AppParent = {
    async init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.userType !== "parent") {
        window.location.href = "/login.html";
        return;
      }

      // Show user info
      const userInfo = $("userInfo");
      if (userInfo && currentUser) {
        userInfo.innerHTML = `
          <div class="user-avatar">${(currentUser.display_name || currentUser.email || "P").charAt(0).toUpperCase()}</div>
          <span class="user-name">${escapeHtml(currentUser.display_name || currentUser.email)}</span>
          <button class="btn btn-sm btn-ghost" id="logoutBtn">Logout</button>
        `;
        $("logoutBtn").onclick = () => this.logout();
      }

      // Bind events
      $("addChild")?.addEventListener("click", () => this.addChild());
      $("refreshChildren")?.addEventListener("click", () => this.loadChildren());
      $("addChore")?.addEventListener("click", () => this.addChore());
      $("refreshChores")?.addEventListener("click", () => this.loadChores());
      $("refreshApprovals")?.addEventListener("click", () => this.loadApprovals());
      $("runPayday")?.addEventListener("click", () => this.runPayday());

      // Load data
      this.loadChildren();
      this.loadChores();
      this.loadApprovals();
    },

    async logout() {
      try {
        await api("/api/auth/logout", { method: "POST" });
        window.location.href = "/login.html";
      } catch (e) {
        showToast(e.message, "error");
      }
    },

    async addChild() {
      const nameInput = $("childName");
      const pinInput = $("childPin");
      const btn = $("addChild");
      const name = nameInput?.value.trim();
      const pin = pinInput?.value.trim();
      
      if (!name) {
        showToast("Please enter a name", "error");
        return;
      }
      
      setLoading(btn, true);
      try {
        const data = await api("/api/parent/children", {
          method: "POST",
          body: JSON.stringify({ display_name: name, pin })
        });
        nameInput.value = "";
        if (pinInput) pinInput.value = "";
        showToast(`${name} added! Code: ${data.child.childCode}`, "success");
        this.loadChildren();
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        setLoading(btn, false);
      }
    },

    async loadChildren() {
      const list = $("childrenList");
      if (!list) return;
      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';
      
      try {
        const data = await api("/api/parent/children");
        if (!data.children?.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👶</div><div class="empty-state-title">No children yet</div><div class="empty-state-text">Add your first child above</div></div>`;
          return;
        }
        list.innerHTML = data.children.map(c => `
          <div class="item child-item fade-in">
            <div class="item-icon">${c.display_name.charAt(0).toUpperCase()}</div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(c.display_name)}</div>
              <div class="item-meta">Code: <strong>${c.child_code}</strong> ${c.pin_enabled ? '🔐' : ''}</div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-ghost" onclick="copyToClipboard('${c.child_code}')">📋 Copy</button>
            </div>
          </div>
        `).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state text-danger">${escapeHtml(e.message)}</div>`;
      }
    },

    async addChore() {
      const titleInput = $("choreTitle");
      const pointsInput = $("chorePoints");
      const requiredInput = $("choreRequired");
      const btn = $("addChore");
      
      const title = titleInput?.value.trim();
      const points = Number(pointsInput?.value || 0);
      const is_required = requiredInput?.checked;
      
      if (!title) {
        showToast("Please enter a chore title", "error");
        return;
      }
      
      setLoading(btn, true);
      try {
        await api("/api/parent/chores", {
          method: "POST",
          body: JSON.stringify({ title, points, is_required })
        });
        titleInput.value = "";
        pointsInput.value = "";
        if (requiredInput) requiredInput.checked = false;
        showToast(`"${title}" added!`, "success");
        this.loadChores();
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        setLoading(btn, false);
      }
    },

    async loadChores() {
      const list = $("choresList");
      if (!list) return;
      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';
      
      try {
        const data = await api("/api/parent/chores");
        if (!data.chores?.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧹</div><div class="empty-state-title">No chores yet</div></div>`;
          return;
        }
        list.innerHTML = data.chores.map(c => `
          <div class="item chore-item ${c.is_required ? 'required' : ''} fade-in">
            <div class="item-icon card-icon ${c.is_required ? 'pink' : 'blue'}">${c.is_required ? '⭐' : '✨'}</div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(c.title)}</div>
              <div class="item-meta">${c.is_required ? '<span class="badge badge-danger">Required</span>' : '<span class="badge badge-neutral">Bonus</span>'} ${c.active ? '' : '<span class="badge badge-neutral">Inactive</span>'}</div>
            </div>
            <div class="points">${c.points}</div>
          </div>
        `).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state text-danger">${escapeHtml(e.message)}</div>`;
      }
    },

    async loadApprovals() {
      const list = $("approvalsList");
      if (!list) return;
      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';
      
      try {
        const data = await api("/api/parent/approvals");
        if (!data.approvals?.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">All caught up!</div></div>`;
          return;
        }
        list.innerHTML = data.approvals.map(a => `
          <div class="item approval-item fade-in" data-id="${a.id}">
            <div class="item-icon card-icon gold">⏳</div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(a.chore_title)}</div>
              <div class="item-meta">${escapeHtml(a.child_name)} ${a.is_required ? '<span class="badge badge-danger">Required</span>' : ''}</div>
            </div>
            <div class="points">${a.points}</div>
            <div class="item-actions">
              <button class="btn btn-sm btn-success" onclick="AppParent.approve('${a.id}', 'approved')">✓</button>
              <button class="btn btn-sm btn-danger" onclick="AppParent.approve('${a.id}', 'rejected')">✕</button>
            </div>
          </div>
        `).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state text-danger">${escapeHtml(e.message)}</div>`;
      }
    },

    async approve(instanceId, action) {
      try {
        await api("/api/parent/approvals", {
          method: "POST",
          body: JSON.stringify({ instance_id: instanceId, action })
        });
        showToast(action === "approved" ? "Approved! 🎉" : "Rejected", action === "approved" ? "success" : "info");
        this.loadApprovals();
      } catch (e) {
        showToast(e.message, "error");
      }
    },

    async runPayday() {
      if (!confirm("Run payday now? This will calculate rewards for the week.")) return;
      const btn = $("runPayday");
      setLoading(btn, true);
      try {
        const data = await api("/api/parent/payday", { method: "POST" });
        showToast("Payday complete! 🎉", "success");
        console.log("Payday results:", data);
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        setLoading(btn, false);
      }
    }
  };

  // ============================================
  // CHILD AUTH & DASHBOARD
  // ============================================

  window.AppChildLogin = {
    async init() {
      const auth = await checkAuth();
      if (auth.authenticated && auth.userType === "child") {
        window.location.href = "/child.html";
        return;
      }

      const form = $("childLoginForm");
      const errorDiv = $("errorMsg");
      const pinGroup = $("pinGroup");
      
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type=submit]");
        const code = $("childCode").value.trim().toUpperCase();
        const pin = $("childPin")?.value.trim();
        
        errorDiv.classList.add("hidden");
        setLoading(btn, true);
        
        try {
          await api("/api/child/login", {
            method: "POST",
            body: JSON.stringify({ child_code: code, pin })
          });
          showToast("Welcome! 🎉", "success");
          setTimeout(() => window.location.href = "/child.html", 500);
        } catch (e) {
          errorDiv.textContent = e.message;
          errorDiv.classList.remove("hidden");
          if (e.message.includes("PIN is required") && pinGroup) {
            pinGroup.classList.remove("hidden");
          }
        } finally {
          setLoading(btn, false);
        }
      });
    }
  };

  window.AppChild = {
    async init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.userType !== "child") {
        window.location.href = "/child-login.html";
        return;
      }

      // Show child info
      const userInfo = $("userInfo");
      if (userInfo && currentUser) {
        userInfo.innerHTML = `
          <div class="user-avatar" style="background: linear-gradient(135deg, #A78BFA, #C4B5FD);">${currentUser.display_name.charAt(0).toUpperCase()}</div>
          <span class="user-name">${escapeHtml(currentUser.display_name)}</span>
          <button class="btn btn-sm btn-ghost" id="logoutBtn">Logout</button>
        `;
        $("logoutBtn").onclick = () => this.logout();
      }

      // Update payday countdown
      const countdown = $("paydayCountdown");
      if (countdown) {
        const days = daysUntilPayday();
        countdown.textContent = days === 0 ? "🎉 It's Payday!" : `${days} day${days !== 1 ? 's' : ''}`;
      }

      // Bind events
      $("refreshChores")?.addEventListener("click", () => this.loadChores());
      $("refreshNotifications")?.addEventListener("click", () => this.loadNotifications());

      // Load data
      this.loadChores();
      this.loadNotifications();
    },

    async logout() {
      try {
        await api("/api/auth/logout", { method: "POST" });
        window.location.href = "/child-login.html";
      } catch (e) {
        showToast(e.message, "error");
      }
    },

    async loadChores() {
      const list = $("childChoresList");
      const stats = $("choreStats");
      if (!list) return;
      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';
      
      try {
        const data = await api("/api/child/chores");
        
        if (stats && data.stats) {
          stats.innerHTML = `
            <div class="stat-card"><div class="stat-value">${data.stats.completed}/${data.stats.total}</div><div class="stat-label">Done Today</div></div>
            <div class="stat-card gold"><div class="stat-value">${data.stats.earnedPoints}</div><div class="stat-label">Points Earned</div></div>
            <div class="stat-card"><div class="stat-value">${data.stats.totalPoints}</div><div class="stat-label">Possible</div></div>
          `;
        }
        
        if (!data.chores?.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-title">No chores today!</div></div>`;
          return;
        }
        
        list.innerHTML = data.chores.map(c => {
          const statusClass = c.today_status === "approved" ? "completed" : "";
          const statusBadge = c.today_status === "approved" ? '<span class="badge badge-success">Approved</span>' :
                            c.today_status === "submitted" ? '<span class="badge badge-warning">Waiting</span>' :
                            c.today_status === "rejected" ? '<span class="badge badge-danger">Try Again</span>' : '';
          const actionBtn = c.today_status === "approved" ? '<span class="badge badge-success">Done! 🎉</span>' :
                           c.today_status === "submitted" ? '<span class="badge badge-warning">⏳ Pending</span>' :
                           `<button class="btn btn-sm btn-primary" onclick="AppChild.submit('${c.id}')">✓ I did it!</button>`;
          
          return `
            <div class="item chore-item ${statusClass} ${c.is_required ? 'required' : ''} fade-in" data-id="${c.id}">
              <div class="item-icon card-icon ${c.is_required ? 'pink' : 'blue'}">${c.today_status === "approved" ? '✅' : c.is_required ? '⭐' : '✨'}</div>
              <div class="item-content">
                <div class="item-title">${escapeHtml(c.title)}</div>
                <div class="item-meta">${c.is_required ? '<span class="badge badge-danger">Required</span>' : '<span class="badge badge-neutral">Bonus</span>'} ${statusBadge}</div>
              </div>
              <div class="points">${c.points}</div>
              <div class="item-actions">${actionBtn}</div>
            </div>
          `;
        }).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state text-danger">${escapeHtml(e.message)}</div>`;
      }
    },

    async submit(choreId) {
      const item = document.querySelector(`[data-id="${choreId}"]`);
      const btn = item?.querySelector(".btn-primary");
      if (btn) setLoading(btn, true);
      
      try {
        await api("/api/child/chores", {
          method: "POST",
          body: JSON.stringify({ chore_id: choreId })
        });
        showToast("Great job! Waiting for approval 🎉", "success");
        this.loadChores();
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        if (btn) setLoading(btn, false);
      }
    },

    async loadNotifications() {
      const list = $("notificationsList");
      if (!list) return;
      list.innerHTML = '<div class="text-center"><span class="spinner"></span></div>';
      
      try {
        const data = await api("/api/child/notifications?limit=10");
        if (!data.notifications?.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No notifications</div></div>`;
          return;
        }
        list.innerHTML = data.notifications.map(n => {
          const isSuccess = n.type === "success" || n.type === "payday";
          return `
            <div class="notification ${isSuccess ? 'success' : 'warning'} fade-in">
              <div class="notification-icon">${n.type === "payday" ? '💰' : isSuccess ? '🎉' : '📋'}</div>
              <div class="notification-content">
                <div class="notification-message">${escapeHtml(n.message)}</div>
                <div class="notification-time">${formatDate(n.created_at)}</div>
              </div>
            </div>
          `;
        }).join("");
      } catch (e) {
        list.innerHTML = `<div class="empty-state text-danger">${escapeHtml(e.message)}</div>`;
      }
    }
  };

  // ============================================
  // HOME PAGE
  // ============================================

  window.AppHome = {
    async init() {
      const auth = await checkAuth();
      if (auth.authenticated) {
        // Update buttons to show dashboard links
        const heroButtons = document.querySelector(".hero-buttons");
        if (heroButtons && auth.userType === "parent") {
          heroButtons.innerHTML = `<a class="btn btn-primary btn-lg" href="/parent.html">👨‍👩‍👧‍👦 Go to Dashboard</a>`;
        } else if (heroButtons && auth.userType === "child") {
          heroButtons.innerHTML = `<a class="btn btn-gold btn-lg" href="/child.html">⭐ Go to My Chores</a>`;
        }
      }

      const pingBtn = $("pingBtn");
      const pingOut = $("pingOut");
      if (pingBtn && pingOut) {
        pingBtn.onclick = async () => {
          setLoading(pingBtn, true);
          pingOut.textContent = "Connecting...";
          try {
            const res = await fetch("/api/ping");
            pingOut.textContent = await res.text();
            showToast("API connected!", "success");
          } catch (e) {
            pingOut.textContent = String(e);
          } finally {
            setLoading(pingBtn, false);
          }
        };
      }
    }
  };

  // Global helper
  window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied!", "success");
    }).catch(() => {
      showToast("Failed to copy", "error");
    });
  };
})();
