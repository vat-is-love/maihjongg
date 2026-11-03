// SPDX-FileCopyrightText: 2026 Nephrite contributors
// SPDX-License-Identifier: GPL-3.0-or-later
import './style.css';
import { availablePairs, isFree, newGame, redo, removedTiles, removePair, shuffleRemaining, undo, type Game, type Pair } from './game';
import { Board } from './board';
import { FullscreenController } from './fullscreen';
import { icon } from './art';
import { DEFAULT_SETTINGS, DEFAULT_STATS, importScores, loadScores, loadSession, saveSession, type Settings } from './storage';
import { parseGnomeHistory, type Score } from './scores';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
$('#app').innerHTML = `
  <main>
    <section class="game-shell" aria-label="Маджонг">
      <button id="toggle-controls" class="icon-button on-felt controls-toggle" aria-label="Показать управление" title="Показать управление" aria-expanded="false" aria-controls="game-controls game-toolbar">${icon('menu')}</button>
      <div class="game-topbar" id="game-controls">
        <div class="progress-stat"><span class="stat-label">ОСТАЛОСЬ</span><strong><span id="remaining">144</span><span class="stat-total"> / 144</span></strong><div class="progress-track"><span id="progress"></span></div></div>
        <div class="pair-stat"><span class="stat-label">ДОСТУПНО ПАР</span><strong id="pairs">—</strong></div>
        <div class="time-stat"><span class="stat-label">ВРЕМЯ</span><strong id="timer">00:00</strong></div>
        <button id="pause" class="icon-button on-felt" aria-label="Пауза" title="Пауза">${icon('pause', 18)}</button>
        <details class="game-menu" id="game-menu">
          <summary class="icon-button on-felt" aria-label="Меню игры" title="Меню игры">${icon('menu')}</summary>
          <nav class="game-menu-panel" aria-label="Меню игры">
            <button id="new-game">${icon('plus', 18)} Новая игра</button>
            <label class="layout-choice" for="layout">Раскладка<select id="layout"><option value="turtle">Черепаха</option></select></label>
            <button id="hint">${icon('hint', 18)} Подсказка</button>
            <button id="scores">${icon('trophy', 18)} Рекорды</button>
            <button id="settings">${icon('settings', 18)} Настройки</button>
            <hr>
            <button id="rules">${icon('help', 18)} Как играть</button>
            <button id="about">Об игре</button>
            <a id="license" href="./LICENSE.txt" target="_blank" rel="noopener">Лицензия GPLv3+</a>
            <button id="install" hidden>${icon('download', 18)} Установить</button>
          </nav>
        </details>
      </div>
      <div class="board-wrap">
        <div class="felt-decoration" aria-hidden="true">${icon('leaf', 240)}</div>
        <div id="board" class="board"></div>
        <div id="board-overlay" class="board-overlay" hidden></div>
        <button id="fullscreen" class="icon-button on-felt fullscreen-button" aria-label="На весь экран" title="На весь экран" aria-pressed="false">${icon('fullscreen', 17)}</button>
        <div id="board-note" class="board-note">Две одинаковые костяшки — одна пара</div>
      </div>
      <div class="game-toolbar" id="game-toolbar">
        <div class="undo-group"><button id="undo" class="tool-button" title="Отменить ход (Ctrl+Z)">${icon('undo')}<span>Назад</span></button><button id="redo" class="tool-button" title="Повторить ход (Ctrl+Shift+Z)">${icon('redo')}<span>Вперёд</span></button></div>
        <div class="assist-group"><button id="shuffle" class="tool-button">${icon('shuffle')}<span>Перемешать</span></button></div>
      </div>
    </section>
    <div class="under-board"><p id="status" role="status" aria-live="polite">Выберите свободную костяшку, затем такую же.</p><span id="save-indicator" class="save-indicator">${icon('check', 14)} Сохраняется на устройстве</span></div>
    <div id="update-notice" class="notice" hidden>Есть новая версия игры. <button id="update-app" class="text-button">Обновить</button></div>
    <div id="storage-warning" class="notice warning" role="alert" hidden></div>

  </main>
  <dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><h2 id="dialog-title"></h2><button id="close-dialog" class="icon-button" aria-label="Закрыть">${icon('close')}</button></div><div id="dialog-content"></div></dialog>
`;

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
  const label = open ? 'Скрыть управление' : 'Показать управление';
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
const complete = () => game.history.length === 72;
const status = (message: string) => { $('#status').textContent = message; };

