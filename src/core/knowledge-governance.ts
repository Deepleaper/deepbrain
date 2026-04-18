/**
 * Cross-Workstation Knowledge Governance
 * Inspired by SSGM (2026)
 *
 * Controls how knowledge propagates between workstation levels (L1-L4),
 * with PII filtering, attribution tracking, and audit logging.
 */

import type { Brain } from './brain.js';
import type { Page } from './types.js';

// ── Types ────────────────────────────────────────────────────────

export type GovernanceLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type FilterMode = 'none' | 'pii_strip' | 'summarize' | 'anonymize';

export interface PropagationRule {
  from_level: GovernanceLevel;
  to_level: GovernanceLevel;
  filter: FilterMode;
}

export interface GovernancePolicy {
  pii_filter: boolean;
  attribution: boolean;
  audit_log: boolean;
  propagation_rules: PropagationRule[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  page_slug: string;
  from: string;
  to: string;
}

// ── PII Patterns ─────────────────────────────────────────────────

const PII_PATTERNS: { name: string; regex: RegExp; replacement: string }[] = [
  // Chinese ID number (18 digits) — must come before phone to avoid partial match
  { name: 'cn_id', regex: /\d{17}[\dXx]/g, replacement: '[ID_NUMBER]' },
  // Chinese mobile
  { name: 'cn_phone', regex: /1[3-9]\d{9}/g, replacement: '[PHONE]' },
  // International phone
  { name: 'intl_phone', regex: /\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, replacement: '[PHONE]' },
  // Email
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Chinese names with titles (先生/女士/总/经理)
  { name: 'cn_name', regex: /([\u4e00-\u9fa5]{2,4})(先生|女士|总|经理)/g, replacement: '[NAME]$2' },
];

// ── Helpers ──────────────────────────────────────────────────────

function stripPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement);
  }
  return result;
}

function anonymize(text: string): string {
  // Strip PII + replace any remaining proper nouns heuristically
  let result = stripPII(text);
  // Additional anonymization: replace quoted names
  result = result.replace(/"[\u4e00-\u9fa5]{2,4}"/g, '"[ANON]"');
  return result;
}

function summarize(text: string): string {
  // Simple extractive summary: take first 3 sentences or 500 chars
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());
  const summary = sentences.slice(0, 3).join('。');
  return summary.length > 500 ? summary.slice(0, 500) + '...' : summary;
}

const AUDIT_LOG_SLUG = '_audit_log';

// ── KnowledgeGovernor ────────────────────────────────────────────

export class KnowledgeGovernor {
  private policy: GovernancePolicy;
  private brain?: Brain;

  constructor(policy: GovernancePolicy, brain?: Brain) {
    this.policy = policy;
    this.brain = brain;
  }

  /**
   * Check if propagation is allowed from one level to another.
   */
  canPropagate(page: Page, from_level: string, to_level: string): boolean {
    const rule = this.policy.propagation_rules.find(
      r => r.from_level === from_level && r.to_level === to_level,
    );
    return rule !== undefined;
  }

  /**
   * Filter a page for propagation according to the rule's filter mode.
   * Returns a new Page object (does not mutate the original).
   */
  filterForPropagation(page: Page, rule: PropagationRule): Page {
    const filtered = { ...page };

    switch (rule.filter) {
      case 'none':
        break;
      case 'pii_strip':
        filtered.compiled_truth = stripPII(page.compiled_truth);
        filtered.timeline = stripPII(page.timeline);
        break;
      case 'summarize':
        filtered.compiled_truth = summarize(page.compiled_truth);
        filtered.timeline = summarize(page.timeline);
        break;
      case 'anonymize':
        filtered.compiled_truth = anonymize(page.compiled_truth);
        filtered.timeline = anonymize(page.timeline);
        break;
    }

    return filtered;
  }

  /**
   * Add attribution metadata to a page.
   * Returns a new Page with updated frontmatter.
   */
  addAttribution(page: Page, source_agent: string, source_level: string): Page {
    return {
      ...page,
      frontmatter: {
        ...page.frontmatter,
        _attribution: {
          source_agent,
          source_level,
          attributed_at: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Log a propagation event to the brain's audit log page.
   * If no brain is configured, this is a no-op.
   */
  async auditLog(action: string, page_slug: string, from: string, to: string): Promise<void> {
    if (!this.policy.audit_log || !this.brain) return;

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      page_slug,
      from,
      to,
    };

    const existing = await this.brain.get(AUDIT_LOG_SLUG);
    let entries: AuditEntry[] = [];
    if (existing?.compiled_truth) {
      try {
        entries = JSON.parse(existing.compiled_truth);
      } catch { /* reset on corruption */ }
    }

    entries.push(entry);

    await this.brain.put(AUDIT_LOG_SLUG, {
      type: 'system',
      title: 'Knowledge Governance Audit Log',
      compiled_truth: JSON.stringify(entries, null, 2),
    });
  }
}

// Re-export helpers for testing
export { stripPII, anonymize, summarize, PII_PATTERNS };
