import {
  createInterpreter, Turtle, createDriver, SPEEDS, formatError,
  COLORS, PEN_ORDER, PEN_EN,
  type Host, type Lang, type DriverHandle,
} from '@schildpad/core';
import { MESSAGES } from '@schildpad/core';
import { EXAMPLES, CHIPS } from '@schildpad/content';
import { CanvasSurface, webClock } from './canvas-surface.ts';
import { Editor } from './editor.ts';

/**
 * Ties the pieces together for the web. This is the only "glue" file; all the
 * language behaviour lives in @schildpad/core and all teaching content in
 * @schildpad/content, so the mobile app re-implements just this layer plus the
 * Skia surface.
 */

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const surface = new CanvasSurface(
  $<HTMLCanvasElement>('grid'), $<HTMLCanvasElement>('ink'), $<HTMLCanvasElement>('turtle'),
);
const clock = webClock();
const turtle = new Turtle(surface);

const editor = new Editor({
  textarea: $<HTMLTextAreaElement>('ta'),
  highlightEl: $('hl'),
  gutter: $('gutter'),
});

let lang: Lang = 'nl';
let handle: DriverHandle | null = null;

const host: Host = {
  print: (s) => log(s, 'out'),
  mark: () => {},
  penChanged: (color) => paintPens(color),
};

/* ---------- console ---------- */
function log(msg: string, cls = ''): void {
  const el = $('console');
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}
const clearLog = () => { $('console').textContent = ''; };

/* ---------- run / stop ---------- */
function setBusy(on: boolean): void {
  ($('run') as HTMLButtonElement).disabled = on;
  ($('stop') as HTMLButtonElement).disabled = !on;
  document.body.dataset.busy = String(on);
  paintGo();
}

/** The key row's run button doubles as stop; on narrow it is the only one. */
function paintGo(): void {
  const t = MESSAGES[lang].ui;
  const busy = document.body.dataset.busy === 'true';
  const b = $('key-run');
  b.textContent = busy ? '\u25A0' : '\u25B6';
  b.setAttribute('aria-label', busy ? t.stop : t.run);
}

function run(): void {
  stop(true);
  clearLog();
  editor.badLine = null;
  editor.render();

  turtle.reset();
  surface.clearInk();
  turtle.stepLen = SPEEDS[+($('speed') as HTMLInputElement).value - 1];

  let iter;
  try {
    iter = createInterpreter(turtle, host).run(editor.value);
  } catch (e) {
    return fail(e);
  }
  setBusy(true);
  log(MESSAGES[lang].ui.running, 'ok');

  handle = createDriver(iter, turtle, surface, clock, {
    onDone: () => { setBusy(false); log(MESSAGES[lang].ui.done, 'ok'); readout(); },
    onError: (e) => fail(e),
  });
}

function stop(silent = false): void {
  handle?.stop();
  handle = null;
  if (!silent) log(MESSAGES[lang].ui.stopped, 'ok');
  setBusy(false);
}

function fail(e: unknown): void {
  stop(true);
  surface.renderTurtle(turtle.visible ? turtle.state() : null);
  const line = (e as { line?: number })?.line;
  if (typeof line === 'number') editor.markError(line);
  log(formatError(e, lang), 'err');
}

function readout(): void {
  $('readout').textContent =
    `x ${Math.round(turtle.x)} · y ${Math.round(turtle.y)} · ${Math.round(turtle.heading)}°`;
}

/* ---------- pens ---------- */
function paintPens(active: string): void {
  for (const el of Array.from($('pens').children) as HTMLElement[]) {
    el.setAttribute('aria-pressed', String(el.dataset.hex?.toLowerCase() === active.toLowerCase()));
  }
}
function buildPens(): void {
  const box = $('pens');
  box.innerHTML = '';
  for (const nameNl of PEN_ORDER) {
    const hex = COLORS[nameNl];
    const b = document.createElement('button');
    b.className = 'pen';
    b.dataset.hex = hex;
    b.style.background = hex;
    b.style.color = hex;
    const label = lang === 'nl' ? nameNl : PEN_EN[nameNl];
    b.title = label;
    b.setAttribute('aria-label', label);
    b.onclick = () =>
      editor.insert((lang === 'nl' ? `penkleur "${nameNl}` : `setcolor "${PEN_EN[nameNl]}`) + '\n');
    box.appendChild(b);
  }
  paintPens(turtle.color);
}

