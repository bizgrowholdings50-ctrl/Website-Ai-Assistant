import { api, getApiBase } from '../api';
import { toast, escapeHtml, emptyStateIcon } from '../utils';

export async function renderSettings(el: HTMLElement): Promise<void> {
  el.innerHTML = `
    <div class="page-header">
      <h2>Settings</h2>
      <p>System configuration and status</p>
    </div>
    <div class="loading-placeholder">
      <div class="loading-spinner"></div> Loading settings...
    </div>
  `;

  try {
    const base = getApiBase();
    let healthStatus = 'checking...';
    let healthColor = '#64748b';
    let gatewayVersion = 'v0.3.0';
    let firestoreStatus = 'unknown';

    try {
      const health = await api<{ status: string; version?: string; firestore?: string }>('/api/health');
      healthStatus = health.status === 'ok' ? 'Healthy' : 'Degraded';
      healthColor = health.status === 'ok' ? '#059669' : '#d97706';
      if (health.version) gatewayVersion = `v${health.version}`;
      firestoreStatus = health.firestore || 'unknown';
    } catch (error) {
      healthStatus = 'Unreachable';
      healthColor = '#dc2626';
    }

    el.innerHTML = `
      <div class="page-header">
        <h2>Settings</h2>
        <p>System configuration and status</p>
      </div>

      <div class="card">
        <h3>Gateway Configuration</h3>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:16px">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">API Base URL</div>
            <code style="font-size:13px;word-break:break-all">${escapeHtml(base)}</code>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Environment</div>
            <p style="font-size:13px;color:var(--text)">${base.includes('localhost') ? 'Development' : 'Production'}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>API Health</h3>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px">
          <div style="width:12px;height:12px;border-radius:50%;background:${healthColor}"></div>
          <span style="font-size:14px;color:var(--text)">${escapeHtml(healthStatus)}</span>
          <button class="btn btn-sm btn-outline" id="refresh-health">Refresh</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px">
          ${healthStatus === 'Healthy'
            ? 'Gateway is operational. All systems functioning normally.'
            : healthStatus === 'Unreachable'
              ? 'Cannot reach the gateway. Make sure the server is running.'
              : 'Gateway is experiencing issues. Check the server logs.'}
        </p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">
          Firestore: <span class="badge ${firestoreStatus === 'connected' ? 'badge-success' : 'badge-warning'}">${escapeHtml(firestoreStatus)}</span>
          ${firestoreStatus !== 'connected' ? ' (using in-memory storage)' : ''}
        </p>
      </div>

      <div class="card">
        <h3>Version Information</h3>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:16px">
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Dashboard</div>
            <p style="font-size:13px;color:var(--text)">v0.3.0</p>
          </div>
          <div>
            <div style="font-size:11px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Gateway</div>
            <p style="font-size:13px;color:var(--text)">${escapeHtml(gatewayVersion)}</p>
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
          <li><a href="${escapeHtml(base)}/health" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">API Health Endpoint</a></li>
        </ul>
      </div>
    `;

    // Bind refresh button
    document.getElementById('refresh-health')?.addEventListener('click', () => renderSettings(el));
  } catch (error) {
    console.error('Failed to load settings:', error);
    el.innerHTML = `
      <div class="page-header">
        <h2>Settings</h2>
        <p>System configuration and status</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${emptyStateIcon('settings')}
          <p>Failed to load settings</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `;
  }
}
