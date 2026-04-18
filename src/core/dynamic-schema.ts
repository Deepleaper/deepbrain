/**
 * Dynamic Memory Schema (inspired by M★ paper)
 *
 * Analyzes page content patterns to suggest structured schema hints,
 * enabling workstation-specific memory organization.
 */

import type { Brain } from './brain.js';
import type { Page } from './types.js';

export interface SchemaHint {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
}

export type WorkstationCategory = 'sales' | 'engineering' | 'customer-service' | 'finance' | 'hr';

const SCHEMA_PAGE_SLUG = '_schema';

/** Pre-built schema hints per workstation category */
export const WORKSTATION_SCHEMAS: Record<WorkstationCategory, SchemaHint[]> = {
  sales: [
    { field: 'customer_tier', type: 'string', description: 'Customer tier classification (e.g., enterprise, SMB, startup)' },
    { field: 'deal_stage', type: 'string', description: 'Current deal stage (e.g., prospect, negotiation, closed)' },
    { field: 'follow_up_date', type: 'date', description: 'Next follow-up date for the customer' },
  ],
  engineering: [
    { field: 'tech_stack', type: 'string', description: 'Technology stack involved (e.g., React, Python, PostgreSQL)' },
    { field: 'bug_pattern', type: 'string', description: 'Common bug pattern category (e.g., race condition, null pointer)' },
    { field: 'solution_type', type: 'string', description: 'Solution approach (e.g., refactor, hotfix, workaround)' },
  ],
  'customer-service': [
    { field: 'complaint_category', type: 'string', description: 'Category of customer complaint' },
    { field: 'resolution_method', type: 'string', description: 'How the issue was resolved' },
    { field: 'satisfaction_score', type: 'number', description: 'Customer satisfaction score (1-10)' },
  ],
  finance: [
    { field: 'amount', type: 'number', description: 'Financial amount' },
    { field: 'currency', type: 'string', description: 'Currency code (e.g., USD, CNY, EUR)' },
    { field: 'fiscal_period', type: 'string', description: 'Fiscal period (e.g., Q1 2026, FY2025)' },
  ],
  hr: [
    { field: 'candidate_stage', type: 'string', description: 'Hiring pipeline stage (e.g., screening, interview, offer)' },
    { field: 'department', type: 'string', description: 'Department name' },
    { field: 'headcount', type: 'number', description: 'Headcount number' },
  ],
};

/** Keywords that hint at specific field types */
const TYPE_INDICATORS: Record<string, 'number' | 'date' | 'boolean'> = {
  count: 'number', amount: 'number', total: 'number', score: 'number', price: 'number',
  rate: 'number', percent: 'number', quantity: 'number', headcount: 'number',
  date: 'date', time: 'date', deadline: 'date', scheduled: 'date', created: 'date',
  updated: 'date', expires: 'date',
  enabled: 'boolean', active: 'boolean', completed: 'boolean', approved: 'boolean',
  verified: 'boolean',
};

export class DynamicSchemaManager {
  /**
   * Analyze page content patterns to suggest schema hints.
   * Uses keyword frequency analysis to find commonly occurring structured data patterns.
   */
  suggestSchema(pages: Page[]): SchemaHint[] {
    if (pages.length === 0) return [];

    // Count keyword occurrences across all pages
    const fieldFrequency = new Map<string, number>();
    const fieldContexts = new Map<string, string[]>();

    for (const page of pages) {
      const text = `${page.title || ''} ${page.compiled_truth || ''}`;
      // Extract potential field names: word_word patterns, or key: value patterns
      const kvMatches = text.match(/\b([a-z_]{2,30})\s*[:=]\s*\S+/gi) || [];
      for (const match of kvMatches) {
        const field = match.split(/[:=]/)[0].trim().toLowerCase().replace(/\s+/g, '_');
        if (field.length >= 2 && field.length <= 30) {
          fieldFrequency.set(field, (fieldFrequency.get(field) || 0) + 1);
          if (!fieldContexts.has(field)) fieldContexts.set(field, []);
          fieldContexts.get(field)!.push(match);
        }
      }

      // Also check frontmatter keys
      if (page.frontmatter) {
        for (const key of Object.keys(page.frontmatter)) {
          fieldFrequency.set(key, (fieldFrequency.get(key) || 0) + 1);
        }
      }
    }

    // Only suggest fields that appear in >= 20% of pages (min 2)
    const threshold = Math.max(2, Math.floor(pages.length * 0.2));
    const hints: SchemaHint[] = [];

    for (const [field, count] of fieldFrequency) {
      if (count >= threshold) {
        // Infer type from field name
        let inferredType: SchemaHint['type'] = 'string';
        for (const [keyword, type] of Object.entries(TYPE_INDICATORS)) {
          if (field.includes(keyword)) {
            inferredType = type;
            break;
          }
        }

        hints.push({
          field,
          type: inferredType,
          description: `Auto-detected field appearing in ${count}/${pages.length} pages`,
        });
      }
    }

    return hints;
  }

  /**
   * Store schema hints in a special `_schema` page in the brain.
   */
  async applySchema(brain: Brain, hints: SchemaHint[]): Promise<void> {
    const content = hints.map(h =>
      `- **${h.field}** (${h.type}): ${h.description}`
    ).join('\n');

    await brain.put(SCHEMA_PAGE_SLUG, {
      type: 'schema',
      title: 'Dynamic Schema Hints',
      compiled_truth: content,
      frontmatter: {
        hints: JSON.parse(JSON.stringify(hints)),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Read current schema hints from the brain.
   */
  async getSchema(brain: Brain): Promise<SchemaHint[]> {
    try {
      const page = await brain.get(SCHEMA_PAGE_SLUG);
      if (!page || !page.frontmatter) return [];
      const hints = (page.frontmatter as Record<string, unknown>).hints;
      if (Array.isArray(hints)) return hints as SchemaHint[];
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get pre-built schema hints for a workstation category.
   */
  getWorkstationSchema(category: WorkstationCategory): SchemaHint[] {
    return WORKSTATION_SCHEMAS[category] || [];
  }
}
