// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('preserves atlas coordinates and all 42 face mappings with independent bodies', () => {
  const current = readFileSync('public/themes/nephrite.svg', 'utf8');
  const cells = [...current.matchAll(/<use x="(\d+)" y="(\d+)" xlink:href="#body-(normal|selected)"\/>/g)]
    .map(match => [Number(match[1]), Number(match[2]), match[3]]);
  expect(cells).toEqual([0, 1].flatMap(row => Array.from({ length: 43 }, (_, col) =>
    [col * 64, row * 88, row ? 'selected' : 'normal'])));
  expect(current).toContain('viewBox="0 0 2752 176"');
  expect(current).toContain('width="56" height="80"');
  expect(current).toContain('SPDX-License-Identifier: MIT');
  expect(current).not.toContain('#bt1');
  expect(current).not.toContain('#bt2');
  expect([...current.matchAll(/<g id="face-(\d+)">/g)].map(match => Number(match[1])))
    .toEqual(Array.from({ length: 42 }, (_, i) => i));
});
