import { ALIAS, KEY_CTL } from '@schildpad/core';

/**
 * A lightweight code editor: a transparent <textarea> layered over a
 * syntax-highlighted <pre>, with a line-number gutter. No CodeMirror/Monaco —
 * the language is small, and keeping it dependency-free keeps the bundle tiny
 * and the highlighter honest about the actual grammar.
 */

const escapeHtml = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

export function highlight(src: string): string {
  let out = '';
  const re = /(;[^\n]*)|(\[|\])|("[^\s[\]()]*)|(:[A-Za-z_]\w*)|(\b\d+\.?\d*\b)|([A-Za-z_][\w?]*)|([\s\S])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [, com, brk, str, vr, nm, word, other] = m;
    if (com) out += `<span class="t-com">${escapeHtml(com)}</span>`;
    else if (brk) out += `<span class="t-brk">${brk}</span>`;
    else if (str) out += `<span class="t-str">${escapeHtml(str)}</span>`;
    else if (vr) out += `<span class="t-var">${escapeHtml(vr)}</span>`;
    else if (nm) out += `<span class="t-num">${nm}</span>`;
    else if (word) {
      const w = word.toLowerCase();
      const cls = KEY_CTL.has(w) ? 't-ctl' : ALIAS[w] ? 't-cmd' : '';
      out += cls ? `<span class="${cls}">${escapeHtml(word)}</span>` : escapeHtml(word);
    } else out += escapeHtml(other);
  }
  return out;
}

export interface EditorRefs {
  textarea: HTMLTextAreaElement;
  highlightEl: HTMLElement;
  gutter: HTMLElement;
}

export class Editor {
  private ta: HTMLTextAreaElement;
  private hl: HTMLElement;
  private gutter: HTMLElement;
  private stash = '';
  badLine: number | null = null;
  onChange: () => void = () => {};

  constructor(refs: EditorRefs) {
    this.ta = refs.textarea;
    this.hl = refs.highlightEl;
    this.gutter = refs.gutter;

    this.ta.addEventListener('input', () => { this.badLine = null; this.render(); this.onChange(); });
    this.ta.addEventListener('scroll', () => this.syncScroll());
    this.ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); this.insert('  '); }
    });
  }

  get value(): string { return this.ta.value; }
  set value(v: string) { this.ta.value = v; this.badLine = null; this.render(); }

  focus(): void { this.ta.focus(); }

  insert(text: string): void {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    this.ta.value = this.ta.value.slice(0, s) + text + this.ta.value.slice(e);
    this.ta.selectionStart = this.ta.selectionEnd = s + text.length;
    this.ta.focus();
    this.render();
    this.onChange();
  }

  /**
   * Insert a chip's snippet and put the caret where the child has to type next
   * — inside the empty block of `herhaal 4 [  ]`, on the blank body line of a
   * `naar … einde`. Without this a chip is only half a shortcut: you still have
   * to aim at a two-space gap with a fingertip.
   */
  insertSnippet(code: string): void {
    const text = code + '\n';
    const block = /\[ {2}\]/.exec(text);          // herhaal 4 [  ]  -> between the spaces
    const body = block ? null : /\n {2}\n/.exec(text);  // naar … \n  \n einde -> end of the indent
    const caret = block ? block.index + 2 : body ? body.index + 3 : text.length;
    this.insert(text);
    this.ta.selectionStart = this.ta.selectionEnd = this.ta.selectionEnd - (text.length - caret);
    this.ta.focus();
  }

  /** Backspace for the on-screen key row; deletes the selection if there is one. */
  deleteBack(): void {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    const from = s === e ? Math.max(0, s - 1) : s;
    this.ta.value = this.ta.value.slice(0, from) + this.ta.value.slice(e);
    this.ta.selectionStart = this.ta.selectionEnd = from;
    this.ta.focus();
    this.badLine = null;
    this.render();
    this.onChange();
  }

  /**
   * Empty the editor, keeping a copy. Clearing is one tap away on a phone, so
   * it has to be undoable: `restore` puts the text back, and going through
   * `execCommand` rather than assigning to `.value` also leaves the browser's
   * own undo stack intact (Ctrl Z). Returns false if there was nothing to wipe.
   */
  clear(): boolean {
    const was = this.ta.value;
    if (!was) return false;
    this.stash = was;
    this.ta.focus();
    this.ta.setSelectionRange(0, was.length);
    if (!document.execCommand('delete')) {     // no undo stack, but still clears
      this.ta.value = '';
      this.badLine = null;
      this.render();
      this.onChange();
    }
    return true;
  }

  /** Put back what `clear` took, if the child hasn't typed anything since. */
  restore(): boolean {
    if (this.ta.value || !this.stash) return false;
    this.value = this.stash;
    this.stash = '';
    this.ta.focus();
    this.onChange();
    return true;
  }

  markError(line: number): void {
    this.badLine = line;
    this.render();
  }

  render(): void {
    this.hl.innerHTML = highlight(this.ta.value) + '\n';
    const lines = this.ta.value.split('\n').length;
    let g = '';
    for (let i = 1; i <= lines; i++) {
      g += (i === this.badLine ? `<span class="bad">${i}</span>` : i) + '\n';
    }
    this.gutter.innerHTML = g;
    this.syncScroll();
  }

  private syncScroll(): void {
    const x = this.ta.scrollLeft, y = this.ta.scrollTop;
    this.hl.style.transform = `translate(${-x}px, ${-y}px)`;
    this.gutter.style.transform = `translateY(${-y}px)`;
  }
}
