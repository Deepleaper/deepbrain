/**
 * DeepBrain — Day One Importer
 *
 * Import from Day One JSON export.
 * Supports: .json files from Day One export.
 */

import { readFile } from 'fs/promises';
import type { ImportedPage } from './yuque.js';

export interface DayOneImportOptions {
  file: string;
  onProgress?: (current: number, total: number, title: string) => void;
}

interface DayOneEntry {
  text?: string;
  creationDate?: string;
  modifiedDate?: string;
  starred?: boolean;
  tags?: string[];
  location?: {
    placeName?: string;
    localityName?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  weather?: {
    conditionsDescription?: string;
    temperatureCelsius?: number;
  };
  uuid?: string;
}

function toSlug(text: string, date: string): string {
  const dateSlug = date ? date.slice(0, 10) : '';
  const preview = text.slice(0, 30).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-');
  return `${dateSlug}-${preview}` || 'entry';
}

export async function importDayOne(options: DayOneImportOptions): Promise<ImportedPage[]> {
  const { file, onProgress } = options;
  const raw = await readFile(file, 'utf-8');
  const data = JSON.parse(raw);

  const entries: DayOneEntry[] = data.entries ?? (Array.isArray(data) ? data : []);
  const pages: ImportedPage[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.text?.trim()) continue;

    onProgress?.(i + 1, entries.length, entry.creationDate ?? `entry ${i + 1}`);

    const firstLine = entry.text.split('\n')[0]?.slice(0, 80) ?? 'Journal Entry';
    const tags = [...(entry.tags ?? [])];
    if (entry.starred) tags.push('starred');

    const locationStr = entry.location
      ? [entry.location.placeName, entry.location.localityName, entry.location.country].filter(Boolean).join(', ')
      : undefined;

    const weatherStr = entry.weather
      ? `${entry.weather.conditionsDescription ?? ''} ${entry.weather.temperatureCelsius != null ? entry.weather.temperatureCelsius + '°C' : ''}`.trim()
      : undefined;

    // Add context header
    let body = entry.text;
    const contextParts: string[] = [];
    if (entry.creationDate) contextParts.push(`📅 ${entry.creationDate.slice(0, 10)}`);
    if (locationStr) contextParts.push(`📍 ${locationStr}`);
    if (weatherStr) contextParts.push(`🌤️ ${weatherStr}`);
    if (contextParts.length) body = contextParts.join(' | ') + '\n\n' + body;

    pages.push({
      slug: toSlug(entry.text, entry.creationDate ?? ''),
      title: firstLine,
      body,
      tags,
      metadata: {
        source_platform: 'dayone',
        ...(entry.creationDate ? { created_at: entry.creationDate } : {}),
        ...(entry.modifiedDate ? { updated_at: entry.modifiedDate } : {}),
        ...(entry.uuid ? { dayone_uuid: entry.uuid } : {}),
        ...(locationStr ? { location: locationStr } : {}),
      },
      source: file,
    });
  }

  return pages;
}
