// SPDX-FileCopyrightText: 2026 Nephrite contributors
// SPDX-License-Identifier: GPL-3.0-or-later
import { t, getLanguage, setLanguage, isLanguage, type Language } from './i18n';
import './style.css';
import { LAYOUTS, isMobileLayout, nextMobileLayout, getLayout, layoutId, availablePairs, isFree, redo, removedTiles, removePair, undo, type Game, type Pair } from './game';
import { Board } from './board';
import { GameEngine } from './game-engine';
import { FullscreenController } from './fullscreen';
import { icon, isTileTheme, TILE_THEMES } from './art';
import { DEFAULT_SETTINGS, DEFAULT_STATS, importScores, loadScores, loadSession, saveSession, type Settings } from './storage';
import { parseGnomeHistory, type Score } from './scores';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
setLanguage('ru');
$('#app').innerHTML = `
  <main>
    <section class="game-shell" aria-label="${t("Маджонг")}">
      <button id="toggle-controls" class="icon-button on-felt controls-toggle" aria-label="${t("Показать управление")}" title="${t("Показать управление")}" aria-expanded="false" aria-controls="game-controls game-toolbar">${icon('menu')}</button>
      <div class="game-topbar" id="game-controls">
        <div class="progress-stat"><span class="stat-label">${t("ОСТАЛОСЬ")}</span><strong><span id="remaining">144</span><span class="stat-total"> / 144</span></strong><div class="progress-track"><span id="progress"></span></div></div>
        <div class="pair-stat"><span class="stat-label">${t("ДОСТУПНО ПАР")}</span><strong id="pairs">—</strong></div>
        <div class="time-stat"><span class="stat-label">${t("ВРЕМЯ")}</span><strong id="timer">00:00</strong></div>
        <button id="pause" class="icon-button on-felt" aria-label="${t("Пауза")}" title="${t("Пауза")}">${icon('pause', 18)}</button>
        <details class="game-menu" id="game-menu">
          <summary class="icon-button on-felt" aria-label="${t("Меню игры")}" title="${t("Меню игры")}">${icon('menu')}</summary>
          <nav class="game-menu-panel" aria-label="${t("Меню игры")}">
            <button id="new-game">${icon('plus', 18)} ${t("Новая игра")}</button>
            <label class="layout-choice" for="layout">${t("Раскладка")}<select id="layout"><option value="mobile-random">${t("Мобильный режим · случайные поля")}</option>${LAYOUTS.map(l => `<option value="${l.id}">${t(l.name)} · ${l.slots.length} ${t("плиток")}</option>`).join('')}</select><small>${t("Выберите и нажмите «Новая игра».")}</small></label>
            <button id="hint">${icon('hint', 18)} ${t("Подсказка")}</button>
            <button id="scores">${icon('trophy', 18)} ${t("Рекорды")}</button>
            <button id="settings">${icon('settings', 18)} ${t("Настройки")}</button>
            <hr>
            <button id="rules">${icon('help', 18)} ${t("Как играть")}</button>
            <button id="about">${t("Об игре")}</button>
            <a id="license" href="./LICENSE.txt" target="_blank" rel="noopener">${t("Лицензия GPLv3+")}</a>
            <button id="install" hidden>${icon('download', 18)} ${t("Установить")}</button>
          </nav>
        </details>
      </div>
      <div class="board-wrap">
        <div class="felt-decoration" aria-hidden="true">${icon('leaf', 240)}</div>
        <div id="board" class="board"></div>
        <div id="board-overlay" class="board-overlay" hidden></div>
        <button id="fullscreen" class="icon-button on-felt fullscreen-button" aria-label="${t("На весь экран")}" title="${t("На весь экран")}" aria-pressed="false">${icon('fullscreen', 17)}</button>
      </div>
      <div class="game-toolbar" id="game-toolbar">
        <div class="undo-group"><button id="undo" class="tool-button" title="${t("Отменить ход (Ctrl+Z)")}">${icon('undo')}<span>${t("Назад")}</span></button><button id="redo" class="tool-button" title="${t("Повторить ход (Ctrl+Shift+Z)")}">${icon('redo')}<span>${t("Вперёд")}</span></button></div>
        <div class="assist-group"><button id="shuffle" class="tool-button">${icon('shuffle')}<span>${t("Перемешать")}</span></button></div>
      </div>
    </section>
    <div class="under-board"><p id="status" role="status" aria-live="polite">${t("Выберите свободную костяшку, затем такую же.")}</p><span id="save-indicator" class="save-indicator">${icon('check', 14)} ${t("Сохраняется на устройстве")}</span></div>
    <div id="update-notice" class="notice" hidden>${t("Есть новая версия игры.")} <button id="update-app" class="text-button">${t("Обновить")}</button></div>
    <div id="storage-warning" class="notice warning" role="alert" hidden></div>

  </main>
  <dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><h2 id="dialog-title"></h2><button id="close-dialog" class="icon-button" aria-label="${t("Закрыть")}">${icon('close')}</button></div><div id="dialog-content"></div></dialog>
`;

