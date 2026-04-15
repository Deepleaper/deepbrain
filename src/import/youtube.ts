/**
 * DeepBrain - YouTube Transcript Importer
 *
 * Fetch YouTube video transcripts and optionally auto-summarize with LLM.
 *
 * CLI: deepbrain import youtube <url>
 */

import type { Brain } from '../core/brain.js';
import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';

export interface YouTubeImportOptions {
  /** YouTube video URL or ID */
  url: string;
  /** Slug prefix (default: 'youtube/') */
  prefix?: string;
  /** Auto-summarize with LLM */
  summarize?: boolean;
  /** LLM provider for summarization */
  provider?: string;
  /** LLM model */
  model?: string;
  /** API key */
  apiKey?: string;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface YouTubeImportResult {
  slug: string;
  title: string;
  transcript_length: number;
  summary?: string;
}

function extractVideoId(url: string): string {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error(`Cannot extract video ID from: ${url}`);
}

/**
 * Fetch transcript using YouTube's timedtext API (no API key needed).
 */
async function fetchTranscript(videoId: string): Promise<{ title: string; transcript: string }> {
  // Fetch the video page to get title and transcript data
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const pageHtml = await pageRes.text();

  // Extract title
  const titleMatch = pageHtml.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch
    ? titleMatch[1].replace(/ - YouTube$/, '').trim()
    : `Video ${videoId}`;

  // Extract captions URL from the page's ytInitialPlayerResponse
  const captionMatch = pageHtml.match(/"captionTracks":\[(\{[^\]]+)\]/);
  if (!captionMatch) {
    throw new Error('No captions/transcript available for this video. Try a video with subtitles enabled.');
  }

  // Parse caption tracks to find the best one
  const tracksJson = `[${captionMatch[1]}]`;
  let tracks: any[];
  try {
    tracks = JSON.parse(tracksJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  } catch {
    // Try alternate extraction
    const baseUrlMatch = captionMatch[1].match(/"baseUrl":"([^"]+)"/);
    if (!baseUrlMatch) throw new Error('Failed to parse caption tracks');
    tracks = [{ baseUrl: baseUrlMatch[1].replace(/\\u0026/g, '&') }];
  }

  // Prefer English, then any available
  const track = tracks.find((t: any) => t.languageCode === 'en') ?? tracks[0];
  const captionUrl = (track.baseUrl ?? track).replace(/\\u0026/g, '&');

  const captionRes = await fetch(captionUrl);
  const captionXml = await captionRes.text();

  // Parse XML transcript
  const lines: string[] = [];
  const textMatches = captionXml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
  for (const m of textMatches) {
    const text = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (text) lines.push(text);
  }

  if (lines.length === 0) throw new Error('Transcript is empty');

  return { title, transcript: lines.join(' ') };
}

/**
 * Summarize transcript with LLM.
 */
async function summarizeTranscript(
  transcript: string,
  options: { provider?: string; model?: string; apiKey?: string },
): Promise<string> {
  const chat = createChat({
    provider: (options.provider ?? 'ollama') as any,
    model: options.model,
    apiKey: options.apiKey,
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a knowledge assistant. Summarize the following YouTube video transcript into a well-structured knowledge page.
Include:
1. A concise summary (2-3 sentences)
2. Key points (bullet list)
3. Notable quotes or insights
Respond in the same language as the transcript.`,
    },
    { role: 'user', content: transcript.slice(0, 8000) },
  ];

  const response = await chat.chat(messages, { maxTokens: 1000 });
  return response.content.trim();
}

/**
 * Import a YouTube video transcript into DeepBrain.
 */
export async function importYouTube(
  brain: Brain,
  options: YouTubeImportOptions,
): Promise<YouTubeImportResult> {
  const { url, prefix = 'youtube/', summarize = true } = options;
  const log = options.onProgress ?? (() => {});

  const videoId = extractVideoId(url);
  log(`Fetching transcript for video: ${videoId}...`);

  const { title, transcript } = await fetchTranscript(videoId);
  log(`  📝 "${title}" — ${transcript.length} chars`);

  let summary: string | undefined;
  let content = `# ${title}\n\n**Source:** https://youtube.com/watch?v=${videoId}\n\n## Transcript\n\n${transcript}`;

  if (summarize && options.provider) {
    try {
      log(`  🤖 Summarizing with LLM...`);
      summary = await summarizeTranscript(transcript, {
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey,
      });
      content = `# ${title}\n\n**Source:** https://youtube.com/watch?v=${videoId}\n\n## Summary\n\n${summary}\n\n## Full Transcript\n\n${transcript}`;
      log(`  ✅ Summary generated`);
    } catch (e: any) {
      log(`  ⚠️  Summarization failed: ${e.message}`);
    }
  }

  const slug = `${prefix}${videoId}`;
  await brain.put(slug, {
    type: 'reference',
    title,
    compiled_truth: content,
    frontmatter: {
      source: 'youtube',
      video_id: videoId,
      url: `https://youtube.com/watch?v=${videoId}`,
      transcript_length: transcript.length,
      has_summary: !!summary,
    },
  });

  log(`  ✅ Saved as ${slug}`);

  return {
    slug,
    title,
    transcript_length: transcript.length,
    summary,
  };
}
