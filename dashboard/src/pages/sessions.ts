import { api } from '../api';
import { toast, formatDuration, escapeHtml, emptyStateIcon } from '../utils';
import type { SiteConfig, SessionRecord } from '../types';

let sites: SiteConfig[] = [];
let activeSiteId: string = '';

export async function renderSessions(el: HTMLElement): Promise<void> {
  // Show loading state
  el.innerHTML = `
    <div class="page-header">
      <h2>Sessions</h2>
      <p>View and analyze visitor interactions</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading...
    </div>
  `;

  try {
    const data = await api<{ sites: SiteConfig[] }>('/api/sites');
    sites = data.sites || [];

    if (sites.length === 0) {
      el.innerHTML = `
        <div class="page-header">
          <h2>Sessions</h2>
          <p>View and analyze visitor interactions</p>
        </div>
        <div class="card">
          <div class="empty-state">
            ${emptyStateIcon('activity')}
            <p>No sites registered yet</p>
            <p style="font-size:12px;color:var(--text-secondary)">Register a site first to view visitor sessions</p>
          </div>
        </div>
      `;
      return;
    }

    activeSiteId = activeSiteId || sites[0].site_id;
    const sessions = await api<{ sessions: SessionRecord[] }>(`/api/sites/${activeSiteId}/sessions?limit=20`);
    const list = sessions.sessions || [];

    el.innerHTML = `
      <div class="flex-between" style="margin-bottom:20px">
        <div>
          <h2>Sessions</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">View and analyze visitor interactions</p>
        </div>
        <select id="sess-site" class="select-inline">
          ${sites.map(s => `<option value="${escapeHtml(s.site_id)}" ${s.site_id === activeSiteId ? 'selected' : ''}>${escapeHtml(s.persona_name)} (${escapeHtml(s.domain)})</option>`).join('')}
        </select>
      </div>

      ${list.length === 0
        ? `<div class="card">
            <div class="empty-state">
              ${emptyStateIcon('activity')}
              <p>No sessions recorded yet</p>
              <p style="font-size:12px;color:var(--text-secondary)">Sessions are saved when visitors interact via WebClaw</p>
            </div>
          </div>`
        : `<table class="table">
          <thead><tr><th>Session</th><th>User</th><th>Messages</th><th>Duration</th><th>Last Active</th></tr></thead>
          <tbody>
            ${list.map(s => `
              <tr style="cursor:pointer" data-view-session="${escapeHtml(s.session_id || '')}">
                <td><code>${escapeHtml((s.session_id || s.user_id || '-').substring(0, 12))}</code></td>
                <td>${escapeHtml(s.user_id || '-')}</td>
                <td>${s.metadata?.message_count || (s.messages || []).length || '-'}</td>
                <td>${s.metadata?.duration_seconds ? formatDuration(s.metadata.duration_seconds) : '-'}</td>
                <td>${s.updated_at ? new Date(s.updated_at * 1000).toLocaleString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
    `;

    document.getElementById('sess-site')?.addEventListener('change', (e) => {
      activeSiteId = (e.target as HTMLSelectElement).value;
      renderSessions(el);
    });
    el.querySelectorAll<HTMLTableRowElement>('[data-view-session]').forEach(row =>
      row.addEventListener('click', () => viewSession(el, row.dataset.viewSession!))
    );
  } catch (error) {
    console.error('Failed to load sessions:', error);
    el.innerHTML = `
      <div class="page-header">
        <h2>Sessions</h2>
        <p>View and analyze visitor interactions</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${emptyStateIcon('activity')}
          <p>Failed to load sessions</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `;
  }
}

async function viewSession(el: HTMLElement, sessionId: string): Promise<void> {
  if (!sessionId) return;

  // Show loading state
  el.innerHTML = `
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading session...
    </div>
  `;

  try {
    const data = await api<{ session: SessionRecord }>(`/api/sites/${activeSiteId}/sessions/${sessionId}`);
    const session = data.session;
    if (!session) {
      toast('Session not found', 'error');
      renderSessions(el);
      return;
    }

    el.innerHTML = `
      <div style="margin-bottom:16px">
        <button class="btn btn-outline btn-sm" id="back-to-sessions">← Back to Sessions</button>
      </div>
      <div class="card">
        <h2>Session Details</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Session ID</div>
            <code style="font-size:13px">${escapeHtml(sessionId.substring(0, 20))}</code>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">User ID</div>
            <p style="font-size:13px;color:var(--text)">${escapeHtml(session.user_id || 'Anonymous')}</p>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Duration</div>
            <p style="font-size:13px;color:var(--text)">${session.metadata?.duration_seconds ? formatDuration(session.metadata.duration_seconds) : 'unknown'}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Conversation (${(session.messages || []).length} messages)</h3>
        <div style="max-height:600px;overflow-y:auto">
          ${(session.messages || []).length === 0
            ? '<p style="color:var(--text-secondary);text-align:center;padding:20px">No messages in this session</p>'
            : (session.messages || []).map(m => `
            <div class="chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-agent'}">
              <div class="chat-bubble-meta">${escapeHtml(m.role)} &middot; ${escapeHtml(m.type)} &middot; ${new Date(m.ts * 1000).toLocaleTimeString()}</div>
              <div class="chat-bubble-text">${escapeHtml(m.text || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('back-to-sessions')?.addEventListener('click', () => renderSessions(el));
  } catch (error) {
    console.error('Failed to load session:', error);
    toast('Failed to load session', 'error');
    renderSessions(el);
  }
}