// Keep source labels for the static shell so switching language preserves controls and focus.
const staticLabels: Array<() => void> = [];
const walker = document.createTreeWalker($('#app'), NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode;
  const source = node.textContent ?? '';
  if (/[А-Яа-яЁё]/.test(source) && node.parentElement?.tagName !== 'OPTION') {
    staticLabels.push(() => { if (node.isConnected) node.textContent = source.replace(source.trim(), t(source.trim())); });
  }
}
for (const element of $('#app').querySelectorAll('[aria-label], [title]')) {
  for (const attribute of ['aria-label', 'title']) {
    const source = element.getAttribute(attribute);
    if (source) staticLabels.push(() => element.setAttribute(attribute, t(source)));
  }
}

const engine = new GameEngine();
if (import.meta.hot) import.meta.hot.dispose(() => engine.dispose());
let game: Game;
let settings: Settings = { ...DEFAULT_SETTINGS };
let stats = structuredClone(DEFAULT_STATS);
let selected: number | null = null;
let hint: Pair | null = null;
let hintIndex = 0;
let noMovesNotice: string | null = null;
let started = false;
let paused = false;
let busy = false;
let saveQueue = Promise.resolve();
let previousTick = performance.now();
let saveCounter = 0;
let storageWorks = true;
const dialog = $<HTMLDialogElement>('#dialog');
const board = new Board($('#board'), selectTile);
const gameMenu = $<HTMLDetailsElement>('#game-menu');
function closeMenu() { gameMenu.open = false; }
gameMenu.addEventListener('click', event => {
  if ((event.target as Element).closest('.game-menu-panel button, .game-menu-panel a')) closeMenu();
});
document.addEventListener('click', event => {
  if (!gameMenu.contains(event.target as Node)) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && gameMenu.open) {
    closeMenu();
    gameMenu.querySelector('summary')!.focus();
  }
});
const shell = $<HTMLElement>('.game-shell');
const controlsToggle = $<HTMLButtonElement>('#toggle-controls');
function setControlsOpen(open: boolean) {
  shell.classList.toggle('controls-open', open);
  controlsToggle.setAttribute('aria-expanded', String(open));
  const label = open ? t("Скрыть управление") : t("Показать управление");
  controlsToggle.setAttribute('aria-label', label);
  controlsToggle.title = label;
  controlsToggle.innerHTML = icon(open ? 'close' : 'menu');
  if (!open) closeMenu();
}
controlsToggle.addEventListener('click', () => setControlsOpen(!shell.classList.contains('controls-open')));
$('#board').addEventListener('pointerdown', () => setControlsOpen(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && shell.classList.contains('controls-open')) {
    setControlsOpen(false);
    controlsToggle.focus();
  }
});
const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const complete = () => game.history.length * 2 === game.faces.length;
const status = (message: string) => { $('#status').textContent = message; };

