import { api, getApiBase } from '../api';
import { copyToClipboard, escapeHtml, emptyStateIcon, toast } from '../utils';
import type { SiteConfig, SiteStats } from '../types';
import { editSite } from './sites';

export async function renderOverview(el: HTMLElement): Promise<void> {
  // Show loading state
  el.innerHTML = `
    <div class="page-header">
      <h2>Overview</h2>
      <p>Dashboard summary and quick integration setup</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading...
    </div>
  `;

  try {
    const data = await api<{ sites: SiteConfig[] }>('/api/sites');
    const sites = data.sites || [];
    const base = getApiBase();

    el.innerHTML = `
      <div class="page-header">
        <h2>Overview</h2>
        <p>Dashboard summary and quick integration setup</p>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Registered Sites</div>
          <div class="value">${sites.length}</div>
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
        ${sites.length === 0
          ? `<div class="empty-state">
              ${emptyStateIcon('inbox')}
              <p>No sites registered yet</p>
              <p style="font-size:12px;color:var(--text-secondary)">Add a site to get started with WebClaw</p>
            </div>`
          : `<table class="table">
            <thead><tr><th>Site ID</th><th>Domain</th><th>Persona</th><th>Actions</th></tr></thead>
            <tbody>
              ${sites.map(s => `
                <tr>
                  <td><code>${escapeHtml(s.site_id)}</code></td>
                  <td>${escapeHtml(s.domain)}</td>
                  <td>${escapeHtml(s.persona_name)}</td>
                  <td><button class="btn btn-sm btn-outline" data-edit-site="${escapeHtml(s.site_id)}">Edit</button></td>
                </tr>
              `).join('')}
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
          <pre id="snippet">&lt;script src="${base}/embed.js"
        data-site-id="${sites[0]?.site_id ? escapeHtml(sites[0].site_id) : 'YOUR_SITE_ID'}"
        data-gateway="${base}"&gt;
&lt;/script&gt;</pre>
        </div>
      </div>
    `;

    // Bind events
    el.querySelectorAll<HTMLButtonElement>('[data-edit-site]').forEach(btn => {
      btn.addEventListener('click', () => editSite(btn.dataset.editSite!));
    });

    document.getElementById('copy-snippet-btn')?.addEventListener('click', () => {
      copyToClipboard(document.getElementById('snippet')!.textContent || '');
    });

    // Load stats
    if (sites.length > 0) {
      try {
        const stats = await api<{ stats: SiteStats }>(`/api/sites/${sites[0].site_id}/stats`);
        const s = stats.stats || {} as SiteStats;
        const set = (id: string, val: number | string) => {
          const el = document.getElementById(id);
          if (el) el.textContent = String(val || '0');
        };
        set('stat-sessions', s.sessions_total);
        set('stat-messages', s.messages_text);
        set('stat-actions', s.actions_executed);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }
  } catch (error) {
    console.error('Failed to load overview:', error);
    el.innerHTML = `
      <div class="page-header">
        <h2>Overview</h2>
        <p>Dashboard summary and quick integration setup</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${emptyStateIcon('inbox')}
          <p>Failed to load overview</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `;
  }
}