function updateClock() {
  const now = performance.now();
  if (game && started && !paused && !busy && !dialog.open && !document.hidden && !complete()) game.elapsedMs += now - previousTick;
  previousTick = now;
  if (game) $('#timer').textContent = formatTime(game.elapsedMs);
}
function storageError() {
  storageWorks = false;
  $('#save-indicator').textContent = 'Сохранение недоступно';
  const warning = $('#storage-warning');
  warning.hidden = false;
  warning.textContent = 'Браузер не смог сохранить партию. Можно играть, но после закрытия страницы прогресс может потеряться. Проверьте свободное место и разрешение на хранение данных.';
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
      $('#save-indicator').innerHTML = `${icon('check', 14)} Партия сохранена`;
    } catch { storageError(); }
  });
}
function render() {
  const remaining = 144 - game.history.length * 2;
  const pairs = availablePairs(game);
  const locked = paused || busy || complete();
  $('#remaining').textContent = String(remaining);
  $('#pairs').textContent = String(pairs.length);
  $('#progress').style.width = `${(144 - remaining) / 144 * 100}%`;
  $('#timer').textContent = formatTime(game.elapsedMs);
  $<HTMLButtonElement>('#undo').disabled = !game.history.length || busy || paused;
  $<HTMLButtonElement>('#redo').disabled = !game.redo.length || locked;
  $<HTMLButtonElement>('#hint').disabled = !pairs.length || locked;
  $<HTMLButtonElement>('#shuffle').disabled = locked;
  $<HTMLButtonElement>('#pause').disabled = busy || complete();
  $('#pause').innerHTML = icon(paused ? 'play' : 'pause', 18);
  $('#pause').setAttribute('aria-label', paused ? 'Продолжить' : 'Пауза');
  $('#pause').setAttribute('title', paused ? 'Продолжить' : 'Пауза');
  board.render(game, selected, hint, settings.highlightFree);
  $('#board').setAttribute('inert', '');
  if (!locked && !dialog.open) $('#board').removeAttribute('inert');
  const overlay = $('#board-overlay');
  overlay.hidden = !locked;
  $('#board').classList.toggle('concealed', paused);
  $('#board-note').hidden = locked;
  if (busy) overlay.innerHTML = `<div class="overlay-card"><span class="spinner"></span><h2>Раскладываем костяшки</h2><p>Готовим партию с решением…</p></div>`;
  else if (paused) overlay.innerHTML = `<div class="overlay-card"><span class="overlay-icon">${icon('leaf', 34)}</span><h2>Пауза</h2><p>Таймер остановлен.</p><button class="button cream" id="resume-game">${icon('play', 18)} Продолжить</button></div>`;
  else if (complete()) overlay.innerHTML = `<div class="overlay-card victory"><span class="overlay-icon">${icon('trophy', 36)}</span><div class="eyebrow">ВСЕ ПАРЫ НАЙДЕНЫ</div><h2>Партия завершена</h2><p>${formatTime(game.elapsedMs)} · Подсказок: ${game.hints} · Перемешиваний: ${game.shuffles}</p><button class="button cream" id="play-again">${icon('plus', 18)} Ещё одна партия</button></div>`;
  if (pairs.length || complete()) noMovesNotice = null;
  if (!locked && !pairs.length) {
    status('Доступных пар больше нет. Перемешайте костяшки, повторите раскладку или начните новую игру.');
    const position = JSON.stringify([game.id, game.history, game.shuffles]);
    if (!dialog.open && noMovesNotice !== position) {
      noMovesNotice = position;
      showNoMoves();
    }
  }
  document.body.classList.toggle('reduce-motion', settings.reducedMotion);
}
function selectTile(id: number) {
  if (paused || busy || dialog.open || complete()) return;
  if (!isFree(id, removedTiles(game))) { status('Эта костяшка закрыта. Сверху должно быть пусто, а слева или справа — свободно.'); return; }
  updateClock(); started = true;
  if (selected === id) { selected = null; hint = null; board.updateSelection(selected, hint); return; }
  if (selected !== null && removePair(game, selected, id)) {
    selected = null; hint = null; hintIndex = 0;
    status(complete() ? 'Все 144 костяшки убраны. Поздравляем!' : 'Пара найдена.');
    render(); persist();
    return;
  }
  if (selected !== null) status('Это разные костяшки. Найдите пару к выбранной.');
  else status('Теперь выберите такую же свободную костяшку.');
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

async function createGame(seed?: number) {
  setControlsOpen(false);
  updateClock(); busy = true; paused = false; selected = null; hint = null;
  if (dialog.open) dialog.close();
  if (game) render();
  await new Promise(resolve => setTimeout(resolve, 30));
  try {
    game = newGame(seed); started = false; hintIndex = 0;
    status('Новая раздача готова. У каждой партии есть решение.');
  } catch (error) { status(error instanceof Error ? error.message : 'Не удалось начать игру.'); }
  busy = false; previousTick = performance.now(); render(); persist();
}
function requestNewGame() {
  if (busy) return;
  if (complete() || (!game.history.length && game.elapsedMs === 0)) { void createGame(); return; }
  showDialog('Начать новую партию?', `<p>Текущая партия будет заменена новой решаемой раздачей.</p><div class="dialog-actions"><button id="cancel-new" class="button secondary">Продолжить текущую</button><button id="confirm-new" class="button primary">Новая игра</button></div>`);
  $('#cancel-new').addEventListener('click', closeDialog);
  $('#confirm-new').addEventListener('click', () => void createGame());
}
function doUndo() {
  if (busy || paused || dialog.open) return;
  updateClock();
  if (!undo(game)) return;
  selected = null; hint = null; hintIndex = 0;
  status('Последняя пара возвращена на поле.'); render(); persist();
}
function doRedo() {
  if (busy || paused || dialog.open) return;
  updateClock();
  if (!redo(game)) return;
  selected = null; hint = null; hintIndex = 0;
  status(complete() ? 'Все пары найдены. Поздравляем!' : 'Ход повторён.'); render(); persist();
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
  status('Подсвечена доступная пара. Подсказка показывает ход, но не гарантирует победу.');
  render(); persist();
});
$('#shuffle').addEventListener('click', () => {
  showDialog('Перемешать костяшки?', `<p>Оставшиеся костяшки получат новую решаемую расстановку рисунков. Уже снятые пары останутся снятыми.</p><div class="dialog-actions"><button id="cancel-shuffle" class="button secondary">Отмена</button><button id="confirm-shuffle" class="button primary">Перемешать</button></div>`);
  $('#cancel-shuffle').addEventListener('click', closeDialog);
  $('#confirm-shuffle').addEventListener('click', () => void doShuffle());
});
async function doShuffle() {
  updateClock(); busy = true; selected = null; hint = null; hintIndex = 0;
  if (dialog.open) dialog.close();
  render();
  await new Promise(resolve => setTimeout(resolve, 30));
  let success = false;
  try { success = shuffleRemaining(game); }
  finally { busy = false; previousTick = performance.now(); }
  status(success ? 'Костяшки перемешаны. Для оставшегося поля есть решение.' : 'Для этой позиции не удалось найти раздачу. Отмените несколько ходов или начните раскладку заново.');
  render(); persist();
  if (!success) {
    showNoMoves();
    $('#dialog-content p').textContent = 'Не удалось перемешать эту позицию. Можно закрыть меню и отменить несколько ходов, повторить раскладку или начать новую игру.';
  }
}
function showNoMoves() {
  showDialog('Доступных ходов больше нет', `<p>На поле не осталось свободных одинаковых пар. Как продолжим?</p>
    <div class="dialog-actions no-moves-actions">
      <button id="no-moves-shuffle" class="button secondary">${icon('shuffle', 18)} Перемешать текущую раскладку</button>
      <button id="no-moves-restart" class="button secondary">${icon('redo', 18)} Начать раскладку сначала</button>
      <button id="no-moves-new" class="button primary">${icon('plus', 18)} Начать новую игру</button>
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
});
new FullscreenController($('.game-shell'), $<HTMLButtonElement>('#fullscreen'));

$('#rules').addEventListener('click', () => showDialog('Как играть', `
  <p class="dialog-lead">Уберите с поля все 144 костяшки, находя одинаковые пары.</p>
  <ol class="rules-list"><li><strong>Найдите свободную костяшку.</strong> Над ней нет другой, а хотя бы одна сторона — левая или правая — открыта.</li><li><strong>Выберите такую же.</strong> Нажмите на обе костяшки, чтобы убрать пару.</li><li><strong>Смотрите на следующие ходы.</strong> Каждая новая раздача имеет решение, но не любой порядок ходов ведёт к победе.</li></ol>
  <div class="tip">${icon('hint')}<p>«Подсказка» выделяет доступную пару. Если пар нет, отмените ход или перемешайте поле.</p></div>
  <p>Все цветы можно соединять с любыми цветами, а времена года — с любыми временами года, даже если рисунки разные.</p>
  <p>Кнопка ${icon('fullscreen', 16)} разворачивает игру на весь экран. Для выхода нажмите её снова или Esc.</p>
  <p class="muted">Клавиатура: Tab и Enter — выбор костяшек; Ctrl+Z — отмена; Ctrl+Shift+Z — повтор. Во время паузы и в меню часы остановлены.</p>
`));
function showSettings() {
  showDialog('Настройки', `
    <div class="settings-row"><label for="highlight"><strong>Подсвечивать свободные</strong><small>Приглушить закрытые костяшки</small></label><input id="highlight" type="checkbox" ${settings.highlightFree ? 'checked' : ''}/></div>
    <div class="settings-row"><label for="motion"><strong>Меньше движения</strong><small>Убрать анимацию подсказок</small></label><input id="motion" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}/></div>
    <div class="personal-stats"><div><span>Завершено партий</span><strong>${stats.wins}</strong></div><div><span>Лучшее время</span><strong>${stats.bestMs === null ? '—' : formatTime(stats.bestMs)}</strong></div></div>
    <p class="muted">Результаты включают партии с подсказками и перемешиванием. Партия и настройки хранятся только в IndexedDB этого браузера. Очистка данных сайта удалит их.</p>
    <button id="restart" class="button secondary full-width">Начать эту раздачу заново</button>
  `);
  $('#highlight').addEventListener('change', event => { settings.highlightFree = (event.target as HTMLInputElement).checked; render(); persist(); });
  $('#motion').addEventListener('change', event => { settings.reducedMotion = (event.target as HTMLInputElement).checked; render(); persist(); });
  $('#restart').addEventListener('click', () => {
    showDialog('Повторить раздачу?', `<p>Рисунки вернутся на исходные места. Время и история ходов будут сброшены.</p><div class="dialog-actions"><button id="cancel-restart" class="button secondary">Отмена</button><button id="confirm-restart" class="button primary">Начать заново</button></div>`);
    $('#cancel-restart').addEventListener('click', closeDialog);
    $('#confirm-restart').addEventListener('click', () => void createGame(game.seed));
  });
}
$('#settings').addEventListener('click', showSettings);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
async function showScores() {
  showDialog('Рекорды партий', `
    <p>Победы по возрастанию времени. Рекорды хранятся только в этом браузере.</p>
    <label class="score-filter">Раскладка <select id="score-layout"><option value="">Все раскладки</option></select></label>
    <div id="score-list" aria-live="polite">Загрузка…</div>
    <button id="more-scores" class="button secondary full-width" hidden>Показать ещё 50</button>
    <h3>Импорт из GNOME Mahjongg</h3>
    <p>Выберите текстовый файл <code>history</code>. Поддерживаются старый формат и новый с именем игрока. Повторный импорт того же файла не добавляет дубликаты.</p>
    <label class="score-file">Файл рекордов <input id="score-file" type="file" /></label>
    <p id="import-result" role="status"></p>
    <p class="muted">GNOME не записывает число подсказок и перемешиваний: для импортированных результатов эти значения неизвестны. Счётчики в настройках относятся к победам в этой игре. Старые победы до появления списка не имеют подробных записей.</p>
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
    list.innerHTML = filtered.length ? `<p class="muted">Всего: ${filtered.length}</p><ol class="score-list">${filtered.slice(0, limit).map(score =>
      `<li><strong>${formatTime(score.elapsedMs)}</strong><span>${escapeHtml(score.layout === 'turtle' ? 'Черепаха' : score.layout)} · ${escapeHtml(new Date(score.date).toLocaleString('ru-RU'))}</span><small>${score.source === 'local' ? `Подсказок: ${score.hints} · Перемешиваний: ${score.shuffles}` : `GNOME${score.player ? ` · ${escapeHtml(score.player)}` : ''}`}</small></li>`).join('')}</ol>`
      : '<p>Пока нет записей. Завершите партию или импортируйте рекорды GNOME.</p>';
    more.hidden = filtered.length <= limit;
  };
  const refresh = async () => {
    await saveQueue;
    scores = await loadScores();
    const selectedLayout = layout.value;
    layout.innerHTML = '<option value="">Все раскладки</option>' + [...new Set(scores.map(score => score.layout))].sort()
      .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name === 'turtle' ? 'Черепаха' : name)}</option>`).join('');
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
      if (file.size > 2 * 1024 * 1024) throw new Error('Размер файла должен быть не больше 2 МБ.');
      const parsed = parseGnomeHistory(await file.text());
      if (!parsed.scores.length) throw new Error(`Записи GNOME не найдены. Пропущено строк: ${parsed.skipped}. Выберите текстовый файл history.`);
      const added = await importScores(parsed.scores);
      await refresh();
      result.textContent = `Добавлено: ${added}. Уже в списке: ${parsed.scores.length - added}. Некорректных строк: ${parsed.skipped}.`;
    } catch (error) { result.textContent = error instanceof Error ? error.message : 'Не удалось импортировать рекорды. Проверьте доступ к хранилищу браузера.'; }
    finally { input.disabled = false; input.value = ''; }
  });
  try { await refresh(); }
  catch { list.textContent = 'Не удалось прочитать рекорды. Проверьте доступ к хранилищу браузера.'; }
}
$('#scores').addEventListener('click', () => void showScores());
$('#about').addEventListener('click', () => showDialog('Об игре', `
  <p class="dialog-lead">Маджонг-пасьянс.</p>
  <p>Версия 0.1.0 · Костяшки Postmodern · Раскладка «Черепаха».</p>
  <p>Раскладка и оригинальные SVG-костяшки Postmodern взяты из <a href="https://github.com/GNOME/gnome-mahjongg" target="_blank" rel="noopener noreferrer">GNOME Mahjongg</a>, © 2004–2025 Mahjongg Contributors, GPL-3.0-or-later. Код приложения, интерфейс и иконка — © 2026 Nephrite contributors.</p>
  <p>Свободное ПО под GPL-3.0-or-later. Вы можете изучать, изменять и распространять игру на условиях лицензии. Без гарантий. Это независимый проект.</p>
  <div class="about-links"><a href="./LICENSE.txt" target="_blank" rel="noopener">Лицензия GPLv3</a>${import.meta.env.PROD ? '<a href="./source.tar.gz" download>Исходники этой версии</a>' : '<span class="muted">Архив исходников появится в production-сборке</span>'}</div>
  <h3>Установка на Android</h3><p>Откройте игру по HTTPS в Chrome и выберите «Установить приложение» или «Добавить на главный экран» в меню браузера. После первого полного открытия игра доступна офлайн.</p>
  <p class="muted">Локальный адрес по Wi-Fi подходит для проверки игры, но установка и офлайн-кэш требуют HTTPS. Учётная запись и серверная база данных не нужны.</p>