function updateClock() {
  const now = performance.now();
  if (game && started && !paused && !busy && !dialog.open && !document.querySelector('#language-dialog[open]') && !document.hidden && !complete()) game.elapsedMs += now - previousTick;
  previousTick = now;
  if (game) $('#timer').textContent = formatTime(game.elapsedMs);
}
function storageError() {
  storageWorks = false;
  $('#save-indicator').textContent = t("Сохранение недоступно");
  const warning = $('#storage-warning');
  warning.hidden = false;
  warning.textContent = t("Браузер не смог сохранить партию. Можно играть, но после закрытия страницы прогресс может потеряться. Проверьте свободное место и разрешение на хранение данных.");
}
function persist() {
  if (!game) return;
  game.savedAt = Date.now();
  const snapshot = structuredClone(game);
  const preferences = { ...settings };
  saveQueue = saveQueue.then(async () => {
    try {
      stats = await saveSession(snapshot, preferences);
      storageWorks = true;
      $('#storage-warning').hidden = true;
      $('#save-indicator').innerHTML = `${icon('check', 14)} ${t("Партия сохранена")}`;
    } catch { storageError(); }
  });
}
function render() {
  const total = game.faces.length;
  const remaining = total - game.history.length * 2;
  const pairs = availablePairs(game);
  const locked = paused || busy || complete() || !!document.querySelector('#language-dialog[open]');
  const stalled = remaining > 0 && pairs.length === 0;
  shell.classList.toggle('compact-layout', isMobileLayout(getLayout(layoutId(game))));
  $('#remaining').textContent = String(remaining);
  $('.stat-total').textContent = ` / ${total}`;
  $('#pairs').textContent = String(pairs.length);
  $('#progress').style.width = `${(total - remaining) / total * 100}%`;
  $('#timer').textContent = formatTime(game.elapsedMs);
  $<HTMLButtonElement>('#undo').disabled = !game.history.length || busy || paused;
  $<HTMLButtonElement>('#redo').disabled = !game.redo.length || locked;
  $<HTMLButtonElement>('#hint').disabled = !pairs.length || locked;
  $<HTMLButtonElement>('#shuffle').disabled = locked;
  $<HTMLButtonElement>('#pause').disabled = busy || complete();
  $('#pause').innerHTML = icon(paused ? 'play' : 'pause', 18);
  $('#pause').setAttribute('aria-label', paused ? t("Продолжить") : t("Пауза"));
  $('#pause').setAttribute('title', paused ? t("Продолжить") : t("Пауза"));
  board.render(game, selected, hint, settings.highlightFree, settings.theme);
  $('#board').setAttribute('inert', '');
  if (!locked && !dialog.open) $('#board').removeAttribute('inert');
  const overlay = $('#board-overlay');
  overlay.hidden = !locked && !stalled;
  $('#board').classList.toggle('concealed', paused);
  if (busy) overlay.innerHTML = `<div class="overlay-card"><span class="spinner"></span><h2>${t("Раскладываем костяшки")}</h2><p>${t("Готовим партию с решением…")}</p></div>`;
  else if (paused) overlay.innerHTML = `<div class="overlay-card"><span class="overlay-icon">${icon('leaf', 34)}</span><h2>${t("Пауза")}</h2><p>${t("Таймер остановлен.")}</p><button class="button cream" id="resume-game">${icon('play', 18)} ${t("Продолжить")}</button></div>`;
  else if (complete()) overlay.innerHTML = `<div class="overlay-card victory"><span class="overlay-icon">${icon('trophy', 36)}</span><div class="eyebrow">${t("ВСЕ ПАРЫ НАЙДЕНЫ")}</div><h2>${t("Партия завершена")}</h2><p>${formatTime(game.elapsedMs)} ${t("· Подсказок:")} ${game.hints} ${t("· Перемешиваний:")} ${game.shuffles}</p><button class="button cream" id="play-again">${icon('plus', 18)} ${settings.mobileMode ? t("Следующая раскладка") : t("Ещё одна партия")}</button></div>`;
  else if (stalled) overlay.innerHTML = `<div class="overlay-card"><h2>${t("Доступных пар больше нет")}</h2><p>${t("Можно перемешать поле, отменить ход или начать новую игру.")}</p><button class="button cream" id="continue-stalled">${t("Как продолжить?")}</button></div>`;
  else overlay.replaceChildren();
  if (!stalled) noMovesNotice = null;
  if (!locked && stalled) {
    status(t("Доступных пар больше нет. Перемешайте костяшки, повторите раскладку или начните новую игру."));
    const position = JSON.stringify([game.id, game.history, game.shuffles]);
    if (!dialog.open && noMovesNotice !== position) {
      noMovesNotice = position;
      showNoMoves();
    }
  }
  document.body.classList.toggle('reduce-motion', settings.reducedMotion);
  document.body.classList.toggle('simple-effects', settings.simpleEffects);
}
function selectTile(id: number) {
  if (paused || busy || dialog.open || document.querySelector('#language-dialog[open]') || complete()) return;
  if (!isFree(id, removedTiles(game), layoutId(game))) { status(t("Эта костяшка закрыта. Сверху должно быть пусто, а слева или справа — свободно.")); return; }
  updateClock(); started = true;
  if (selected === id) { selected = null; hint = null; board.updateSelection(selected, hint); return; }
  if (selected !== null && removePair(game, selected, id)) {
    selected = null; hint = null; hintIndex = 0;
    status(complete() ? t("Все костяшки убраны. Поздравляем!") : t("Пара найдена."));
    render(); persist();
    return;
  }
  if (selected !== null) status(t("Это разные костяшки. Найдите пару к выбранной."));
  else status(t("Теперь выберите такую же свободную костяшку."));
  selected = id; hint = null; board.updateSelection(selected, hint);
}
function showDialog(title: string, content: string) {
  setControlsOpen(false);
  updateClock();
  $('#dialog-title').textContent = title;
  $('#dialog-content').innerHTML = content;
  if (!dialog.open) dialog.showModal();
  $('#board').setAttribute('inert', '');
  persist();
}
function closeDialog() { dialog.close(); previousTick = performance.now(); render(); }
$('#close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX) {
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
} });

