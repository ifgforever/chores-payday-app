(function () {
  function qs(id) { return document.getElementById(id); }
  function jpre(el, obj) { el.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2); }

  function token() { return localStorage.getItem("ADMIN_TOKEN") || ""; }
  function setToken(v){ localStorage.setItem("ADMIN_TOKEN", v); }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "content-type": "application/json" }, opts.headers || {});
    if (path.startsWith("/api/parent/")) headers["authorization"] = "Bearer " + token();
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!r.ok) throw new Error((data && data.error) ? data.error : ("HTTP " + r.status));
    return data;
  }

  window.AppParent = {
    async init() {
      const debugOut = qs("debugOut");
      const tokenInput = qs("adminToken");
      tokenInput.value = token();
      qs("saveToken").onclick = () => { setToken(tokenInput.value.trim()); jpre(debugOut, { ok: true, saved: true }); };

      qs("addChild").onclick = async () => {
        try {
          const name = qs("childName").value.trim();
          const data = await api("/api/parent/children", { method: "POST", body: JSON.stringify({ name }) });
          qs("childName").value = "";
          jpre(debugOut, data);
        } catch (e) { jpre(debugOut, String(e)); }
      };

      qs("addChore").onclick = async () => {
        try {
          const title = qs("choreTitle").value.trim();
          const points = Number(qs("chorePoints").value || 0);
          const is_required = qs("choreRequired").checked;
          const data = await api("/api/parent/chores", { method: "POST", body: JSON.stringify({ title, points, is_required }) });
          qs("choreTitle").value = "";
          qs("chorePoints").value = "";
          qs("choreRequired").checked = false;
          jpre(debugOut, data);
        } catch (e) { jpre(debugOut, String(e)); }
      };
    }
  };

  window.AppChild = {
    async init() {
      const dbg = qs("childDebug");
      qs("saveChildId").onclick = () => {
        localStorage.setItem("CHILD_ID", qs("childId").value.trim());
        jpre(dbg, { ok: true, saved: true, child_id: localStorage.getItem("CHILD_ID") });
      };
      qs("refreshChild").onclick = async () => {
        try {
          const cid = localStorage.getItem("CHILD_ID") || "";
          const data = await api("/api/child/chores?child_id=" + encodeURIComponent(cid));
          jpre(dbg, data);
        } catch (e) { jpre(dbg, String(e)); }
      };
    }
  };
})();