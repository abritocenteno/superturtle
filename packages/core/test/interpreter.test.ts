import { describe, it, expect } from 'vitest';
import { createInterpreter } from '../src/interpreter.ts';
import { Turtle } from '../src/turtle.ts';
import { LogoError } from '../src/errors.ts';
import type { Surface, Host, Segment, TurtleState } from '../src/types.ts';

/**
 * A headless Surface that records what would be drawn, so we can assert on the
 * geometry an interpreter run produces without a canvas.
 */
function harness() {
  const log: string[] = [];
  const surface: Surface = {
    width: 1200,
    height: 900,
    clearInk() { log.push('clear'); },
    drawSegment(s: Segment) {
      log.push(`line ${s.x0.toFixed(1)},${s.y0.toFixed(1)} -> ${s.x1.toFixed(1)},${s.y1.toFixed(1)}`);
    },
    renderTurtle(_: TurtleState | null) {},
    setGridVisible(_: boolean) {},
  };
  const host: Host = {
    print: (s) => log.push('PRINT ' + s),
    mark: () => {},
    penChanged: () => {},
  };
  const turtle = new Turtle(surface);
  function exec(src: string, limit = 400000): string[] {
    log.length = 0;
    turtle.reset();
    // Instant stepping: one segment per logical move, so counts are assertable.
    turtle.stepLen = Infinity;
    const g = createInterpreter(turtle, host).run(src);
    let n = 0;
    while (true) {
      const r = g.next();
      if (r.done) break;
      if (++n > limit) throw new Error('runaway');
    }
    return log;
  }
  const lines = () => log.filter((l) => l.startsWith('line'));
  return { exec, lines, turtle, log };
}

describe('drawing', () => {
  it('draws a square (Dutch)', () => {
    const h = harness();
    h.exec('wisscherm herhaal 4 [ vooruit 100 rechts 90 ]');
    expect(h.lines().length).toBe(4);
  });
  it('square returns to origin', () => {
    const h = harness();
    h.exec('herhaal 4 [ vooruit 100 rechts 90 ]');
    expect(Math.abs(h.turtle.x)).toBeLessThan(1e-9);
    expect(Math.abs(h.turtle.y)).toBeLessThan(1e-9);
  });
  it('accepts English aliases', () => {
    const h = harness();
    h.exec('clearscreen repeat 4 [ forward 100 right 90 ]');
    expect(h.lines().length).toBe(4);
  });
  it('penup suppresses the line', () => {
    const h = harness();
    h.exec('penop vooruit 100 penneer vooruit 10');
    expect(h.lines().length).toBe(1);
  });
  it('setxy then heading move', () => {
    const h = harness();
    h.exec('zetxy 50 60 zetkoers 90 vooruit 10');
    expect(h.turtle.x).toBeCloseTo(60);
    expect(h.turtle.y).toBeCloseTo(60);
  });
});

describe('procedures', () => {
  it('runs a procedure with a parameter', () => {
    const h = harness();
    h.exec('naar ster :z herhaal 5 [ vooruit :z rechts 144 ] einde ster 100');
    expect(h.lines().length).toBe(5);
  });
  it('recurses with a stop rule', () => {
    const h = harness();
    h.exec('naar tak :l als :l < 9 [ stop ] vooruit :l tak :l * 0.7 einde tak 100');
    expect(h.lines().length).toBeGreaterThanOrEqual(7);
  });
  it('reports a value with output', () => {
    const h = harness();
    const o = h.exec('naar dubbel :x geefterug :x * 2 einde schrijf dubbel 21');
    expect(o[0]).toBe('PRINT 42');
  });
  it('stop inside a repeat exits the procedure', () => {
    const h = harness();
    const o = h.exec('naar p herhaal 5 [ schrijf 1 stop ] einde p');
    expect(o.length).toBe(1);
  });
});

describe('expressions', () => {
  const val = (src: string) => harness().exec(src)[0];
  it('honours precedence', () => expect(val('schrijf 2 + 3 * 4')).toBe('PRINT 14'));
  it('honours parentheses', () => expect(val('schrijf (2 + 3) * 4')).toBe('PRINT 20'));
  it('does real division', () => expect(val('schrijf 10 / 4')).toBe('PRINT 2.5'));
  it('handles unary minus', () => expect(val('schrijf 5 * -2')).toBe('PRINT -10'));
  it('reads variables', () => expect(val('maak "hoek 90 schrijf :hoek + 10')).toBe('PRINT 100'));
});