async function createGame(seed?: number, choice = seed !== undefined ? layoutId(game) : settings.mobileMode ? 'mobile-random' : layoutId(game)) {
  if (busy) return;
  const mobileMode = seed !== undefined ? settings.mobileMode : choice === 'mobile-random';
  const layout = choice === 'mobile-random' ? nextMobileLayout(layoutId(game)) : choice;
  setControlsOpen(false);
  updateClock(); busy = true; paused = false; selected = null; hint = null;
  if (dialog.open) dialog.close();
  if (game) render();
  await new Promise(resolve => setTimeout(resolve, 30));
  try {
    const generated = await engine.run({ kind: 'generate', seed, layout });
    if (!generated) throw new Error(t("Не удалось подготовить раскладку. Попробуйте ещё раз."));
    game = generated;
    settings.mobileMode = mobileMode;
    $<HTMLSelectElement>('#layout').value = mobileMode ? 'mobile-random' : layout; started = false; hintIndex = 0;
    status(`${t(getLayout(layout).name)}: ${game.faces.length} ${t("плиток. У партии есть решение.")}`);
  } catch (error) { status(error instanceof Error ? t(error.message) : t("Не удалось начать игру.")); }
  busy = false; previousTick = performance.now(); render(); persist();
}
function requestNewGame() {
  if (busy) return;
  const layout = $<HTMLSelectElement>('#layout').value;
  if (complete() || (!game.history.length && game.elapsedMs === 0)) { void createGame(undefined, layout); return; }
  const description = layout === 'mobile-random' ? t("случайное компактное поле") : `${t(getLayout(layout).name)}, ${getLayout(layout).slots.length} ${t("плиток")}`;
  showDialog(t("Начать новую партию?"), `<p>${t("Текущая партия будет заменена новой решаемой раздачей:")} ${description}.</p><div class="dialog-actions"><button id="cancel-new" class="button secondary">${t("Продолжить текущую")}</button><button id="confirm-new" class="button primary">${t("Новая игра")}</button></div>`);
  $('#cancel-new').addEventListener('click', closeDialog);
  $('#confirm-new').addEventListener('click', () => void createGame(undefined, layout));
}
function doUndo() {
  if (busy || paused || dialog.open) return;
  updateClock();
  if (!undo(game)) return;
  selected = null; hint = null; hintIndex = 0;
  status(t("Последняя пара возвращена на поле.")); render(); persist();
}
function doRedo() {
  if (busy || paused || dialog.open) return;
  updateClock();
  if (!redo(game)) return;
  selected = null; hint = null; hintIndex = 0;
  status(complete() ? t("Все пары найдены. Поздравляем!") : t("Ход повторён.")); render(); persist();
}
$('#new-game').addEventListener('click', requestNewGame);
$('#undo').addEventListener('click', doUndo);
$('#redo').addEventListener('click', doRedo);
$('#hint').addEventListener('click', () => {
  if (busy || paused || complete()) return;
  const pairs = availablePairs(game);
  if (!pairs.length) return;
  updateClock(); started = true;
  hint = pairs[hintIndex++ % pairs.length]; selected = null; game.hints++;
  status(t("Подсвечена доступная пара. Подсказка показывает ход, но не гарантирует победу."));
  render(); persist();
});
$('#shuffle').addEventListener('click', () => {
  showDialog(t("Перемешать костяшки?"), `<p>${t("Оставшиеся костяшки получат новую решаемую расстановку рисунков. Уже снятые пары останутся снятыми.")}</p><div class="dialog-actions"><button id="cancel-shuffle" class="button secondary">${t("Отмена")}</button><button id="confirm-shuffle" class="button primary">${t("Перемешать")}</button></div>`);
  $('#cancel-shuffle').addEventListener('click', closeDialog);
  $('#confirm-shuffle').addEventListener('click', () => void doShuffle());
});
async function doShuffle() {
  if (busy) return;
  updateClock(); busy = true; selected = null; hint = null; hintIndex = 0;
  if (dialog.open) dialog.close();
  render();
  await new Promise(resolve => setTimeout(resolve, 30));
  let success = false;
  let failure: string | undefined;
  try {
    const shuffled = await engine.run({ kind: 'shuffle', game });
    if (shuffled) { Object.assign(game, shuffled); success = true; }
  } catch (error) { failure = error instanceof Error ? t(error.message) : t("Не удалось перемешать поле."); }
  finally { busy = false; previousTick = performance.now(); }
  status(success ? t("Костяшки перемешаны. Для оставшегося поля есть решение.") : t("Для этой позиции не удалось найти раздачу. Отмените несколько ходов или начните раскладку заново."));
  render(); persist();
  if (!success) {
    showNoMoves();
    $('#dialog-content p').textContent = (failure ? `${failure} ` : '') + t("Не удалось перемешать эту позицию. Можно закрыть меню и отменить несколько ходов, повторить раскладку или начать новую игру.");
  }
}
function showNoMoves() {
  showDialog(t("Доступных ходов больше нет"), `<p>${t("На поле не осталось свободных одинаковых пар. Как продолжим?")}</p>
    <div class="dialog-actions no-moves-actions">
      <button id="no-moves-shuffle" class="button secondary">${icon('shuffle', 18)} ${t("Перемешать текущую раскладку")}</button>
      <button id="no-moves-restart" class="button secondary">${icon('redo', 18)} ${t("Начать раскладку сначала")}</button>
      <button id="no-moves-new" class="button primary">${icon('plus', 18)} ${t("Начать новую игру")}</button>
    </div>`);
  $('#no-moves-shuffle').addEventListener('click', () => void doShuffle());
  $('#no-moves-restart').addEventListener('click', () => void createGame(game.seed));
  $('#no-moves-new').addEventListener('click', () => void createGame());
}