`));

document.addEventListener('keydown', event => {
  if (dialog.open || /INPUT|TEXTAREA|SELECT/.test((event.target as Element).tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); if (event.shiftKey) doRedo(); else doUndo();
  }
});
document.addEventListener('visibilitychange', () => {
  // Charge the final visible slice before hiding, without charging background time.
  const now = performance.now();
  if (document.hidden && game && started && !paused && !busy && !dialog.open && !complete()) game.elapsedMs += now - previousTick;
  previousTick = now;
  if (document.hidden) persist();
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
window.addEventListener('appinstalled', () => { $('#install').hidden = true; status('Игра установлена. Приятных партий!'); });
async function setupOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const offerUpdate = () => { if (registration.waiting && navigator.serviceWorker.controller) $('#update-notice').hidden = false; };
    offerUpdate();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offerUpdate));
    $('#update-app').addEventListener('click', async () => {
      updateClock(); persist(); await saveQueue;
      if (!storageWorks) { status('Сначала восстановите сохранение, чтобы обновление не потеряло партию.'); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting?.postMessage('SKIP_WAITING');
    });
  } catch { status('Офлайн-кэш пока недоступен. Игра работает, пока страница открыта.'); }
}

async function start() {
  let restored = false, corrupt = false;
  try {
    const saved = await loadSession();
    settings = saved.settings; stats = saved.stats; corrupt = saved.corrupt;
    if (saved.game) { game = saved.game; restored = true; }
  } catch { storageError(); }
  if (!restored) game = newGame();
  started = game!.elapsedMs > 0 || game!.history.length > 0;
  previousTick = performance.now(); render();
  if (restored) status('Ваша партия восстановлена. Продолжим с того же места.');
  if (corrupt) status('Сохранение повреждено или имеет другой формат. Подготовлена новая партия.');
  persist();
  setInterval(() => { updateClock(); if (++saveCounter % 10 === 0 && !document.hidden && started && !complete()) persist(); }, 1000);
  void setupOffline();
}
void start().catch(error => {
  $('#app').innerHTML = `<div class="fatal"><h1>Не удалось открыть игру</h1><p>Перезагрузите страницу, чтобы попробовать ещё раз.</p><button class="button primary" id="retry">Попробовать снова</button></div>`;
  $('#retry').addEventListener('click', () => location.reload());
  console.error(error);
});
