/**
 * DeepBrain — Webhook Integration
 *
 * Fire webhooks on key events: page added, search performed, chat completed.
 * Configurable URLs via deepbrain.json or environment variables.
 */

export type WebhookEvent = 'page.added' | 'page.updated' | 'page.deleted' | 'search.performed' | 'chat.completed';

export interface WebhookConfig {
  /** Webhook URLs mapped by event (or '*' for all events) */
  urls: Record<string, string[]>;
  /** Enable/disable webhooks globally */
  enabled: boolean;
  /** Timeout in ms */
  timeout?: number;
  /** Secret for HMAC signing */
  secret?: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

const DEFAULT_TIMEOUT = 5000;

/** Create HMAC signature for payload */
async function sign(payload: string, secret: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Fire a webhook to a single URL */
async function fireOne(url: string, payload: WebhookPayload, config: WebhookConfig): Promise<boolean> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'DeepBrain-Webhook/1.1',
    'X-DeepBrain-Event': payload.event,
  };

  if (config.secret) {
    headers['X-DeepBrain-Signature'] = await sign(body, config.secret);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout ?? DEFAULT_TIMEOUT);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** Fire webhooks for an event */
export async function fireWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
  config: WebhookConfig,
): Promise<{ sent: number; failed: number }> {
  if (!config.enabled) return { sent: 0, failed: 0 };

  const urls = [
    ...(config.urls[event] ?? []),
    ...(config.urls['*'] ?? []),
  ];

  if (urls.length === 0) return { sent: 0, failed: 0 };

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  let sent = 0;
  let failed = 0;

  // Fire all webhooks in parallel
  const results = await Promise.allSettled(
    urls.map(url => fireOne(url, payload, config))
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) sent++;
    else failed++;
  }

  return { sent, failed };
}

/** Load webhook config from deepbrain config */
export function loadWebhookConfig(config: Record<string, unknown>): WebhookConfig {
  const wh = (config.webhooks ?? {}) as Record<string, unknown>;
  return {
    enabled: (wh.enabled as boolean) ?? false,
    urls: (wh.urls as Record<string, string[]>) ?? {},
    timeout: (wh.timeout as number) ?? DEFAULT_TIMEOUT,
    secret: (wh.secret as string) ?? undefined,
  };
}

/** Default empty config */
export function defaultWebhookConfig(): WebhookConfig {
  return {
    enabled: false,
    urls: {},
    timeout: DEFAULT_TIMEOUT,
  };
}
