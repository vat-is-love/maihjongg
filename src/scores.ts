// SPDX-License-Identifier: GPL-3.0-or-later
export interface Score {
  id: string;
  date: string;
  layout: string;
  elapsedMs: number;
  player: string;
  source: 'local' | 'gnome';
  hints: number | null;
  shuffles: number | null;
}

// GNOME history.vala: ISO8601 layout duration-in-seconds [player name].
// https://github.com/GNOME/gnome-mahjongg/blob/main/src/history.vala
export function parseGnomeHistory(text: string): { scores: Score[]; skipped: number } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length > 10001) throw new Error('В файле больше 10 000 строк. Разделите его на несколько файлов.');
  const scores: Score[] = [];
  const occurrences = new Map<string, number>();
  let skipped = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.trim().match(/^(\S+)\s+(\S+)\s+(\d+)(?:\s+(.*))?$/);
    if (!match) { skipped++; continue; }
    const [, rawDate, rawLayout, seconds, rawPlayer = ''] = match;
    const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/);
    const normalized = rawDate.replace(/([+-]\d{2})$/, '$1:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const timestamp = Date.parse(normalized);
    const elapsedMs = Number(seconds) * 1000;
    const day = dateMatch ? new Date(`${dateMatch[1]}T00:00:00Z`) : null;
    if (!dateMatch || !Number.isFinite(timestamp) || !day || !Number.isFinite(day.getTime()) ||
        day.toISOString().slice(0, 10) !== dateMatch[1] || !Number.isSafeInteger(elapsedMs) ||
        rawLayout.length > 100 || rawPlayer.length > 200) { skipped++; continue; }
    const date = new Date(timestamp).toISOString();
    // GNOME's Turtle map uses the historical score name "easy".
    const layout = ['turtle', 'easy'].includes(rawLayout.toLowerCase()) ? 'turtle' : rawLayout;
    const key = JSON.stringify([date, layout, elapsedMs, rawPlayer]);
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    scores.push({ id: `gnome:${key}:${occurrence}`, date, layout, elapsedMs, player: rawPlayer,
      source: 'gnome', hints: null, shuffles: null });
  }
  return { scores, skipped };
}
