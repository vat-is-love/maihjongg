// SPDX-License-Identifier: GPL-3.0-or-later
import { getLayout, layoutId, isFree, removedTiles, type Game, type Pair } from './game';
import { FACE_NAMES, TILE_HEIGHT, TILE_LAYER_X, TILE_LAYER_Y, TILE_PITCH_X, TILE_PITCH_Y, TILE_WIDTH, tileSprite } from './art';

const WIDTH = 896, HEIGHT = 704;
function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
export class Board {
  private layout = '';
  private drawOrder: ReturnType<typeof getLayout>['slots'] = [];
  private drawRank = new Map<number, number>();
  private svg: SVGSVGElement;
  private tiles: SVGGElement;
  private tileElements = new Map<number, SVGSVGElement>();
  private selected: number | null = null;
  private hint: Pair | null = null;
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
    const layout = layoutId(game);
    if (this.layout !== layout) {
      this.layout = layout;
      this.tiles.replaceChildren(); this.tileElements.clear(); this.loadingImages.clear();
      this.drawOrder = [...getLayout(layout).slots].sort((a, b) => a.z - b.z || (a.y - a.x) - (b.y - b.x) || a.x - b.x);
      this.drawRank = new Map(this.drawOrder.map((slot, rank) => [slot.id, rank]));
      const xs = this.drawOrder.map(s => 24 + s.x * TILE_PITCH_X + s.z * TILE_LAYER_X);
      const ys = this.drawOrder.map(s => 24 + s.y * TILE_PITCH_Y - s.z * TILE_LAYER_Y);
      this.svg.setAttribute('viewBox', `${Math.min(...xs)-16} ${Math.min(...ys)-16} ${Math.max(...xs)-Math.min(...xs)+TILE_WIDTH+32} ${Math.max(...ys)-Math.min(...ys)+TILE_HEIGHT+32}`);
    }
    const removed = removedTiles(game);
    const counts = new Map<number, number>();
    const variants = game.faces.map(face => {
      const variant = counts.get(face) ?? 0;
      counts.set(face, variant + 1);
      return variant;
    });
    for (const s of this.drawOrder) {
      let tile = this.tileElements.get(s.id);
      if (removed.has(s.id)) { tile?.remove(); this.tileElements.delete(s.id); continue; }
      const free = isFree(s.id, removed, layout);
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
        const next = [...this.tiles.children].find(other =>
          this.drawRank.get(Number((other as SVGSVGElement).dataset.tile))! > this.drawRank.get(s.id)!);
        this.tiles.insertBefore(tile, next ?? null);
        this.tileElements.set(s.id, tile);
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
      setAttribute(tile, 'class', ['tile', free ? 'free' : 'blocked', selected === s.id ? 'selected' : '',
        hint?.includes(s.id) ? 'hinted' : '', highlight && !free ? 'dimmed' : ''].filter(Boolean).join(' '));
      setAttribute(tile, 'tabindex', free ? '0' : '-1');
      setAttribute(tile, 'aria-disabled', String(!free));
      setAttribute(tile, 'aria-pressed', String(selected === s.id));
      setAttribute(tile, 'aria-label', `${FACE_NAMES[game.faces[s.id]]}${free ? ', свободна' : ', закрыта'}`);
    }
    this.selected = selected;
    this.hint = hint ? [...hint] : null;
    for (const image of this.loadingImages) if (!this.svg.contains(image)) this.loadingImages.delete(image);
    this.updateReadiness();
  }

  // Selection does not change geometry, free tiles or the toolbar. Touch only
  // the previous/new selection and hints, keeping the rest of the SVG untouched.
  updateSelection(selected: number | null, hint: Pair | null): void {
    const affected = new Set([this.selected, selected, ...(this.hint ?? []), ...(hint ?? [])]);
    for (const id of affected) {
      if (id === null) continue;
      const tile = this.tileElements.get(id);
      if (!tile) continue;
      if (tile.classList.contains('selected') !== (id === selected)) tile.classList.toggle('selected', id === selected);
      const hinted = hint?.includes(id) ?? false;
      if (tile.classList.contains('hinted') !== hinted) tile.classList.toggle('hinted', hinted);
      setAttribute(tile, 'aria-pressed', String(id === selected));
    }
    this.selected = selected;
    this.hint = hint ? [...hint] : null;
  }

  private updateReadiness() {
    const loading = this.loadingImages.size > 0;
    if (this.host.classList.contains('art-loading') !== loading) this.host.classList.toggle('art-loading', loading);
    setAttribute(this.host, 'aria-busy', String(loading));
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
