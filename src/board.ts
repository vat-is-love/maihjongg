// SPDX-License-Identifier: GPL-3.0-or-later
import { SLOTS, isFree, removedTiles, type Game, type Pair } from './game';
import { FACE_NAMES, TILE_HEIGHT, TILE_LAYER_X, TILE_LAYER_Y, TILE_PITCH_X, TILE_PITCH_Y, TILE_WIDTH, tileSprite } from './art';

const WIDTH = 896, HEIGHT = 704;
export class Board {
  private svg: SVGSVGElement;
  private tiles: SVGGElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private loadingImages = new Set<SVGImageElement>();
  private moved = false;
  private pressedTile: number | null = null;
  constructor(private host: HTMLElement, private onSelect: (id: number) => void) {
    host.innerHTML = `<svg class="board-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="group" aria-label="Игровое поле. Выбирайте пары свободных одинаковых костяшек."><g class="camera"><g class="tiles"></g></g></svg>`;
    this.svg = host.querySelector('svg')!;
    this.tiles = host.querySelector('.tiles')!;
    host.addEventListener('pointerdown', this.pointerDown);
    host.addEventListener('pointermove', this.pointerMove);
    host.addEventListener('pointerup', this.pointerUp);
    host.addEventListener('pointercancel', this.pointerCancel);
    this.svg.addEventListener('click', event => {
      // Physical pointers are handled directly. Keep synthetic accessibility clicks.
      if (event.detail !== 0 || this.loadingImages.size) return;
      const target = (event.target as Element).closest('[data-tile]');
      if (target) this.onSelect(Number(target.getAttribute('data-tile')));
    });
    this.svg.addEventListener('keydown', event => {
      if (this.loadingImages.size || (event.key !== 'Enter' && event.key !== ' ')) return;
      const target = (event.target as Element).closest('[data-tile]');
      if (target) { event.preventDefault(); this.onSelect(Number(target.getAttribute('data-tile'))); }
    });
  }

  render(game: Game, selected: number | null, hint: Pair | null, highlight: boolean): void {
    const removed = removedTiles(game);
    const variants = game.faces.map((face, id) => game.faces.slice(0, id).filter(f => f === face).length);
    const existing = new Map([...this.tiles.querySelectorAll<SVGSVGElement>('[data-tile]')]
      .map(tile => [Number(tile.dataset.tile), tile]));
    for (const s of [...SLOTS].sort((a, b) => a.z - b.z || (a.y - a.x) - (b.y - b.x) || a.x - b.x)) {
      let tile = existing.get(s.id);
      if (removed.has(s.id)) { tile?.remove(); continue; }
      const free = isFree(s.id, removed);
      if (!tile) {
        tile = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tile.dataset.tile = String(s.id);
        tile.setAttribute('x', String(24 + s.x * TILE_PITCH_X + s.z * TILE_LAYER_X));
        tile.setAttribute('y', String(24 + s.y * TILE_PITCH_Y - s.z * TILE_LAYER_Y));
        tile.setAttribute('width', String(TILE_WIDTH));
        tile.setAttribute('height', String(TILE_HEIGHT));
        tile.setAttribute('viewBox', `0 0 ${TILE_WIDTH} ${TILE_HEIGHT}`);
        tile.setAttribute('overflow', 'hidden');
        tile.setAttribute('role', 'button');
        // Restore removed tiles in the same stacking order when undoing.
        const next = [...this.tiles.children].find(other => {
          const slot = SLOTS[Number((other as SVGSVGElement).dataset.tile)];
          return slot.z > s.z || (slot.z === s.z && ((slot.y - slot.x) > (s.y - s.x) ||
            (slot.y - slot.x === s.y - s.x && slot.x > s.x)));
        });
        this.tiles.insertBefore(tile, next ?? null);
      }
      const spriteKey = `${game.faces[s.id]}:${variants[s.id]}`;
      if (tile.dataset.sprite !== spriteKey) {
        tile.innerHTML = `<title>${FACE_NAMES[game.faces[s.id]]}</title>
          ${tileSprite(game.faces[s.id], variants[s.id])}
          <polygon class="tile-hitbox" points="9,0 ${TILE_WIDTH},0 ${TILE_WIDTH},79 55,${TILE_HEIGHT} 0,${TILE_HEIGHT} 0,9" fill="transparent" pointer-events="all"/>
          <path class="tile-outline" d="M10 1H62V78H10Z"/>`;
        for (const image of tile.querySelectorAll<SVGImageElement>('image')) {
          this.loadingImages.add(image);
          const ready = () => { this.loadingImages.delete(image); this.updateReadiness(); };
          image.addEventListener('load', ready, { once: true });
          image.addEventListener('error', ready, { once: true });
        }
        tile.dataset.sprite = spriteKey;
      }
      tile.setAttribute('class', ['tile', free ? 'free' : 'blocked', selected === s.id ? 'selected' : '',
        hint?.includes(s.id) ? 'hinted' : '', highlight && !free ? 'dimmed' : ''].join(' '));
      tile.setAttribute('tabindex', free ? '0' : '-1');
      tile.setAttribute('aria-disabled', String(!free));
      tile.setAttribute('aria-pressed', String(selected === s.id));
      tile.setAttribute('aria-label', `${FACE_NAMES[game.faces[s.id]]}${free ? ', свободна' : ', закрыта'}`);
    }
    for (const image of this.loadingImages) if (!this.svg.contains(image)) this.loadingImages.delete(image);
    this.updateReadiness();
  }

  private updateReadiness() {
    const loading = this.loadingImages.size > 0;
    this.host.classList.toggle('art-loading', loading);
    this.host.setAttribute('aria-busy', String(loading));
  }

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.loadingImages.size) return;
    const target = (event.target as Element).closest('[data-tile]');
    if (event.pointerType === 'mouse' && event.button === 0 && target) {
      // A moving mouse should select on press, never become a touch-pan gesture.
      event.preventDefault();
      this.onSelect(Number(target.getAttribute('data-tile')));
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.moved = false;
      this.pressedTile = target && event.pointerType !== 'mouse' ? Number(target.getAttribute('data-tile')) : null;
    }
    if (this.pointers.size > 1) this.moved = true;
    // Capture on the stable host, which remains present throughout touch gestures.
    this.host.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    const origin = this.pointers.get(event.pointerId);
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) this.moved = true;
  };
  private pointerUp = (event: PointerEvent) => {
    if (!this.pointers.has(event.pointerId)) return;
    const tappedTile = !this.moved && this.pointers.size === 1 ? this.pressedTile : null;
    this.pointers.delete(event.pointerId);
    if (tappedTile !== null) this.onSelect(tappedTile);
  };
  private pointerCancel = (event: PointerEvent) => { this.moved = true; this.pointerUp(event); };
}