/* ---------- chips ---------- */
function buildChips(): void {
  const box = $('chips');
  box.innerHTML = '';
  for (const chip of CHIPS[lang]) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = `${chip.code.split('\n')[0]}<small>${chip.desc}</small>`;
    b.onclick = () => editor.insertSnippet(chip.code);
    box.appendChild(b);
  }
}

/* ---------- examples ---------- */
function buildExamples(): void {
  const sel = $('examples') as HTMLSelectElement;
  sel.innerHTML = '';
  const first = document.createElement('option');
  first.textContent = MESSAGES[lang].ui.examples;
  first.value = '';
  sel.appendChild(first);
  EXAMPLES[lang].forEach((ex, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = ex.name;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    if (sel.value === '') return;
    editor.value = EXAMPLES[lang][+sel.value].source;
    sel.value = '';
    run();
  };
}

/**
 * Wipe the program — and, pressed a second time on an editor still empty, put
 * it back. Ctrl Z does the same on a keyboard, but a phone has no undo, and a
 * child who taps this by accident has just lost everything they wrote.
 */
function clearCode(): void {
  const t = MESSAGES[lang].ui;
  if (editor.restore()) log(t.restored);
  else if (editor.clear()) { clearLog(); log(t.cleared); }
}

/* ---------- language ---------- */
function setLang(l: Lang): void {
  lang = l;
  $('lang-nl').setAttribute('aria-pressed', String(l === 'nl'));
  $('lang-en').setAttribute('aria-pressed', String(l === 'en'));
  const t = MESSAGES[l].ui;
  $('ui-run').textContent = t.run;
  $('ui-stop').textContent = t.stop;
  $('ui-program').textContent = t.program;
  $('ui-sheet').textContent = t.sheet;
  $('ui-penlabel').textContent = t.pens;
  $('ui-speed').textContent = t.speed;
  $('gridtoggle').textContent = t.grid;
  $('clear').textContent = t.clear;
  $('key-clear').textContent = t.clear;
  paintGo();
  document.documentElement.lang = l;
  buildChips();
  buildExamples();
  buildPens();
}

/* ---------- the draggable dividers ----------
   `--split` is the paper's height, `--chips` the width of the chip column
   beside the editor. Nothing else needs to know either value: the drawing
   follows the sheet through CanvasSurface.fit(), which keeps the ink and only
   changes how much room there is around it. */
const MIN_PAPER = 220, MIN_CODE = 200;      // the vertical split, top and bottom
const MIN_CHIPS = 132, MIN_EDITOR = 360;    // the horizontal one, right and left

interface Split {
  grip: string;               // the divider
  box: string;                // what it divides
  cssVar: string;             // custom property holding the size
  axis: 'x' | 'y';
  from: 'start' | 'end';      // which edge cssVar measures from
  min: number;                // floor for the side cssVar measures
  other: number;              // floor for the other side
  onMove?: () => void;
}

function wireSplit(s: Split): void {
  const grip = $(s.grip);
  const vertical = s.axis === 'y';
  const box = () => $(s.box).getBoundingClientRect();

  /** Where the divider sits now, in the units cssVar is written in. */
  const current = (): number => {
    const g = grip.getBoundingClientRect(), b = box();
    if (s.from === 'start') return vertical ? g.top - b.top : g.left - b.left;
    return vertical ? b.bottom - g.bottom : b.right - g.right;
  };

  const set = (px: number): void => {
    const b = box();
    const thick = vertical ? grip.offsetHeight : grip.offsetWidth;   // the divider eats space too
    const max = Math.max(s.min, (vertical ? b.height : b.width) - s.other - thick);
    document.documentElement.style.setProperty(s.cssVar, `${Math.min(Math.max(px, s.min), max)}px`);
    s.onMove?.();
  };
  const reset = (): void => {
    document.documentElement.style.removeProperty(s.cssVar);
    s.onMove?.();
  };

  let id: number | null = null;
  grip.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    document.body.dataset.dragging = s.axis;
    grip.setPointerCapture(id);   // last: state first, so a refused capture still drags
  });
  grip.addEventListener('pointermove', (e) => {
    if (id === null) return;
    const b = box();
    const half = (vertical ? grip.offsetHeight : grip.offsetWidth) / 2;
    const client = vertical ? e.clientY : e.clientX;
    set(s.from === 'start'
      ? client - (vertical ? b.top : b.left) - half
      : (vertical ? b.bottom : b.right) - client - half);
  });
  const end = () => {
    if (id !== null && grip.hasPointerCapture(id)) grip.releasePointerCapture(id);
    id = null;
    delete document.body.dataset.dragging;
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  // Draggable-by-mouse-only would put the split out of reach of a keyboard.
  const [back, fwd] = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  const dir = s.from === 'start' ? 1 : -1;   // does moving the divider back grow or shrink it
  grip.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === back) set(current() - dir * step);
    else if (e.key === fwd) set(current() + dir * step);
    else if (e.key === 'Home' || e.key === 'Escape') reset();
    else return;
    e.preventDefault();
  });
  grip.addEventListener('dblclick', reset);

  // A window that got smaller must not leave either side squeezed to nothing.
  addEventListener('resize', () => {
    const cur = getComputedStyle(document.documentElement).getPropertyValue(s.cssVar);
    if (cur.endsWith('px')) set(parseFloat(cur)); else s.onMove?.();
  });
}

