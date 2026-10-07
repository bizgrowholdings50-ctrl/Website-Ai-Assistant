(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))a(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const t of s.addedNodes)t.tagName==="LINK"&&t.rel==="modulepreload"&&a(t)}).observe(document,{childList:!0,subtree:!0});function d(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(n){if(n.ep)return;n.ep=!0;const s=d(n);fetch(n.href,s)}})();const k=window.location.origin;async function o(e,i={}){return(await fetch(`${k}${e}`,{headers:{"Content-Type":"application/json"},method:i.method||"GET",body:i.body?JSON.stringify(i.body):void 0})).json()}function x(){return k}let f;function c(e,i="success"){const d=document.getElementById("toast");d.textContent=e,d.className=`toast toast-${i} show`,clearTimeout(f),f=setTimeout(()=>d.classList.remove("show"),3e3)}function T(e){navigator.clipboard.writeText(e).then(()=>c("Copied to clipboard"))}function _(e){return e<60?`${Math.round(e)}s`:`${Math.floor(e/60)}m ${Math.round(e%60)}s`}const w=["click","type","scroll","navigate","highlight","read","select","check"];let E=[];async function h(e){var d;E=(await o("/api/sites")).sites||[],e.innerHTML=`
    <div class="flex-between">
      <h2>Sites</h2>
      <button class="btn btn-primary" id="add-site-btn">+ Add Site</button>
    </div>
    <div id="sites-list">
      ${E.map(a=>`
        <div class="card">
          <div class="flex-between">
            <h3>${a.persona_name} <span class="badge badge-success">Active</span></h3>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm btn-outline" data-edit="${a.site_id}">Edit</button>
              ${a.site_id!=="demo"?`<button class="btn btn-sm btn-danger" data-delete="${a.site_id}">Delete</button>`:""}
            </div>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">
            <strong>ID:</strong> <code>${a.site_id}</code> &middot;
            <strong>Domain:</strong> ${a.domain} &middot;
            <strong>Actions:</strong> ${(a.allowed_actions||[]).length} allowed
          </p>
        </div>
      `).join("")}
    </div>
    <div id="site-form" class="card hidden"></div>
  `,(d=document.getElementById("add-site-btn"))==null||d.addEventListener("click",()=>I()),e.querySelectorAll("[data-edit]").forEach(a=>a.addEventListener("click",()=>L(a.dataset.edit))),e.querySelectorAll("[data-delete]").forEach(a=>a.addEventListener("click",()=>C(a.dataset.delete)))}async function L(e){const i=await o(`/api/sites/${e}`);i.config&&(g("sites"),setTimeout(()=>I(i.config),50))}function I(e){var n,s;const i=document.getElementById("site-form");if(!i)return;i.classList.remove("hidden");const d=!!e,a=(e==null?void 0:e.allowed_actions)||w;i.innerHTML=`
    <h3>${d?"Edit Site":"Add New Site"}</h3>
    <div class="form-group">
      <label>Domain</label>
      <input id="f-domain" value="${(e==null?void 0:e.domain)||""}" placeholder="yoursite.com" />
    </div>
    <div class="form-group">
      <label>Persona Name</label>
      <input id="f-name" value="${(e==null?void 0:e.persona_name)||"WebClaw"}" />
    </div>
    <div class="form-group">
      <label>Voice Style</label>
      <input id="f-voice" value="${(e==null?void 0:e.persona_voice)||"friendly and helpful"}" placeholder="e.g., warm, professional, concise" />
    </div>
    <div class="form-group">
      <label>Welcome Message</label>
      <input id="f-welcome" value="${(e==null?void 0:e.welcome_message)||""}" />
    </div>
    <div class="form-group">
      <label>Knowledge Base</label>
      <textarea id="f-kb" placeholder="Add FAQs, product info, policies...">${(e==null?void 0:e.knowledge_base)||""}</textarea>
    </div>
    <div class="form-group">
      <label>Escalation Email</label>
      <input id="f-email" type="email" value="${(e==null?void 0:e.escalation_email)||""}" placeholder="support@yoursite.com" />
    </div>
    <div class="form-group">
      <label>Allowed Actions</label>
      <div class="action-checks">
        ${w.map(t=>`
          <label>
            <input type="checkbox" class="action-cb" value="${t}" ${a.includes(t)?"checked":""} />
            ${t}
          </label>
        `).join("")}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" id="save-site-btn">${d?"Update":"Create"}</button>
      <button class="btn btn-outline" id="cancel-site-btn">Cancel</button>
    </div>
  `,(n=document.getElementById("save-site-btn"))==null||n.addEventListener("click",()=>D(e==null?void 0:e.site_id)),(s=document.getElementById("cancel-site-btn"))==null||s.addEventListener("click",()=>i.classList.add("hidden")),i.scrollIntoView({behavior:"smooth"})}async function D(e){const i={domain:document.getElementById("f-domain").value,persona_name:document.getElementById("f-name").value,persona_voice:document.getElementById("f-voice").value,welcome_message:document.getElementById("f-welcome").value,knowledge_base:document.getElementById("f-kb").value,escalation_email:document.getElementById("f-email").value,allowed_actions:[...document.querySelectorAll(".action-cb:checked")].map(d=>d.value),restricted_actions:[...document.querySelectorAll(".action-cb:not(:checked)")].map(d=>d.value)};e?(await o(`/api/sites/${e}`,{method:"PUT",body:i}),c("Site updated")):(await o("/api/sites",{method:"POST",body:i}),c("Site created")),h(document.getElementById("main-content"))}async function C(e){confirm(`Delete site ${e}? This cannot be undone.`)&&(await o(`/api/sites/${e}`,{method:"DELETE"}),c("Site deleted"),h(document.getElementById("main-content")))}async function M(e){var n,s;const d=(await o("/api/sites")).sites||[],a=x();if(e.innerHTML=`
    <h2>Overview</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="value">${d.length}</div>
        <div class="label">Registered Sites</div>
      </div>
      <div class="stat-card">
        <div class="value" id="stat-sessions">-</div>
        <div class="label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="value" id="stat-messages">-</div>
        <div class="label">Messages</div>
      </div>
      <div class="stat-card">
        <div class="value" id="stat-actions">-</div>
        <div class="label">Actions Executed</div>
      </div>
    </div>

    <div class="card">
      <h3>Your Sites</h3>
      ${d.length===0?'<p style="color:var(--text-secondary)">No sites registered yet. Go to Sites to add one.</p>':`<table class="table">
          <thead><tr><th>Site ID</th><th>Domain</th><th>Persona</th><th>Actions</th></tr></thead>
          <tbody>
            ${d.map(t=>`
              <tr>
                <td><code>${t.site_id}</code></td>
                <td>${t.domain}</td>
                <td>${t.persona_name}</td>
                <td><button class="btn btn-sm btn-outline" data-edit-site="${t.site_id}">Edit</button></td>
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
        <pre id="snippet">&lt;script src="${a}/embed.js"
        data-site-id="${((n=d[0])==null?void 0:n.site_id)||"YOUR_SITE_ID"}"
        data-gateway="${a}"&gt;
&lt;/script&gt;</pre>
      </div>
    </div>
  `,e.querySelectorAll("[data-edit-site]").forEach(t=>{t.addEventListener("click",()=>L(t.dataset.editSite))}),(s=document.getElementById("copy-snippet-btn"))==null||s.addEventListener("click",()=>{T(document.getElementById("snippet").textContent||"")}),d.length>0){const r=(await o(`/api/sites/${d[0].site_id}/stats`)).stats||{},b=(B,A)=>{const $=document.getElementById(B);$&&($.textContent=String(A||"0"))};b("stat-sessions",r.sessions_total),b("stat-messages",r.messages_text),b("stat-actions",r.actions_executed)}}let m=[],l="";async function p(e){var n,s;if(m=(await o("/api/sites")).sites||[],m.length===0){e.innerHTML="<h2>Knowledge Base</h2><p>Register a site first.</p>";return}l=l||m[0].site_id;const a=(await o(`/api/sites/${l}/knowledge`)).documents||[];e.innerHTML=`
    <div class="flex-between">
      <h2>Knowledge Base</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="kb-site" class="select-inline">
          ${m.map(t=>`<option value="${t.site_id}" ${t.site_id===l?"selected":""}>${t.persona_name} (${t.domain})</option>`).join("")}
        </select>
        <button class="btn btn-primary btn-sm" id="add-kb-btn">+ Add Document</button>
      </div>
    </div>

    <div id="kb-docs">
      ${a.length===0?'<div class="card"><p style="color:var(--text-secondary)">No knowledge base documents yet. Add FAQs, product info, or policies.</p></div>':a.map(t=>`
          <div class="card">
            <div class="flex-between">
              <h3>${t.title||"Untitled"}</h3>
              <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-outline" data-edit-kb="${t.id}" data-title="${encodeURIComponent(t.title||"")}" data-content="${encodeURIComponent(t.content||"")}">Edit</button>
                <button class="btn btn-sm btn-danger" data-delete-kb="${t.id}">Delete</button>
              </div>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;white-space:pre-wrap">${(t.content||"").substring(0,300)}${(t.content||"").length>300?"...":""}</p>
          </div>
        `).join("")}
    </div>
    <div id="kb-form" class="card hidden"></div>
  `,(n=document.getElementById("kb-site"))==null||n.addEventListener("change",t=>{l=t.target.value,p(e)}),(s=document.getElementById("add-kb-btn"))==null||s.addEventListener("click",()=>S()),e.querySelectorAll("[data-edit-kb]").forEach(t=>t.addEventListener("click",()=>S(t.dataset.editKb,decodeURIComponent(t.dataset.title||""),decodeURIComponent(t.dataset.content||"")))),e.querySelectorAll("[data-delete-kb]").forEach(t=>t.addEventListener("click",()=>q(t.dataset.deleteKb)))}function S(e="",i="",d=""){var n,s;const a=document.getElementById("kb-form");a&&(a.classList.remove("hidden"),a.innerHTML=`
    <h3>${e?"Edit Document":"Add Document"}</h3>
    <div class="form-group">
      <label>Title</label>
      <input id="kb-title" value="${i}" placeholder="e.g., Shipping Policy" />
    </div>
    <div class="form-group">
      <label>Content</label>
      <textarea id="kb-content" style="min-height:200px" placeholder="Write your FAQ, policy, or product information here...">${d}</textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" id="save-kb-btn">${e?"Update":"Create"}</button>
      <button class="btn btn-outline" id="cancel-kb-btn">Cancel</button>
    </div>
  `,(n=document.getElementById("save-kb-btn"))==null||n.addEventListener("click",()=>O(e)),(s=document.getElementById("cancel-kb-btn"))==null||s.addEventListener("click",()=>a.classList.add("hidden")),a.scrollIntoView({behavior:"smooth"}))}async function O(e){const i={title:document.getElementById("kb-title").value,content:document.getElementById("kb-content").value};e?(await o(`/api/sites/${l}/knowledge/${e}`,{method:"PUT",body:i}),c("Document updated")):(await o(`/api/sites/${l}/knowledge`,{method:"POST",body:i}),c("Document added")),p(document.getElementById("main-content"))}async function q(e){confirm("Delete this document?")&&(await o(`/api/sites/${l}/knowledge/${e}`,{method:"DELETE"}),c("Document deleted"),p(document.getElementById("main-content")))}let v=[],u="";async function y(e){var n;if(v=(await o("/api/sites")).sites||[],v.length===0){e.innerHTML="<h2>Sessions</h2><p>Register a site first.</p>";return}u=u||v[0].site_id;const a=(await o(`/api/sites/${u}/sessions?limit=20`)).sessions||[];e.innerHTML=`
    <div class="flex-between">
      <h2>Sessions</h2>
      <select id="sess-site" class="select-inline">
        ${v.map(s=>`<option value="${s.site_id}" ${s.site_id===u?"selected":""}>${s.persona_name} (${s.domain})</option>`).join("")}
      </select>
    </div>

    ${a.length===0?'<div class="card"><p style="color:var(--text-secondary)">No sessions recorded yet. Sessions are saved when visitors interact via WebClaw.</p></div>':`<table class="table">
        <thead><tr><th>Session</th><th>User</th><th>Messages</th><th>Duration</th><th>Last Active</th></tr></thead>
        <tbody>
          ${a.map(s=>{var t,r;return`
            <tr style="cursor:pointer" data-view-session="${s.session_id||""}">
              <td><code>${(s.session_id||s.user_id||"-").substring(0,12)}...</code></td>
              <td>${s.user_id||"-"}</td>
              <td>${((t=s.metadata)==null?void 0:t.message_count)||(s.messages||[]).length||"-"}</td>
              <td>${(r=s.metadata)!=null&&r.duration_seconds?_(s.metadata.duration_seconds):"-"}</td>
              <td>${s.updated_at?new Date(s.updated_at*1e3).toLocaleString():"-"}</td>
            </tr>
          `}).join("")}
        </tbody>
      </table>`}
  `,(n=document.getElementById("sess-site"))==null||n.addEventListener("change",s=>{u=s.target.value,y(e)}),e.querySelectorAll("[data-view-session]").forEach(s=>s.addEventListener("click",()=>P(e,s.dataset.viewSession)))}async function P(e,i){var n,s;if(!i)return;const a=(await o(`/api/sites/${u}/sessions/${i}`)).session;if(!a){c("Session not found","error");return}e.innerHTML=`
    <div style="margin-bottom:16px">
      <button class="btn btn-outline btn-sm" id="back-to-sessions">← Back</button>
    </div>
    <h2>Session: ${i.substring(0,16)}...</h2>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      Duration: ${(n=a.metadata)!=null&&n.duration_seconds?_(a.metadata.duration_seconds):"unknown"} &middot;
      Messages: ${(a.messages||[]).length}
    </p>
    <div class="card">
      ${(a.messages||[]).map(t=>`
        <div class="chat-bubble ${t.role==="user"?"chat-bubble-user":"chat-bubble-agent"}">
          <div class="chat-bubble-meta">${t.role} &middot; ${t.type} &middot; ${new Date(t.ts*1e3).toLocaleTimeString()}</div>
          <div class="chat-bubble-text">${t.text||""}</div>
        </div>
      `).join("")}
    </div>
  `,(s=document.getElementById("back-to-sessions"))==null||s.addEventListener("click",()=>y(e))}function j(e){e.innerHTML=`
    <h2>Settings</h2>
    <div class="card">
      <h3>Gateway</h3>
      <p style="font-size:14px;color:var(--text-secondary)">Connected to: <code>${x()}</code></p>
    </div>
    <div class="card">
      <h3>Version</h3>
      <p style="font-size:14px;color:var(--text-secondary)">WebClaw Gateway v0.2.0</p>
    </div>
  `}const N={overview:M,sites:h,knowledge:p,sessions:y,settings:j};function g(e){var d;document.querySelectorAll(".nav-item").forEach(a=>a.classList.remove("active")),(d=document.querySelector(`[data-page="${e}"]`))==null||d.classList.add("active");const i=document.getElementById("main-content");N[e](i)}document.querySelectorAll(".nav-item").forEach(e=>{e.addEventListener("click",()=>{const i=e.dataset.page;i&&g(i)})});g("overview");