function togglePause() { updateClock(); paused = !paused; selected = null; hint = null; render(); persist(); }
$('#pause').addEventListener('click', togglePause);
$('#board-overlay').addEventListener('click', event => {
  if ((event.target as Element).closest('#resume-game')) togglePause();
  if ((event.target as Element).closest('#play-again')) void createGame();
  if ((event.target as Element).closest('#continue-stalled')) showNoMoves();
});
const fullscreen = new FullscreenController($('.game-shell'), $<HTMLButtonElement>('#fullscreen'));

$('#rules').addEventListener('click', () => showDialog(t("Как играть"), `
  <p class="dialog-lead">${t("Уберите с поля все костяшки, находя одинаковые пары.")}</p>
  <ol class="rules-list"><li><strong>${t("Найдите свободную костяшку.")}</strong> ${t("Над ней нет другой, а хотя бы одна сторона — левая или правая — открыта.")}</li><li><strong>${t("Выберите такую же.")}</strong> ${t("Нажмите на обе костяшки, чтобы убрать пару.")}</li><li><strong>${t("Смотрите на следующие ходы.")}</strong> ${t("Каждая новая раздача имеет решение, но не любой порядок ходов ведёт к победе.")}</li></ol>
  <div class="tip">${icon('hint')}<p>${t("«Подсказка» выделяет доступную пару. Если пар нет, отмените ход или перемешайте поле.")}</p></div>
  <p>${t("Все цветы можно соединять с любыми цветами, а времена года — с любыми временами года, даже если рисунки разные.")}</p>
  <p>${t("Кнопка")} ${icon('fullscreen', 16)} ${t("разворачивает игру на весь экран. Для выхода нажмите её снова или Esc.")}</p>
  <p class="muted">${t("Клавиатура: Tab и Enter — выбор костяшек; Ctrl+Z — отмена; Ctrl+Shift+Z — повтор. Во время паузы и в меню часы остановлены.")}</p>
`));
function applyLanguage(language: Language) {
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t('Маджонг');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('Маджонг-пасьянс.'));
  for (const update of staticLabels) update();
  const layout = $<HTMLSelectElement>('#layout');
  layout.options[0].textContent = t('Мобильный режим · случайные поля');
  for (const item of LAYOUTS) layout.querySelector(`option[value="${item.id}"]`)!.textContent = `${t(item.name)} · ${item.slots.length} ${t('плиток')}`;
  setControlsOpen(shell.classList.contains('controls-open'));
  fullscreen.refreshLabels();
  status(t('Выберите свободную костяшку, затем такую же.'));
  if (!storageWorks) storageError();
}

