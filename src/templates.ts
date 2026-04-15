/**
 * DeepBrain — Brain Templates (v1.4.0)
 *
 * Pre-built brain configurations for common use cases.
 * `deepbrain init --template research|journal|bookshelf|project`
 */

import { Brain } from './core/brain.js';

// ── Types ─────────────────────────────────────────────────────────

export interface BrainTemplate {
  name: string;
  description: string;
  pages: Array<{
    slug: string;
    type: string;
    title: string;
    content: string;
    tags?: string[];
  }>;
  links?: Array<{ from: string; to: string; context: string; type?: string }>;
}

// ── Templates ─────────────────────────────────────────────────────

export const TEMPLATES: Record<string, BrainTemplate> = {
  research: {
    name: 'Research Brain',
    description: 'Organize papers, hypotheses, experiments, and findings.',
    pages: [
      {
        slug: 'research-inbox',
        type: 'index',
        title: '📥 Research Inbox',
        content: 'Landing page for new papers, ideas, and links.\n\nAdd items here first, then process into proper pages.',
        tags: ['index', 'inbox'],
      },
      {
        slug: 'literature-review',
        type: 'index',
        title: '📚 Literature Review',
        content: 'Curated list of key papers and their summaries.\n\n## How to use\n1. Add papers with `deepbrain put paper-<name> paper.md`\n2. Tag with research area\n3. Link related papers together',
        tags: ['index', 'literature'],
      },
      {
        slug: 'hypotheses',
        type: 'index',
        title: '🔬 Hypotheses',
        content: 'Active research hypotheses and their status.\n\n## Template\n- **Hypothesis**: ...\n- **Evidence for**: ...\n- **Evidence against**: ...\n- **Status**: active | confirmed | rejected',
        tags: ['index', 'hypothesis'],
      },
      {
        slug: 'methodology-notes',
        type: 'note',
        title: '🛠 Methodology Notes',
        content: 'Common methods, tools, and techniques used in your research.\n\nAdd experimental setups, statistical methods, etc.',
        tags: ['methodology'],
      },
      {
        slug: 'findings-log',
        type: 'index',
        title: '🎯 Findings Log',
        content: 'Key findings and results, organized chronologically.\n\nUse timeline entries for temporal tracking.',
        tags: ['index', 'findings'],
      },
    ],
    links: [
      { from: 'research-inbox', to: 'literature-review', context: 'process into', type: 'workflow' },
      { from: 'literature-review', to: 'hypotheses', context: 'informs', type: 'related' },
      { from: 'hypotheses', to: 'findings-log', context: 'produces', type: 'workflow' },
    ],
  },

  journal: {
    name: 'Personal Journal',
    description: 'Daily journaling with reflections, moods, and growth tracking.',
    pages: [
      {
        slug: 'journal-home',
        type: 'index',
        title: '📔 Journal Home',
        content: 'Welcome to your personal journal brain.\n\n## Daily entries\nUse: `deepbrain put YYYY-MM-DD journal-entry.md`\n\n## Reflections\nWeekly and monthly reflections for pattern recognition.',
        tags: ['index', 'journal'],
      },
      {
        slug: 'gratitude-log',
        type: 'index',
        title: '🙏 Gratitude Log',
        content: 'Things I\'m grateful for.\n\nAdd 3 items daily using timeline:\n`deepbrain timeline gratitude-log "Grateful for..."`',
        tags: ['gratitude', 'wellness'],
      },
      {
        slug: 'goals-tracker',
        type: 'index',
        title: '🎯 Goals & Habits',
        content: '## Active Goals\n\n- [ ] Goal 1\n- [ ] Goal 2\n\n## Habits\n\nTrack daily habits and streaks.',
        tags: ['goals', 'habits'],
      },
      {
        slug: 'people-notes',
        type: 'index',
        title: '👥 People Notes',
        content: 'Notes about people in your life.\n\nCreate person pages: `deepbrain put person-<name> --type person`',
        tags: ['people', 'relationships'],
      },
      {
        slug: 'weekly-reflection-template',
        type: 'template',
        title: '📝 Weekly Reflection Template',
        content: '## Week of [DATE]\n\n### What went well?\n\n### What could improve?\n\n### Key insights\n\n### Next week focus\n',
        tags: ['template', 'reflection'],
      },
    ],
    links: [
      { from: 'journal-home', to: 'gratitude-log', context: 'includes', type: 'contains' },
      { from: 'journal-home', to: 'goals-tracker', context: 'includes', type: 'contains' },
      { from: 'journal-home', to: 'people-notes', context: 'includes', type: 'contains' },
    ],
  },

  bookshelf: {
    name: 'Book Notes',
    description: 'Track books, highlights, reviews, and reading insights.',
    pages: [
      {
        slug: 'bookshelf-home',
        type: 'index',
        title: '📚 My Bookshelf',
        content: 'Personal library and reading tracker.\n\n## How to add books\n```\ndeepbrain put book-<title> --type book\n```\n\nTag with genre, status (reading/finished/want-to-read).',
        tags: ['index', 'books'],
      },
      {
        slug: 'reading-list',
        type: 'index',
        title: '📋 Reading List',
        content: '## Currently Reading\n\n## Want to Read\n\n## Recently Finished\n',
        tags: ['index', 'reading-list'],
      },
      {
        slug: 'book-highlights',
        type: 'index',
        title: '✨ Highlights & Quotes',
        content: 'Best highlights and quotes from all books.\n\nUse `deepbrain search --tag highlight` to find them.',
        tags: ['index', 'highlights'],
      },
      {
        slug: 'author-notes',
        type: 'index',
        title: '✍️ Author Notes',
        content: 'Notes about authors.\n\nCreate: `deepbrain put author-<name> --type person`\nLink to their books.',
        tags: ['index', 'authors'],
      },
      {
        slug: 'book-template',
        type: 'template',
        title: '📖 Book Note Template',
        content: '## [Book Title] by [Author]\n\n**Rating**: ⭐⭐⭐⭐⭐\n**Status**: reading | finished\n**Genre**: \n\n### Summary\n\n### Key Ideas\n\n### Favorite Quotes\n\n### How it changed my thinking\n',
        tags: ['template', 'book'],
      },
    ],
    links: [
      { from: 'bookshelf-home', to: 'reading-list', context: 'includes', type: 'contains' },
      { from: 'bookshelf-home', to: 'book-highlights', context: 'includes', type: 'contains' },
      { from: 'bookshelf-home', to: 'author-notes', context: 'includes', type: 'contains' },
    ],
  },

  project: {
    name: 'Project Wiki',
    description: 'Project documentation, decisions, and knowledge base.',
    pages: [
      {
        slug: 'project-home',
        type: 'index',
        title: '🏗 Project Wiki',
        content: 'Central knowledge base for your project.\n\n## Quick Links\n- Architecture decisions\n- API documentation\n- Team notes\n- Meeting logs',
        tags: ['index', 'project'],
      },
      {
        slug: 'architecture-decisions',
        type: 'index',
        title: '🏛 Architecture Decision Records',
        content: 'ADRs — document important technical decisions.\n\n## Template\n- **Title**: ADR-NNN: [Title]\n- **Status**: proposed | accepted | deprecated\n- **Context**: Why is this decision needed?\n- **Decision**: What did we decide?\n- **Consequences**: What happens as a result?',
        tags: ['index', 'adr', 'architecture'],
      },
      {
        slug: 'api-docs',
        type: 'index',
        title: '📡 API Documentation',
        content: 'API endpoints, schemas, and integration guides.\n\nCreate per-endpoint pages: `deepbrain put api-<endpoint>`',
        tags: ['index', 'api', 'docs'],
      },
      {
        slug: 'meeting-log',
        type: 'index',
        title: '📝 Meeting Log',
        content: 'Meeting notes and action items.\n\nAdd with timeline: `deepbrain timeline meeting-log "Sprint review: ..."`',
        tags: ['index', 'meetings'],
      },
      {
        slug: 'team-directory',
        type: 'index',
        title: '👥 Team Directory',
        content: 'Team members, roles, and expertise.\n\nCreate: `deepbrain put team-<name> --type person`',
        tags: ['index', 'team'],
      },
      {
        slug: 'runbook',
        type: 'index',
        title: '🔧 Runbook',
        content: 'Operational procedures, deployment steps, and incident response.\n\n## Deployment\n\n## Rollback\n\n## Incident Response\n',
        tags: ['index', 'ops', 'runbook'],
      },
    ],
    links: [
      { from: 'project-home', to: 'architecture-decisions', context: 'includes', type: 'contains' },
      { from: 'project-home', to: 'api-docs', context: 'includes', type: 'contains' },
      { from: 'project-home', to: 'meeting-log', context: 'includes', type: 'contains' },
      { from: 'project-home', to: 'team-directory', context: 'includes', type: 'contains' },
      { from: 'project-home', to: 'runbook', context: 'includes', type: 'contains' },
    ],
  },
};

// ── Apply Template ────────────────────────────────────────────────

/**
 * Apply a template to a brain, creating all pages, tags, and links.
 */
export async function applyTemplate(brain: Brain, templateName: string): Promise<{ pages: number; links: number; tags: number }> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(', ')}`);
  }

  let tagCount = 0;

  // Create pages
  for (const page of template.pages) {
    await brain.put(page.slug, {
      type: page.type,
      title: page.title,
      compiled_truth: page.content,
    });

    if (page.tags) {
      for (const tag of page.tags) {
        await brain.tag(page.slug, tag);
        tagCount++;
      }
    }
  }

  // Create links
  let linkCount = 0;
  if (template.links) {
    for (const link of template.links) {
      await brain.link(link.from, link.to, link.context, link.type ?? 'related');
      linkCount++;
    }
  }

  return { pages: template.pages.length, links: linkCount, tags: tagCount };
}

/**
 * List available template names and descriptions.
 */
export function listTemplates(): Array<{ name: string; description: string }> {
  return Object.entries(TEMPLATES).map(([name, t]) => ({
    name,
    description: t.description,
  }));
}
