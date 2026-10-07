import { api } from '../api';
import { toast, escapeHtml, emptyStateIcon } from '../utils';
import type { SiteConfig, KnowledgeDoc } from '../types';

let sites: SiteConfig[] = [];
let activeSiteId: string = '';

export async function renderKnowledge(el: HTMLElement): Promise<void> {
  // Show loading state
  el.innerHTML = `
    <div class="page-header">
      <h2>Knowledge Base</h2>
      <p>Manage FAQs, product information, and policies</p>
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
          <h2>Knowledge Base</h2>
          <p>Manage FAQs, product information, and policies</p>
        </div>
        <div class="card">
          <div class="empty-state">
            ${emptyStateIcon('document')}
            <p>No sites registered yet</p>
            <p style="font-size:12px;color:var(--text-secondary)">Register a site first to add knowledge documents</p>
          </div>
        </div>
      `;
      return;
    }

    activeSiteId = activeSiteId || sites[0].site_id;
    const docs = await api<{ documents: KnowledgeDoc[] }>(`/api/sites/${activeSiteId}/knowledge`);
    const documents = docs.documents || [];

    el.innerHTML = `
      <div class="flex-between" style="margin-bottom:20px">
        <div>
          <h2>Knowledge Base</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">Manage FAQs, product information, and policies</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="kb-site" class="select-inline">
            ${sites.map(s => `<option value="${escapeHtml(s.site_id)}" ${s.site_id === activeSiteId ? 'selected' : ''}>${escapeHtml(s.persona_name)} (${escapeHtml(s.domain)})</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="add-kb-btn">+ Add Document</button>
        </div>
      </div>

      <div id="kb-docs">
        ${documents.length === 0
          ? `<div class="card">
              <div class="empty-state">
                ${emptyStateIcon('document')}
                <p>No knowledge documents yet</p>
                <p style="font-size:12px;color:var(--text-secondary)">Add FAQs, product info, or policies to help your AI assistant</p>
              </div>
            </div>`
          : documents.map(d => `
            <div class="card">
              <div class="flex-between">
                <h3>${escapeHtml(d.title || 'Untitled')}</h3>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-sm btn-outline" data-edit-kb="${escapeHtml(d.id)}" data-title="${encodeURIComponent(d.title || '')}" data-content="${encodeURIComponent(d.content || '')}">Edit</button>
                  <button class="btn btn-sm btn-danger" data-delete-kb="${escapeHtml(d.id)}">Delete</button>
                </div>
              </div>
              <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;white-space:pre-wrap">${escapeHtml((d.content || '').substring(0, 300))}${(d.content || '').length > 300 ? '...' : ''}</p>
            </div>
          `).join('')}
      </div>
      <div id="kb-form" class="card hidden"></div>
    `;

    document.getElementById('kb-site')?.addEventListener('change', (e) => {
      activeSiteId = (e.target as HTMLSelectElement).value;
      renderKnowledge(el);
    });
    document.getElementById('add-kb-btn')?.addEventListener('click', () => showKbForm());
    el.querySelectorAll<HTMLButtonElement>('[data-edit-kb]').forEach(btn =>
      btn.addEventListener('click', () =>
        showKbForm(btn.dataset.editKb!, decodeURIComponent(btn.dataset.title || ''), decodeURIComponent(btn.dataset.content || ''))
      )
    );
    el.querySelectorAll<HTMLButtonElement>('[data-delete-kb]').forEach(btn =>
      btn.addEventListener('click', () => deleteKb(btn.dataset.deleteKb!)
      )
    );
  } catch (error) {
    console.error('Failed to load knowledge base:', error);
    el.innerHTML = `
      <div class="page-header">
        <h2>Knowledge Base</h2>
        <p>Manage FAQs, product information, and policies</p>
      </div>
      <div class="card">
        <div class="empty-state">
          ${emptyStateIcon('document')}
          <p>Failed to load knowledge base</p>
          <p style="font-size:12px;color:var(--text-secondary)">Please try refreshing the page</p>
        </div>
      </div>
    `;
  }
}

function showKbForm(docId: string = '', title: string = '', content: string = ''): void {
  const form = document.getElementById('kb-form');
  if (!form) return;
  form.classList.remove('hidden');

  form.innerHTML = `
    <h3>${docId ? 'Edit Document' : 'Add Document'}</h3>
    <div class="form-group">
      <label>Title</label>
      <input id="kb-title" value="${escapeHtml(title)}" placeholder="e.g., Shipping Policy" />
    </div>
    <div class="form-group">
      <label>Content</label>
      <textarea id="kb-content" style="min-height:200px" placeholder="Write your FAQ, policy, or product information here...">${escapeHtml(content)}</textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" id="save-kb-btn">${docId ? 'Update' : 'Create'}</button>
      <button class="btn btn-outline" id="cancel-kb-btn">Cancel</button>
    </div>
  `;

  document.getElementById('save-kb-btn')?.addEventListener('click', () => saveKb(docId));
  document.getElementById('cancel-kb-btn')?.addEventListener('click', () => form.classList.add('hidden'));
  form.scrollIntoView({ behavior: 'smooth' });
}

async function saveKb(docId: string): Promise<void> {
  const title = (document.getElementById('kb-title') as HTMLInputElement).value.trim();
  const content = (document.getElementById('kb-content') as HTMLTextAreaElement).value.trim();

  // Validate
  if (!title) {
    toast('Please enter a title', 'error');
    (document.getElementById('kb-title') as HTMLInputElement).focus();
    return;
  }
  if (!content) {
    toast('Please enter some content', 'error');
    (document.getElementById('kb-content') as HTMLTextAreaElement).focus();
    return;
  }

  try {
    const body = { title, content };
    if (docId) {
      await api(`/api/sites/${activeSiteId}/knowledge/${docId}`, { method: 'PUT', body });
      toast('Document updated');
    } else {
      await api(`/api/sites/${activeSiteId}/knowledge`, { method: 'POST', body });
      toast('Document added');
    }
    renderKnowledge(document.getElementById('main-content')!);
  } catch (error) {
    console.error('Failed to save document:', error);
    toast('Failed to save document', 'error');
  }
}

async function deleteKb(docId: string): Promise<void> {
  if (!confirm('Delete this document?')) return;
  try {
    await api(`/api/sites/${activeSiteId}/knowledge/${docId}`, { method: 'DELETE' });
    toast('Document deleted');
    renderKnowledge(document.getElementById('main-content')!);
  } catch (error) {
    console.error('Failed to delete document:', error);
    toast('Failed to delete document', 'error');
  }
}
