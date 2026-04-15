/**
 * DeepBrain — Daily Learning Digest Email (v1.3)
 *
 * Generate a daily/weekly digest of new knowledge and deliver via SMTP or webhook.
 */

import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';
import type { Brain } from './core/brain.js';

// ── Types ────────────────────────────────────────────────────────

export interface DigestEmailConfig {
  /** 'daily' | 'weekly' */
  period: 'daily' | 'weekly';
  /** Recipient email */
  to: string;
  /** Sender email */
  from?: string;
  /** Subject line template */
  subject?: string;
  /** SMTP config */
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure?: boolean;
  };
  /** Webhook URL (alternative to SMTP) */
  webhookUrl?: string;
  /** LLM config for summary generation */
  provider?: string;
  model?: string;
  apiKey?: string;
}

export interface DigestPage {
  slug: string;
  title: string;
  type: string;
  updated_at: Date;
  preview: string;
}

export interface DigestResult {
  html: string;
  pages: DigestPage[];
  period: string;
  delivered: boolean;
  method?: 'smtp' | 'webhook' | 'stdout';
}

// ── Generate digest content ──────────────────────────────────────

export async function generateDigestEmail(
  brain: Brain,
  config: DigestEmailConfig,
): Promise<DigestResult> {
  const now = new Date();
  const cutoff = new Date(now);
  if (config.period === 'weekly') {
    cutoff.setDate(cutoff.getDate() - 7);
  } else {
    cutoff.setDate(cutoff.getDate() - 1);
  }

  // Get recently updated pages
  const allPages = await brain.list({ limit: 200 });
  const recentPages: DigestPage[] = allPages
    .filter((p: any) => new Date(p.updated_at) >= cutoff)
    .map((p: any) => ({
      slug: p.slug,
      title: p.title,
      type: p.type ?? 'note',
      updated_at: new Date(p.updated_at),
      preview: (p.compiled_truth ?? '').slice(0, 200),
    }))
    .sort((a: DigestPage, b: DigestPage) => b.updated_at.getTime() - a.updated_at.getTime());

  // Generate AI summary if we have pages
  let aiSummary = '';
  if (recentPages.length > 0 && config.provider) {
    try {
      const chat = createChat({
        provider: config.provider as any,
        model: config.model,
        apiKey: config.apiKey,
      });

      const pagesText = recentPages
        .map(p => `- ${p.title}: ${p.preview}`)
        .join('\n');

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Write a brief, engaging summary (2-3 paragraphs) of the user\'s recent learning activity. Highlight key themes and interesting connections. Use the same language as the content.',
        },
        {
          role: 'user',
          content: `Here are the knowledge pages updated this ${config.period === 'weekly' ? 'week' : 'day'}:\n\n${pagesText}`,
        },
      ];

      const response = await chat.chat(messages, { maxTokens: 500 });
      aiSummary = response.content.trim();
    } catch {
      // Skip AI summary on failure
    }
  }

  // Build HTML email
  const periodLabel = config.period === 'weekly' ? 'Weekly' : 'Daily';
  const dateRange = config.period === 'weekly'
    ? `${cutoff.toISOString().split('T')[0]} — ${now.toISOString().split('T')[0]}`
    : now.toISOString().split('T')[0];

  const html = buildEmailHtml({
    periodLabel,
    dateRange,
    pages: recentPages,
    aiSummary,
    pageCount: recentPages.length,
  });

  // Deliver
  let delivered = false;
  let method: 'smtp' | 'webhook' | 'stdout' = 'stdout';

  if (config.smtp) {
    delivered = await sendSmtp(config, html);
    method = 'smtp';
  } else if (config.webhookUrl) {
    delivered = await sendWebhook(config.webhookUrl, html, config);
    method = 'webhook';
  } else {
    // Output to stdout
    console.log(html);
    delivered = true;
    method = 'stdout';
  }

  return { html, pages: recentPages, period: config.period, delivered, method };
}

// ── HTML builder ─────────────────────────────────────────────────