async function chooseInitialLanguage(): Promise<void> {
  const picker = document.createElement('dialog');
  picker.id = 'language-dialog';
  picker.setAttribute('aria-labelledby', 'language-title');
  picker.innerHTML = `<h2 id="language-title"><span lang="ru">Выберите язык</span><br><span lang="en">Choose your language</span></h2>
    <div class="language-options"><button class="button primary" data-language="ru" lang="ru">Русский</button><button class="button secondary" data-language="en" lang="en">English</button></div>`;
  document.body.append(picker);
  picker.addEventListener('cancel', event => event.preventDefault());
  picker.showModal();
  render();
  await new Promise<void>(resolve => {
    picker.addEventListener('click', event => {
      const value = (event.target as Element).closest<HTMLButtonElement>('[data-language]')?.dataset.language;
      if (!isLanguage(value)) return;
      settings.language = value;
      applyLanguage(value);
      picker.close(); picker.remove();
      resolve();
    });
  });
}

function showSettings() {
  showDialog(t("Настройки"), `
    <div class="settings-row"><label for="language"><strong>${t('Язык')}</strong><small>${t('Язык интерфейса')}</small></label><select id="language"><option value="ru" lang="ru" ${settings.language === 'ru' ? 'selected' : ''}>Русский</option><option value="en" lang="en" ${settings.language === 'en' ? 'selected' : ''}>English</option></select></div>
    <div class="settings-row"><label for="tile-theme"><strong>${t("Тема костяшек")}</strong><small>${t("Рисунки на игровом поле")}</small></label><select id="tile-theme">${TILE_THEMES.map(theme => `<option value="${theme.id}" ${settings.theme === theme.id ? 'selected' : ''}>${t(theme.name)}</option>`).join('')}</select></div>
    <div class="settings-row"><label for="highlight"><strong>${t("Подсвечивать свободные")}</strong><small>${t("Приглушить закрытые костяшки")}</small></label><input id="highlight" type="checkbox" ${settings.highlightFree ? 'checked' : ''}/></div>
    <div class="settings-row"><label for="motion"><strong>${t("Меньше движения")}</strong><small>${t("Убрать анимацию подсказок")}</small></label><input id="motion" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}/></div>
    <div class="settings-row"><label for="simple-effects"><strong>${t("Упростить графику")}</strong><small>${t("Убрать фильтры, размытие и тени")}</small></label><input id="simple-effects" type="checkbox" ${settings.simpleEffects ? 'checked' : ''}/></div>
    <div class="personal-stats"><div><span>${t("Завершено партий")}</span><strong>${stats.wins}</strong></div><div><span>${t("Лучшее время")}</span><strong>${stats.bestMs === null ? '—' : formatTime(stats.bestMs)}</strong></div></div>
    <p class="muted">${t("Результаты включают партии с подсказками и перемешиванием. Партия и настройки хранятся только в IndexedDB этого браузера. Очистка данных сайта удалит их.")}</p>
    <button id="restart" class="button secondary full-width">${t("Начать эту раздачу заново")}</button>
  `);
  $('#language').addEventListener('change', event => {
    const language = (event.target as HTMLSelectElement).value;
    if (!isLanguage(language)) return;
    settings.language = language;
    applyLanguage(language);
    render(); persist(); showSettings();
    $('#language').focus();
  });
  $('#tile-theme').addEventListener('change', event => {
    const theme = (event.target as HTMLSelectElement).value;
    if (isTileTheme(theme)) { settings.theme = theme; render(); persist(); }
  });
  $('#highlight').addEventListener('change', event => { settings.highlightFree = (event.target as HTMLInputElement).checked; render(); persist(); });
  $('#simple-effects').addEventListener('change', event => { settings.simpleEffects = (event.target as HTMLInputElement).checked; render(); persist(); });
  $('#motion').addEventListener('change', event => { settings.reducedMotion = (event.target as HTMLInputElement).checked; render(); persist(); });
  $('#restart').addEventListener('click', () => {
    showDialog(t("Повторить раздачу?"), `<p>${t("Рисунки вернутся на исходные места. Время и история ходов будут сброшены.")}</p><div class="dialog-actions"><button id="cancel-restart" class="button secondary">${t("Отмена")}</button><button id="confirm-restart" class="button primary">${t("Начать заново")}</button></div>`);
    $('#cancel-restart').addEventListener('click', closeDialog);
    $('#confirm-restart').addEventListener('click', () => void createGame(game.seed));
  });
}
$('#settings').addEventListener('click', showSettings);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
async function showScores() {
  showDialog(t("Рекорды партий"), `
    <p>${t("Победы по возрастанию времени. Рекорды хранятся только в этом браузере.")}</p>
    <label class="score-filter">${t("Раскладка")} <select id="score-layout"><option value="">${t("Все раскладки")}</option></select></label>
    <div id="score-list" aria-live="polite">${t("Загрузка…")}</div>
    <button id="more-scores" class="button secondary full-width" hidden>${t("Показать ещё 50")}</button>
    <h3>${t("Импорт из GNOME Mahjongg")}</h3>
    <p>${t("Выберите текстовый файл")} <code>history</code>${t(". Поддерживаются старый формат и новый с именем игрока. Повторный импорт того же файла не добавляет дубликаты.")}</p>
    <label class="score-file">${t("Файл рекордов")} <input id="score-file" type="file" /></label>
    <p id="import-result" role="status"></p>
    <p class="muted">${t("GNOME не записывает число подсказок и перемешиваний: для импортированных результатов эти значения неизвестны. Счётчики в настройках относятся к победам в этой игре. Старые победы до появления списка не имеют подробных записей.")}</p>
  `);
  const list = $('#score-list');
  const layout = $<HTMLSelectElement>('#score-layout');
  const more = $<HTMLButtonElement>('#more-scores');
  const result = $('#import-result');
  let scores: Score[] = [];
  let limit = 50;
  const draw = () => {
    const filtered = scores.filter(score => !layout.value || score.layout === layout.value)
      .sort((a, b) => a.elapsedMs - b.elapsedMs || b.date.localeCompare(a.date));
    list.innerHTML = filtered.length ? `<p class="muted">${t("Всего:")} ${filtered.length}</p><ol class="score-list">${filtered.slice(0, limit).map(score =>
      `<li><strong>${formatTime(score.elapsedMs)}</strong><span>${escapeHtml(t(LAYOUTS.find(l => l.id === score.layout)?.name ?? score.layout))} · ${escapeHtml(new Date(score.date).toLocaleString(getLanguage() === 'en' ? 'en-GB' : 'ru-RU'))}</span><small>${score.source === 'local' ? `${t("Подсказок:")} ${score.hints} ${t("· Перемешиваний:")} ${score.shuffles}` : `GNOME${score.player ? ` · ${escapeHtml(score.player)}` : ''}`}</small></li>`).join('')}</ol>`
      : `<p>${t("Пока нет записей. Завершите партию или импортируйте рекорды GNOME.")}</p>`;
    more.hidden = filtered.length <= limit;
  };
  const refresh = async () => {
    await saveQueue;
    scores = await loadScores();
    const selectedLayout = layout.value;
    layout.innerHTML = `<option value="">${t("Все раскладки")}</option>` + [...new Set(scores.map(score => score.layout))].sort()
      .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(t(LAYOUTS.find(l => l.id === name)?.name ?? name))}</option>`).join('');
    layout.value = selectedLayout;
    draw();
  };
  layout.addEventListener('change', () => { limit = 50; draw(); });
  more.addEventListener('click', () => { limit += 50; draw(); });
  $<HTMLInputElement>('#score-file').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.disabled = true;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(t("Размер файла должен быть не больше 2 МБ."));
      const parsed = parseGnomeHistory(await file.text());
      if (!parsed.scores.length) throw new Error(`${t("Записи GNOME не найдены. Пропущено строк:")} ${parsed.skipped}${t(". Выберите текстовый файл history.")}`);
      const added = await importScores(parsed.scores);
      await refresh();
      result.textContent = `${t("Добавлено:")} ${added}${t(". Уже в списке:")} ${parsed.scores.length - added}${t(". Некорректных строк:")} ${parsed.skipped}.`;
    } catch (error) { result.textContent = error instanceof Error ? t(error.message) : t("Не удалось импортировать рекорды. Проверьте доступ к хранилищу браузера."); }
    finally { input.disabled = false; input.value = ''; }
  });
  try { await refresh(); }
  catch { list.textContent = t("Не удалось прочитать рекорды. Проверьте доступ к хранилищу браузера."); }
}
$('#scores').addEventListener('click', () => void showScores());
$('#about').addEventListener('click', () => showDialog(t("Об игре"), `
  <p class="dialog-lead">${t("Маджонг-пасьянс.")}</p>
  <p>${t("Версия 0.1.0 · Костяшки Postmodern ·")} ${LAYOUTS.length} ${t("раскладок, включая шесть компактных для телефона. В мобильном режиме следующая компактная раскладка запускается кнопкой после победы.")}</p>
  <p>${t("Оригинальные SVG-костяшки Postmodern взяты из")} <a href="https://github.com/GNOME/gnome-mahjongg" target="_blank" rel="noopener noreferrer">GNOME Mahjongg</a>${t(", © 2004–2025 Mahjongg Contributors, GPL-3.0-or-later. Код приложения, интерфейс и иконка — © 2026 Nephrite contributors.")}</p>
  <p>${t("«Черепаха» адаптирована из Jarajara, © 2026 John Morris,")} <a href="./licenses/jarajara-LICENSE.txt" target="_blank" rel="noopener noreferrer">${t("лицензия MIT")}</a>${t(". Шесть компактных раскладок созданы для этого проекта.")}</p>
  <p>${t("Свободное ПО под GPL-3.0-or-later. Вы можете изучать, изменять и распространять игру на условиях лицензии. Без гарантий. Это независимый проект.")}</p>
  <div class="about-links"><a href="./LICENSE.txt" target="_blank" rel="noopener">${t("Лицензия GPLv3")}</a>${import.meta.env.PROD ? `<a href="./source.tar.gz" download>${t("Исходники этой версии")}</a>` : `<span class="muted">${t("Архив исходников появится в production-сборке")}</span>`}</div>
  <h3>${t("Установка на Android")}</h3><p>${t("Откройте игру по HTTPS в Chrome и выберите «Установить приложение» или «Добавить на главный экран» в меню браузера. После первого полного открытия игра доступна офлайн.")}</p>
  <p class="muted">${t("Локальный адрес по Wi-Fi подходит для проверки игры, но установка и офлайн-кэш требуют HTTPS. Учётная запись и серверная база данных не нужны.")}</p>
`));

document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test((event.target as Element).tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); if (event.shiftKey) doRedo(); else doUndo();
  }
});
document.addEventListener('visibilitychange', () => {
  // Charge the final visible slice before hiding, without charging background time.
  const now = performance.now();
  if (document.hidden && game && started && !paused && !busy && !dialog.open && !complete()) game.elapsedMs += now - previousTick;
  previousTick = now;
  if (document.hidden) {
    persist();
  } else if (game && complete()) render();
});
window.addEventListener('pagehide', () => { updateClock(); persist(); });

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let installPrompt: InstallPrompt | null = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event as InstallPrompt; $('#install').hidden = false;
});
$('#install').addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; $('#install').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#install').hidden = true; status(t("Игра установлена. Приятных партий!")); });
async function setupOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const offerUpdate = () => { if (registration.waiting && navigator.serviceWorker.controller) $('#update-notice').hidden = false; };
    offerUpdate();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offerUpdate));
    $('#update-app').addEventListener('click', async () => {
      updateClock(); persist(); await saveQueue;
      if (!storageWorks) { status(t("Сначала восстановите сохранение, чтобы обновление не потеряло партию.")); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting?.postMessage('SKIP_WAITING');
    });
  } catch { status(t("Офлайн-кэш пока недоступен. Игра работает, пока страница открыта.")); }
}

async function start() {
  shell.setAttribute('inert', '');
  let restored = false, corrupt = false;
  try {
    const saved = await loadSession();
    settings = { ...saved.settings }; stats = saved.stats; corrupt = saved.corrupt;
    if (saved.game) { game = saved.game; restored = true; }
  } catch { storageError(); }
  if (!restored) {
    status(t("Готовим первую партию…"));
    const generated = await engine.run({ kind: 'generate', layout: 'turtle' });
    if (!generated) throw new Error(t("Не удалось подготовить первую партию."));
    game = generated;
  }
  if (settings.language) applyLanguage(settings.language);
  else await chooseInitialLanguage();
  $<HTMLSelectElement>('#layout').value = settings.mobileMode ? 'mobile-random' : layoutId(game);
  started = game!.elapsedMs > 0 || game!.history.length > 0;
  previousTick = performance.now(); render();
  shell.removeAttribute('inert');
  if (restored) status(t("Ваша партия восстановлена. Продолжим с того же места."));
  if (corrupt) status(t("Сохранение повреждено или имеет другой формат. Подготовлена новая партия."));
  persist();
  setInterval(() => { updateClock(); if (++saveCounter % 10 === 0 && !document.hidden && started && !complete()) persist(); }, 1000);
  void setupOffline();
}
void start().catch(error => {
  $('#app').innerHTML = `<div class="fatal"><h1>${t("Не удалось открыть игру")}</h1><p>${t("Перезагрузите страницу, чтобы попробовать ещё раз.")}</p><button class="button primary" id="retry">${t("Попробовать снова")}</button></div>`;
  $('#retry').addEventListener('click', () => location.reload());
  console.error(error);
});