describe('the minus ambiguity (UCBLogo rule)', () => {
  const val = (src: string) => harness().exec(src)[0];
  it('reads a glued negative as a second argument', () => {
    const h = harness();
    h.exec('zetxy 0 -320');
    expect([Math.round(h.turtle.x), Math.round(h.turtle.y)]).toEqual([0, -320]);
  });
  it('reads a glued negative as a first argument', () => {
    const h = harness();
    h.exec('zetxy -270 120');
    expect([Math.round(h.turtle.x), Math.round(h.turtle.y)]).toEqual([-270, 120]);
  });
  it('keeps spaced minus as subtraction', () => expect(val('schrijf 10 - 4')).toBe('PRINT 6'));
  it('subtracts with a variable', () => expect(val('maak "d 3 schrijf :d - 1')).toBe('PRINT 2'));
  it('treats a glued minus after a number as an operator', () => expect(val('schrijf 100-50')).toBe('PRINT 50'));
});

describe('control flow', () => {
  it('exposes repcount', () => {
    const o = harness().exec('herhaal 3 [ schrijf teller ]');
    expect(o.join(',')).toBe('PRINT 1,PRINT 2,PRINT 3');
  });
  it('nests repcount correctly', () => {
    const o = harness().exec('herhaal 2 [ herhaal 2 [ schrijf teller ] ]');
    expect(o.join(',')).toBe('PRINT 1,PRINT 2,PRINT 1,PRINT 2');
  });
  it('takes the true branch of if', () => {
    expect(harness().exec('als 1 < 2 [ schrijf 42 ]')[0]).toBe('PRINT 42');
  });
  it('skips a false if', () => {
    expect(harness().exec('als 3 < 2 [ schrijf 42 ]').length).toBe(0);
  });
  it('runs ifelse', () => {
    expect(harness().exec('alsanders 3 < 2 [ schrijf 1 ][ schrijf 2 ]')[0]).toBe('PRINT 2');
  });
  it('loops while a condition holds', () => {
    const o = harness().exec('maak "n 0 zolang [ :n < 3 ] [ schrijf :n maak "n :n + 1 ]');
    expect(o.join(',')).toBe('PRINT 0,PRINT 1,PRINT 2');
  });
});

describe('errors', () => {
  const throws = (src: string) => () => harness().exec(src);
  const key = (src: string): string => {
    try { harness().exec(src); return 'NO THROW'; }
    catch (e) { return e instanceof LogoError ? e.key : 'OTHER'; }
  };
  it('rejects unknown commands', () => expect(key('zwiep 10')).toBe('unknown'));
  it('detects a missing bracket', () => expect(key('herhaal 4 [ vooruit 10')).toBe('nobracket'));
  it('detects an undefined variable', () => expect(key('vooruit :zoek')).toBe('novar'));
  it('requires end on a procedure', () => expect(key('naar p vooruit 10')).toBe('noend'));
  it('forbids division by zero', () => expect(key('schrijf 1 / 0')).toBe('divzero'));
  it('rejects an unknown colour', () => expect(key('penkleur "turquoise')).toBe('nocolor'));
  it('rejects a command used as a value', () => expect(key('schrijf vooruit 10')).toBe('novalue'));
  it('asks for brackets on repeat', () => expect(key('herhaal 4 vooruit 10')).toBe('needlist'));
  it('asks for brackets on if', () => expect(key('als 1 vooruit 10')).toBe('needlist'));
  it('asks for brackets on ifelse', () => expect(key('alsanders 1 [ vooruit 1 ] vooruit 10')).toBe('needlist'));
  it('asks for brackets on while', () => expect(key('zolang teller [ vooruit 10 ]')).toBe('needlist'));
  it('blames the line the brackets are missing on', () => {
    try { harness().exec('wisscherm\nherhaal 4 vooruit 10'); }
    catch (e) { expect((e as LogoError).line).toBe(2); }
  });
  it('still reports needlist when the value is not a list', () =>
    expect(key('herhaal 4 5')).toBe('needlist'));
  it('throws, not hangs, on the above', () => expect(throws('zwiep 10')).toThrow());
});

describe('blocks held in variables', () => {
  it('accepts a list from a variable as a repeat body', () => {
    const h = harness();
    h.exec('maak "blok [ vooruit 100 rechts 90 ] herhaal 4 :blok');
    expect(h.lines().length).toBe(4);
  });
  it('accepts a list reported by a procedure', () => {
    const h = harness();
    h.exec('naar blok geefterug [ vooruit 100 rechts 90 ] einde herhaal 4 blok');
    expect(h.lines().length).toBe(4);
  });
});

describe('fractals', () => {
  it('draws the Koch snowflake side to the right depth', () => {
    const h = harness();
    h.exec(
      'naar zij :l :d alsanders :d < 1 [ vooruit :l ][ ' +
      'zij :l / 3 :d - 1 links 60 zij :l / 3 :d - 1 rechts 120 ' +
      'zij :l / 3 :d - 1 links 60 zij :l / 3 :d - 1 ] einde zij 81 2',
    );
    expect(h.lines().length).toBe(16);
  });
});