function buildEmailHtml(data: {
  periodLabel: string;
  dateRange: string;
  pages: DigestPage[];
  aiSummary: string;
  pageCount: number;
}): string {
  const pageRows = data.pages.map(p => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #eee">
        <strong style="color:#333">${escapeHtml(p.title)}</strong>
        <span style="color:#888;font-size:12px;margin-left:8px">${escapeHtml(p.type)}</span>
        <br><span style="color:#666;font-size:13px">${escapeHtml(p.preview.slice(0, 120))}${p.preview.length > 120 ? '…' : ''}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#888;font-size:12px;white-space:nowrap;vertical-align:top">
        ${p.updated_at.toISOString().split('T')[0]}
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
<div style="max-width:640px;margin:0 auto;padding:20px">
  <div style="background:#7c3aed;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px">🧠 DeepBrain ${data.periodLabel} Digest</h1>
    <p style="margin:6px 0 0;opacity:.85;font-size:14px">${data.dateRange} · ${data.pageCount} pages updated</p>
  </div>
  <div style="background:#fff;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:0">
    ${data.aiSummary ? `
    <div style="background:#f8f7ff;border-left:4px solid #7c3aed;padding:16px;margin-bottom:20px;border-radius:0 8px 8px 0">
      <p style="margin:0 0 4px;font-weight:600;color:#7c3aed;font-size:13px">✨ AI Summary</p>
      <p style="margin:0;color:#444;font-size:14px;line-height:1.6">${escapeHtml(data.aiSummary)}</p>
    </div>` : ''}
    ${data.pages.length > 0 ? `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid #eee">
          <th style="text-align:left;padding:8px 16px;color:#888;font-size:12px;font-weight:500">Page</th>
          <th style="text-align:left;padding:8px 16px;color:#888;font-size:12px;font-weight:500">Updated</th>
        </tr>
      </thead>
      <tbody>${pageRows}</tbody>
    </table>` : '<p style="color:#888;text-align:center;padding:32px">No new knowledge this period 📭</p>'}
  </div>
  <p style="text-align:center;color:#aaa;font-size:12px;margin-top:16px">
    Powered by <a href="https://github.com/Magicray1217/deepbrain" style="color:#7c3aed">DeepBrain</a>
  </p>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── SMTP delivery (basic, no external deps) ──────────────────────

async function sendSmtp(config: DigestEmailConfig, html: string): Promise<boolean> {
  // Use Node.js net/tls for basic SMTP — keeps zero-dep promise
  // For production, users should use webhook delivery instead
  try {
    const net = await import('node:net');
    const tls = await import('node:tls');

    const smtp = config.smtp!;
    const port = smtp.port ?? (smtp.secure ? 465 : 587);

    return new Promise((resolve) => {
      const socket = smtp.secure
        ? tls.connect(port, smtp.host, { rejectUnauthorized: false })
        : net.createConnection(port, smtp.host);

      let step = 0;
      const subject = config.subject ?? `🧠 DeepBrain ${config.period === 'weekly' ? 'Weekly' : 'Daily'} Digest`;

      socket.on('data', (data: Buffer) => {
        const response = data.toString();
        if (step === 0) {
          socket.write(`EHLO deepbrain\r\n`);
          step++;
        } else if (step === 1 && response.includes('250')) {
          socket.write(`AUTH LOGIN\r\n`);
          step++;
        } else if (step === 2) {
          socket.write(Buffer.from(smtp.user).toString('base64') + '\r\n');
          step++;
        } else if (step === 3) {
          socket.write(Buffer.from(smtp.pass).toString('base64') + '\r\n');
          step++;
        } else if (step === 4 && response.includes('235')) {
          socket.write(`MAIL FROM:<${config.from ?? smtp.user}>\r\n`);
          step++;
        } else if (step === 5) {
          socket.write(`RCPT TO:<${config.to}>\r\n`);
          step++;
        } else if (step === 6) {
          socket.write(`DATA\r\n`);
          step++;
        } else if (step === 7) {
          socket.write(`Subject: ${subject}\r\n`);
          socket.write(`From: DeepBrain <${config.from ?? smtp.user}>\r\n`);
          socket.write(`To: ${config.to}\r\n`);
          socket.write(`MIME-Version: 1.0\r\n`);
          socket.write(`Content-Type: text/html; charset=utf-8\r\n`);
          socket.write(`\r\n`);
          socket.write(html);
          socket.write(`\r\n.\r\n`);
          step++;
        } else if (step === 8) {
          socket.write(`QUIT\r\n`);
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('error', () => resolve(false));
      setTimeout(() => { socket.destroy(); resolve(false); }, 30000);
    });
  } catch {
    return false;
  }
}

// ── Webhook delivery ─────────────────────────────────────────────

async function sendWebhook(url: string, html: string, config: DigestEmailConfig): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: config.to,
        from: config.from ?? 'deepbrain@local',
        subject: config.subject ?? `🧠 DeepBrain ${config.period === 'weekly' ? 'Weekly' : 'Daily'} Digest`,
        html,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