/* Give the logical space the shape of the box the sheet ended up with, at most
   once per frame — a drag fires pointermove far more often than that. */
let fitPending = false;
function fitSheet(): void {
  if (fitPending) return;
  fitPending = true;
  requestAnimationFrame(() => {
    fitPending = false;
    const box = $('sheet').getBoundingClientRect();
    if (surface.fit(box.width, box.height)) {
      surface.renderTurtle(turtle.visible ? turtle.state() : null);
    }
  });
}

/* ---------- wiring ---------- */
let gridOn = true;

function boot(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ($('speed') as HTMLInputElement).value = '5';
  }
  editor.onChange = () => {};

  $('run').onclick = () => run();
  $('stop').onclick = () => stop();
  $('key-run').onclick = () => (handle ? stop() : run());
  $('key-back').onclick = () => editor.deleteBack();
  $('clear').onclick = clearCode;
  $('key-clear').onclick = clearCode;
  wireSplit({ grip: 'grip', box: 'split-main', cssVar: '--split', axis: 'y',
              from: 'start', min: MIN_PAPER, other: MIN_CODE, onMove: fitSheet });
  wireSplit({ grip: 'grip-x', box: 'code-wrap', cssVar: '--chips', axis: 'x',
              from: 'end', min: MIN_CHIPS, other: MIN_EDITOR });
  for (const k of Array.from($('keys').querySelectorAll<HTMLElement>('[data-ins]'))) {
    // Brackets and colons are two taps deep on a phone keyboard and every
    // Logo program needs them.
    k.onmousedown = (e) => e.preventDefault();   // keep the caret & keyboard
    k.onclick = () => editor.insert(k.dataset.ins!);
  }
  $('lang-nl').onclick = () => setLang('nl');
  $('lang-en').onclick = () => setLang('en');
  ($('speed') as HTMLInputElement).oninput = () => {
    turtle.stepLen = SPEEDS[+($('speed') as HTMLInputElement).value - 1];
  };
  $('gridtoggle').onclick = () => {
    gridOn = !gridOn;
    $('gridtoggle').setAttribute('aria-pressed', String(gridOn));
    surface.setGridVisible(gridOn);   // its own layer now: the drawing survives
  };
  $('save').onclick = () => {
    const a = document.createElement('a');
    a.download = 'schildpad.png';
    a.href = surface.toPNG();
    a.click();
  };
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    if (e.key === 'Escape') stop();
  });

  setLang('nl');
  editor.value = EXAMPLES[lang][1].source;
  fitSheet();
  turtle.stepLen = SPEEDS[+($('speed') as HTMLInputElement).value - 1];
  surface.clearInk();
  turtle.reset();
  surface.renderTurtle(turtle.state());
  readout();
  log(MESSAGES[lang].ui.ready, 'ok');
}

boot();
