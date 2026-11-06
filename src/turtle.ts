// SPDX-FileCopyrightText: 2026 John Morris
// SPDX-FileCopyrightText: 2026 Nephrite contributors
// SPDX-License-Identifier: MIT
// Adapted from Jarajara src/layouts.ts, commit a5a8928eedfcc35d8f1fc8bc9328f0486a62baf6.
// https://github.com/johnmorrisdotca/jarajara/blob/a5a8928eedfcc35d8f1fc8bc9328f0486a62baf6/src/layouts.ts
// MIT license: public/licenses/jarajara-LICENSE.txt.
// Changes: isolate Turtle, convert half-tile units to tile pitches, assign stable IDs.

type MahjongSlot = { x: number; y: number; z: number };

/** Tiles along one row: `from` to `to` inclusive, in whole tiles (two half units apart). */
function row(z: number, y: number, from: number, to: number): MahjongSlot[] {
  const slots: MahjongSlot[] = [];
  for (let x = from; x <= to; x += 2) slots.push({ x, y, z });
  return slots;
}

/** Single tiles at these half-unit columns. */
function at(z: number, y: number, ...xs: number[]): MahjongSlot[] {
  return xs.map((x) => ({ x, y, z }));
}

/** A block of whole rows. */
function block(z: number, y0: number, y1: number, from: number, to: number): MahjongSlot[] {
  const slots: MahjongSlot[] = [];
  for (let y = y0; y <= y1; y += 2) slots.push(...row(z, y, from, to));
  return slots;
}

// Keep the source literal order: existing saves and seeded deals use these IDs.
const TURTLE: MahjongSlot[] = [
  ...row(0, 0, 2, 24),
  ...row(0, 2, 6, 20),
  ...row(0, 4, 4, 22),
  ...row(0, 6, 2, 24),
  ...row(0, 8, 2, 24),
  ...row(0, 10, 4, 22),
  ...row(0, 12, 6, 20),
  ...row(0, 14, 2, 24),
  ...at(0, 7, 0, 26, 28),
  ...block(1, 2, 12, 8, 18),
  ...block(2, 4, 10, 10, 16),
  ...block(3, 6, 8, 12, 14),
  ...at(4, 7, 13),
];

export function turtleSlots(): { id: number; x: number; y: number; z: number }[] {
  return TURTLE.map(({ x, y, z }, id) => ({ id, x: x / 2, y: y / 2, z }));
}
