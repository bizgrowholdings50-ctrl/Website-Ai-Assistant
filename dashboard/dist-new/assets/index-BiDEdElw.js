(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))a(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function o(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(n){if(n.ep)return;n.ep=!0;const s=o(n);fetch(n.href,s)}})();const L=window.location.origin;async function l(e,t={}){const o=await fetch(`${L}${e}`,{headers:{"Content-Type":"application/json"},method:t.method||"GET",body:t.body?JSON.stringify(t.body):void 0});if(!o.ok)throw new Error(`API error: ${o.status} ${o.statusText}`);return o.json()}function _(){return L}let k;function r(e,t="success"){const o=document.getElementById("toast");o.textContent=e,o.className=`toast toast-${t} show`,clearTimeout(k),k=setTimeout(()=>o.classList.remove("show"),3e3)}function F(e){navigator.clipboard.writeText(e).then(()=>r("Copied to clipboard"))}function d(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function I(e){return e<60?`${Math.round(e)}s`:`${Math.floor(e/60)}m ${Math.round(e%60)}s`}function p(e="inbox"){const t={inbox:'<svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-10a2 2 0 0 0-2-2z"/><path d="M2 8l10 7 10-7"/></svg>',document:'<svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',activity:'<svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 17"/><polyline points="17 6 23 6 23 12"/></svg>',settings:'<svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6m-17.78 7.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg>'};return t[e]||t.inbox}const E=["click","type","scroll","navigate","highlight","read","select","check"];let f=[];async function x(e){var t;e.innerHTML=`
    <div class="page-header">
      <h2>Sites</h2>
      <p>Manage registered sites and their configurations</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading...
    </div>
  `;try{f=(await l("/api/sites")).sites||[],e.innerHTML=`
      <div class="flex-between" style="margin-bottom:20px">
        <div>
          <h2>Sites</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">Manage registered sites and their configurations</p>
        </div>
        <button class="btn btn-primary" id="add-site-btn">+ Add Site</button>
      </div>
      <div id="sites-list">
        ${f.length===0?`<div class="card">
              <div class="empty-state">
                ${p("inbox")}
                <p>No sites registered yet</p>
                <p style="font-size:12px;color:var(--text-secondary)">Click "Add Site" to register your first website</p>
              </div>
            </div>`:f.map(a=>`
            <div class="card">
              <div class="flex-between">
                <h3>${d(a.persona_name)} <span class="badge badge-success">Active</span></h3>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-sm btn-outline" data-edit="${d(a.site_id)}">Edit</button>
                  ${a.site_id!=="demo"?`<button class="btn btn-sm btn-danger" data-delete="${d(a.site_id)}">Delete</button>`:""}
                </div>
              </div>
              <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">
                <strong>ID:</strong> <code>${d(a.site_id)}</code> &middot;
                <strong>Domain:</strong> ${d(a.domain)} &middot;
                <strong>Actions:</strong> ${(a.allowed_actions||[]).length} allowed
              </p>
            </div>
          `).join("")}
      </div>
      <div id="site-form" class="card hidden"></div>
    `,(t=document.getElementById("add-site-btn"))==null||t.addEventListener("click",()=>B()),e.querySelectorAll("[data-edit]").forEach(a=>a.addEventListener("click",()=>A(a.dataset.edit))),e.querySelectorAll("[data-delete]").forEach(a=>a.addEventListener("click",()=>D(a.dataset.delete)))}catch(o){console.error("Failed to load sites:",o),e.innerHTML=`
      <div class="page-header">
        <h2>Sites</h2>
        <p>Manage registered sites and their configurations</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${p("inbox")}
          <p>Failed to load sites</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `}}async function A(e){try{const t=await l(`/api/sites/${e}`);t.config&&(w("sites"),setTimeout(()=>B(t.config),50))}catch(t){console.error("Failed to load site:",t),r("Failed to load site","error")}}function B(e){var n,s;const t=document.getElementById("site-form");if(!t)return;t.classList.remove("hidden");const o=!!e,a=(e==null?void 0:e.allowed_actions)||E;t.innerHTML=`
    <h3>${o?"Edit Site":"Add New Site"}</h3>
    <div class="form-group">
      <label>Domain</label>
      <input id="f-domain" value="${d((e==null?void 0:e.domain)||"")}" placeholder="yoursite.com" />
    </div>
    <div class="form-group">
      <label>Persona Name</label>
      <input id="f-name" value="${d((e==null?void 0:e.persona_name)||"WebClaw")}" />
    </div>
    <div class="form-group">
      <label>Voice Style</label>
      <input id="f-voice" value="${d((e==null?void 0:e.persona_voice)||"friendly and helpful")}" placeholder="e.g., warm, professional, concise" />
    </div>
    <div class="form-group">
      <label>Welcome Message</label>
      <input id="f-welcome" value="${d((e==null?void 0:e.welcome_message)||"")}" />
    </div>
    <div class="form-group">
      <label>Knowledge Base</label>
      <textarea id="f-kb" placeholder="Add FAQs, product info, policies...">${d((e==null?void 0:e.knowledge_base)||"")}</textarea>
    </div>
    <div class="form-group">
      <label>Escalation Email</label>
      <input id="f-email" type="email" value="${d((e==null?void 0:e.escalation_email)||"")}" placeholder="support@yoursite.com" />
    </div>
    <div class="form-group">
      <label>Allowed Actions</label>
      <div class="action-checks">
        ${E.map(i=>`
          <label>
            <input type="checkbox" class="action-cb" value="${d(i)}" ${a.includes(i)?"checked":""} />
            ${d(i)}
          </label>
        `).join("")}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" id="save-site-btn">${o?"Update":"Create"}</button>
      <button class="btn btn-outline" id="cancel-site-btn">Cancel</button>
    </div>
  `,(n=document.getElementById("save-site-btn"))==null||n.addEventListener("click",()=>C(e==null?void 0:e.site_id)),(s=document.getElementById("cancel-site-btn"))==null||s.addEventListener("click",()=>t.classList.add("hidden")),t.scrollIntoView({behavior:"smooth"})}async function C(e){const t=document.getElementById("f-domain").value.trim(),o=document.getElementById("f-name").value.trim();if(!t){r("Please enter a domain","error"),document.getElementById("f-domain").focus();return}if(!o){r("Please enter a persona name","error"),document.getElementById("f-name").focus();return}try{const a={domain:t,persona_name:o,persona_voice:document.getElementById("f-voice").value.trim(),welcome_message:document.getElementById("f-welcome").value.trim(),knowledge_base:document.getElementById("f-kb").value.trim(),escalation_email:document.getElementById("f-email").value.trim(),allowed_actions:[...document.querySelectorAll(".action-cb:checked")].map(n=>n.value),restricted_actions:[...document.querySelectorAll(".action-cb:not(:checked)")].map(n=>n.value)};e?(await l(`/api/sites/${e}`,{method:"PUT",body:a}),r("Site updated")):(await l("/api/sites",{method:"POST",body:a}),r("Site created")),x(document.getElementById("main-content"))}catch(a){console.error("Failed to save site:",a),r("Failed to save site","error")}}async function D(e){if(confirm(`Delete site ${d(e)}? This cannot be undone.`))try{await l(`/api/sites/${e}`,{method:"DELETE"}),r("Site deleted"),x(document.getElementById("main-content"))}catch(t){console.error("Failed to delete site:",t),r("Failed to delete site","error")}}async function H(e){var t,o;e.innerHTML=`
    <div class="page-header">
      <h2>Overview</h2>
      <p>Dashboard summary and quick integration setup</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading...
    </div>
  `;try{const n=(await l("/api/sites")).sites||[],s=_();if(e.innerHTML=`
      <div class="page-header">
        <h2>Overview</h2>
        <p>Dashboard summary and quick integration setup</p>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Registered Sites</div>
          <div class="value">${n.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Sessions</div>
          <div class="value" id="stat-sessions">-</div>
        </div>
        <div class="stat-card">
          <div class="label">Messages</div>
          <div class="value" id="stat-messages">-</div>
        </div>
        <div class="stat-card">
          <div class="label">Actions Executed</div>
          <div class="value" id="stat-actions">-</div>
        </div>
      </div>

      <div class="card">
        <h3>Your Sites</h3>
        ${n.length===0?`<div class="empty-state">
              ${p("inbox")}
              <p>No sites registered yet</p>
              <p style="font-size:12px;color:var(--text-secondary)">Add a site to get started with WebClaw</p>
            </div>`:`<table class="table">
            <thead><tr><th>Site ID</th><th>Domain</th><th>Persona</th><th>Actions</th></tr></thead>
            <tbody>
              ${n.map(i=>`
                <tr>
                  <td><code>${d(i.site_id)}</code></td>
                  <td>${d(i.domain)}</td>
                  <td>${d(i.persona_name)}</td>
                  <td><button class="btn btn-sm btn-outline" data-edit-site="${d(i.site_id)}">Edit</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
      </div>

      <div class="card">
        <h3>Quick Integration</h3>
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px">
          Add this script tag to your website to enable WebClaw:
        </p>
        <div class="code-block">
          <button class="copy-btn" id="copy-snippet-btn">Copy</button>
          <pre id="snippet">&lt;script src="${s}/embed.js"
        data-site-id="${(t=n[0])!=null&&t.site_id?d(n[0].site_id):"YOUR_SITE_ID"}"
        data-gateway="${s}"&gt;
&lt;/script&gt;</pre>
        </div>
      </div>
    `,e.querySelectorAll("[data-edit-site]").forEach(i=>{i.addEventListener("click",()=>A(i.dataset.editSite))}),(o=document.getElementById("copy-snippet-btn"))==null||o.addEventListener("click",()=>{F(document.getElementById("snippet").textContent||"")}),n.length>0)try{const c=(await l(`/api/sites/${n[0].site_id}/stats`)).stats||{},b=(M,T)=>{const $=document.getElementById(M);$&&($.textContent=String(T||"0"))};b("stat-sessions",c.sessions_total),b("stat-messages",c.messages_text),b("stat-actions",c.actions_executed)}catch(i){console.error("Failed to load stats:",i)}}catch(a){console.error("Failed to load overview:",a),e.innerHTML=`
      <div class="page-header">
        <h2>Overview</h2>
        <p>Dashboard summary and quick integration setup</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${p("inbox")}
          <p>Failed to load overview</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `}}let g=[],v="";async function y(e){var t,o;e.innerHTML=`
    <div class="page-header">
      <h2>Knowledge Base</h2>
      <p>Manage FAQs, product information, and policies</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading...
    </div>
  `;try{if(g=(await l("/api/sites")).sites||[],g.length===0){e.innerHTML=`
        <div class="page-header">
          <h2>Knowledge Base</h2>
          <p>Manage FAQs, product information, and policies</p>
        </div>
        <div class="card">
          <div class="empty-state">
            ${p("document")}
            <p>No sites registered yet</p>
            <p style="font-size:12px;color:var(--text-secondary)">Register a site first to add knowledge documents</p>
          </div>
        </div>
      `;return}v=v||g[0].site_id;const s=(await l(`/api/sites/${v}/knowledge`)).documents||[];e.innerHTML=`
      <div class="flex-between" style="margin-bottom:20px">
        <div>
          <h2>Knowledge Base</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">Manage FAQs, product information, and policies</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="kb-site" class="select-inline">
            ${g.map(i=>`<option value="${d(i.site_id)}" ${i.site_id===v?"selected":""}>${d(i.persona_name)} (${d(i.domain)})</option>`).join("")}
          </select>
          <button class="btn btn-primary btn-sm" id="add-kb-btn">+ Add Document</button>
        </div>
      </div>

      <div id="kb-docs">
        ${s.length===0?`<div class="card">
              <div class="empty-state">
                ${p("document")}
                <p>No knowledge documents yet</p>
                <p style="font-size:12px;color:var(--text-secondary)">Add FAQs, product info, or policies to help your AI assistant</p>
              </div>
            </div>`:s.map(i=>`
            <div class="card">
              <div class="flex-between">
                <h3>${d(i.title||"Untitled")}</h3>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-sm btn-outline" data-edit-kb="${d(i.id)}" data-title="${encodeURIComponent(i.title||"")}" data-content="${encodeURIComponent(i.content||"")}">Edit</button>
                  <button class="btn btn-sm btn-danger" data-delete-kb="${d(i.id)}">Delete</button>
                </div>
              </div>
              <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;white-space:pre-wrap">${d((i.content||"").substring(0,300))}${(i.content||"").length>300?"...":""}</p>
            </div>
          `).join("")}
      </div>
      <div id="kb-form" class="card hidden"></div>
    `,(t=document.getElementById("kb-site"))==null||t.addEventListener("change",i=>{v=i.target.value,y(e)}),(o=document.getElementById("add-kb-btn"))==null||o.addEventListener("click",()=>S()),e.querySelectorAll("[data-edit-kb]").forEach(i=>i.addEventListener("click",()=>S(i.dataset.editKb,decodeURIComponent(i.dataset.title||""),decodeURIComponent(i.dataset.content||"")))),e.querySelectorAll("[data-delete-kb]").forEach(i=>i.addEventListener("click",()=>N(i.dataset.deleteKb)))}catch(a){console.error("Failed to load knowledge base:",a),e.innerHTML=`
      <div class="page-header">
        <h2>Knowledge Base</h2>
        <p>Manage FAQs, product information, and policies</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${p("document")}
          <p>Failed to load knowledge base</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `}}function S(e="",t="",o=""){var n,s;const a=document.getElementById("kb-form");a&&(a.classList.remove("hidden"),a.innerHTML=`
    <h3>${e?"Edit Document":"Add Document"}</h3>
    <div class="form-group">
      <label>Title</label>
      <input id="kb-title" value="${d(t)}" placeholder="e.g., Shipping Policy" />
    </div>
    <div class="form-group">
      <label>Content</label>
      <textarea id="kb-content" style="min-height:200px" placeholder="Write your FAQ, policy, or product information here...">${d(o)}</textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" id="save-kb-btn">${e?"Update":"Create"}</button>
      <button class="btn btn-outline" id="cancel-kb-btn">Cancel</button>
    </div>
  `,(n=document.getElementById("save-kb-btn"))==null||n.addEventListener("click",()=>P(e)),(s=document.getElementById("cancel-kb-btn"))==null||s.addEventListener("click",()=>a.classList.add("hidden")),a.scrollIntoView({behavior:"smooth"}))}async function P(e){const t=document.getElementById("kb-title").value.trim(),o=document.getElementById("kb-content").value.trim();if(!t){r("Please enter a title","error"),document.getElementById("kb-title").focus();return}if(!o){r("Please enter some content","error"),document.getElementById("kb-content").focus();return}try{const a={title:t,content:o};e?(await l(`/api/sites/${v}/knowledge/${e}`,{method:"PUT",body:a}),r("Document updated")):(await l(`/api/sites/${v}/knowledge`,{method:"POST",body:a}),r("Document added")),y(document.getElementById("main-content"))}catch(a){console.error("Failed to save document:",a),r("Failed to save document","error")}}async function N(e){if(confirm("Delete this document?"))try{await l(`/api/sites/${v}/knowledge/${e}`,{method:"DELETE"}),r("Document deleted"),y(document.getElementById("main-content"))}catch(t){console.error("Failed to delete document:",t),r("Failed to delete document","error")}}let h=[],m="";async function u(e){var t;e.innerHTML=`
    <div class="page-header">
      <h2>Sessions</h2>
      <p>View and analyze visitor interactions</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading...
    </div>
  `;try{if(h=(await l("/api/sites")).sites||[],h.length===0){e.innerHTML=`
        <div class="page-header">
          <h2>Sessions</h2>
          <p>View and analyze visitor interactions</p>
        </div>
        <div class="card">
          <div class="empty-state">
            ${p("activity")}
            <p>No sites registered yet</p>
            <p style="font-size:12px;color:var(--text-secondary)">Register a site first to view visitor sessions</p>
          </div>
        </div>
      `;return}m=m||h[0].site_id;const n=(await l(`/api/sites/${m}/sessions?limit=20`)).sessions||[];e.innerHTML=`
      <div class="flex-between" style="margin-bottom:20px">
        <div>
          <h2>Sessions</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">View and analyze visitor interactions</p>
        </div>
        <select id="sess-site" class="select-inline">
          ${h.map(s=>`<option value="${d(s.site_id)}" ${s.site_id===m?"selected":""}>${d(s.persona_name)} (${d(s.domain)})</option>`).join("")}
        </select>
      </div>

      ${n.length===0?`<div class="card">
            <div class="empty-state">
              ${p("activity")}
              <p>No sessions recorded yet</p>
              <p style="font-size:12px;color:var(--text-secondary)">Sessions are saved when visitors interact via WebClaw</p>
            </div>
          </div>`:`<table class="table">
          <thead><tr><th>Session</th><th>User</th><th>Messages</th><th>Duration</th><th>Last Active</th></tr></thead>
          <tbody>
            ${n.map(s=>{var i,c;return`
              <tr style="cursor:pointer" data-view-session="${d(s.session_id||"")}">
                <td><code>${d((s.session_id||s.user_id||"-").substring(0,12))}</code></td>
                <td>${d(s.user_id||"-")}</td>
                <td>${((i=s.metadata)==null?void 0:i.message_count)||(s.messages||[]).length||"-"}</td>
                <td>${(c=s.metadata)!=null&&c.duration_seconds?I(s.metadata.duration_seconds):"-"}</td>
                <td>${s.updated_at?new Date(s.updated_at*1e3).toLocaleString():"-"}</td>
              </tr>
            `}).join("")}
          </tbody>
        </table>`}
    `,(t=document.getElementById("sess-site"))==null||t.addEventListener("change",s=>{m=s.target.value,u(e)}),e.querySelectorAll("[data-view-session]").forEach(s=>s.addEventListener("click",()=>O(e,s.dataset.viewSession)))}catch(o){console.error("Failed to load sessions:",o),e.innerHTML=`
      <div class="page-header">
        <h2>Sessions</h2>
        <p>View and analyze visitor interactions</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${p("activity")}
          <p>Failed to load sessions</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `}}async function O(e,t){var o,a;if(t){e.innerHTML=`
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading session...
    </div>
  `;try{const s=(await l(`/api/sites/${m}/sessions/${t}`)).session;if(!s){r("Session not found","error"),u(e);return}e.innerHTML=`
      <div style="margin-bottom:16px">
        <button class="btn btn-outline btn-sm" id="back-to-sessions">← Back to Sessions</button>
      </div>
      <div class="card">
        <h2>Session Details</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Session ID</div>
            <code style="font-size:13px">${d(t.substring(0,20))}</code>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">User ID</div>
            <p style="font-size:13px;color:var(--text)">${d(s.user_id||"Anonymous")}</p>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Duration</div>
            <p style="font-size:13px;color:var(--text)">${(o=s.metadata)!=null&&o.duration_seconds?I(s.metadata.duration_seconds):"unknown"}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Conversation (${(s.messages||[]).length} messages)</h3>
        <div style="max-height:600px;overflow-y:auto">
          ${(s.messages||[]).length===0?'<p style="color:var(--text-secondary);text-align:center;padding:20px">No messages in this session</p>':(s.messages||[]).map(i=>`
            <div class="chat-bubble ${i.role==="user"?"chat-bubble-user":"chat-bubble-agent"}">
              <div class="chat-bubble-meta">${d(i.role)} &middot; ${d(i.type)} &middot; ${new Date(i.ts*1e3).toLocaleTimeString()}</div>
              <div class="chat-bubble-text">${d(i.text||"")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `,(a=document.getElementById("back-to-sessions"))==null||a.addEventListener("click",()=>u(e))}catch(n){console.error("Failed to load session:",n),r("Failed to load session","error"),u(e)}}}async function z(e){var t;e.innerHTML=`
    <div class="page-header">
      <h2>Settings</h2>
      <p>System configuration and status</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading settings...
    </div>
  `;try{const o=_();let a="checking...",n="#64748b",s="v0.2.0",i="unknown";try{const c=await l("/api/health");a=c.status==="ok"?"Healthy":"Degraded",n=c.status==="ok"?"#059669":"#d97706",c.version&&(s=`v${c.version}`),i=c.firestore||"unknown"}catch{a="Unreachable",n="#dc2626"}e.innerHTML=`
      <div class="page-header">
        <h2>Settings</h2>
        <p>System configuration and status</p>
      </div>

      <div class="card">
        <h3>Gateway Configuration</h3>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:16px">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">API Base URL</div>
            <code style="font-size:13px;word-break:break-all">${d(o)}</code>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Environment</div>
            <p style="font-size:13px;color:var(--text)">${o.includes("localhost")?"Development":"Production"}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>API Health</h3>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px">
          <div style="width:12px;height:12px;border-radius:50%;background:${n}"></div>
          <span style="font-size:14px;color:var(--text)">${d(a)}</span>
          <button class="btn btn-sm btn-outline" id="refresh-health">Refresh</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px">
          ${a==="Healthy"?"Gateway is operational. All systems functioning normally.":a==="Unreachable"?"Cannot reach the gateway. Make sure the server is running.":"Gateway is experiencing issues. Check the server logs."}
        </p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">
          Firestore: <span class="badge ${i==="connected"?"badge-success":"badge-warning"}">${d(i)}</span>
          ${i!=="connected"?" (using in-memory storage)":""}
        </p>
      </div>

      <div class="card">
        <h3>Version Information</h3>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:16px">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Dashboard</div>
            <p style="font-size:13px;color:var(--text)">v0.2.0</p>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Gateway</div>
            <p style="font-size:13px;color:var(--text)">${d(s)}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Quick Start</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Steps to get your site agent running:</p>
        <ol style="font-size:13px;color:var(--text);padding-left:20px;line-height:2">
          <li>Register your site in the <strong>Sites</strong> tab with your domain</li>
          <li>Set a welcome message and persona voice style</li>
          <li>Add knowledge documents in the <strong>Knowledge Base</strong> tab</li>
          <li>Copy the embed snippet from <strong>Overview</strong> and add it to your site</li>
          <li>Start the gateway server and test!</li>
        </ol>
      </div>

      <div class="card">
        <h3>Support & Documentation</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Resources:</p>
        <ul style="font-size:13px;color:var(--primary);list-style:none;padding:0">
          <li style="margin-bottom:6px"><a href="https://github.com/nicholasgriffintn/webclaw" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">GitHub Repository</a></li>
          <li style="margin-bottom:6px"><a href="https://github.com/nicholasgriffintn/webclaw/issues" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">Report an Issue</a></li>
          <li><a href="${d(o)}/health" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">API Health Endpoint</a></li>
        </ul>
      </div>
    `,(t=document.getElementById("refresh-health"))==null||t.addEventListener("click",()=>z(e))}catch(o){console.error("Failed to load settings:",o),e.innerHTML=`
      <div class="page-header">
        <h2>Settings</h2>
        <p>System configuration and status</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${p("settings")}
          <p>Failed to load settings</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `}}const q={overview:H,sites:x,knowledge:y,sessions:u,settings:z};function w(e){var o;document.querySelectorAll(".nav-item").forEach(a=>a.classList.remove("active")),(o=document.querySelector(`[data-page="${e}"]`))==null||o.classList.add("active");const t=document.getElementById("main-content");q[e](t)}document.querySelectorAll(".nav-item").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.page;t&&w(t)})});w("overview");
