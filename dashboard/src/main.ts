import './styles.css';
import { renderOverview } from './pages/overview';
import { renderSites } from './pages/sites';
import { renderKnowledge } from './pages/knowledge';
import { renderSessions } from './pages/sessions';
import { renderSettings } from './pages/settings';

type Page = 'overview' | 'sites' | 'knowledge' | 'sessions' | 'settings';

const pages: Record<Page, (el: HTMLElement) => void | Promise<void>> = {
  overview: renderOverview,
  sites: renderSites,
  knowledge: renderKnowledge,
  sessions: renderSessions,
  settings: renderSettings,
};

export function navigate(page: Page): void {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  const main = document.getElementById('main-content')!;
  pages[page](main);
}

// Navigation
document.querySelectorAll<HTMLElement>('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page as Page;
    if (page) navigate(page);
  });
});

// Initial render
navigate('overview');
