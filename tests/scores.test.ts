// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { parseGnomeHistory } from '../src/scores';

describe('GNOME history import', () => {
  it('reads old and new formats, names with spaces, CRLF, BOM and timezone offsets', () => {
    const parsed = parseGnomeHistory('\uFEFF2020-01-02T12:30:00+0300 easy 123\r\n2026-11-03T09:00:00.123456+01:00 difficult 432 Иван Петров\n2024-05-01T12:00:00+02 turtle 50\n');
    expect(parsed.skipped).toBe(0);
    expect(parsed.scores[0]).toMatchObject({ layout: 'turtle', elapsedMs: 123000, date: '2020-01-02T09:30:00.000Z', hints: null });
    expect(parsed.scores[1]).toMatchObject({ player: 'Иван Петров', layout: 'difficult', elapsedMs: 432000 });
    expect(parsed.scores[2].date).toBe('2024-05-01T10:00:00.000Z');
  });
  it('rejects invalid dates, durations and malformed rows while retaining good rows', () => {
    const parsed = parseGnomeHistory('garbage\n2026-02-30T12:00:00Z turtle 1\n2026-01-01T12:00:00Z turtle -1\n2026-01-01T12:00:00Z turtle 1.2\n2026-01-01T12:00:00Z turtle 9007199254740991\n2026-01-01T12:00:00Z turtle 0');
    expect(parsed.skipped).toBe(5);
    expect(parsed.scores).toHaveLength(1);
  });
  it('uses stable ids and preserves multiple identical records within a file', () => {
    const line = '2026-01-01T12:00:00Z turtle 120 Player';
    const first = parseGnomeHistory(`${line}\n${line}`).scores;
    expect(first[0].id).not.toBe(first[1].id);
    expect(parseGnomeHistory(`${line}\n${line}`).scores).toEqual(first);
  });
});
