import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Path, Skia, Group } from '@shopify/react-native-skia';
import {
  createInterpreter, Turtle, createDriver, SPEEDS, formatError,
  type DriverHandle, type Host, type Segment, type TurtleState,
} from '@schildpad/core';
import { EXAMPLES } from '@schildpad/content';
import { SkiaSurface, nativeClock } from './skia-surface.ts';

/**
 * Minimal but RUNNING mobile screen: it draws an example so you can verify the
 * shared core animates through Skia on-device, then build the editor/UI around
 * it. This intentionally stays small — the interesting, reusable logic already
 * lives in @schildpad/core. What remains is native UI: a code input, the pen
 * palette, examples, speed, and the sprite (port renderTurtle from web).
 *
 * The seam to notice: the exact same createInterpreter + createDriver as web.
 * Only the Surface (Skia) and Clock (RN rAF) differ.
 */

const LOGICAL_W = 1200;
const LOGICAL_H = 900;

export default function App() {
  const { width } = useWindowDimensions();
  const surface = useMemo(() => new SkiaSurface(LOGICAL_W, LOGICAL_H), []);
  const turtle = useMemo(() => new Turtle(surface), [surface]);
  const clock = useMemo(() => nativeClock(), []);
  const handleRef = useRef<DriverHandle | null>(null);
  const [status, setStatus] = useState('Klaar.');

  // Subscribe React to the Surface's retained draw state.
  const snap = useSyncExternalStore(
    (cb) => surface.subscribe(cb),
    () => surface.snapshot(),
  );

  const host: Host = useMemo(() => ({
    print: (s) => setStatus(s),
    mark: () => {},
    penChanged: () => {},
  }), []);

  const run = useCallback(() => {
    handleRef.current?.stop();
    turtle.reset();
    surface.clearInk();
    turtle.stepLen = SPEEDS[2];
    const src = EXAMPLES.nl[4].source; // the recursive tree
    let iter;
    try {
      iter = createInterpreter(turtle, host).run(src);
    } catch (e) {
      setStatus(formatError(e, 'nl'));
      return;
    }
    setStatus('Bezig met tekenen…');
    handleRef.current = createDriver(iter, turtle, surface, clock, {
      onDone: () => setStatus('Klaar.'),
      onError: (e) => setStatus(formatError(e, 'nl')),
    });
  }, [turtle, surface, clock, host]);

  // Logical -> device mapping (mirrors CanvasSurface.px/py).
  const scale = width / LOGICAL_W;
  const px = (x: number) => LOGICAL_W / 2 + x;
  const py = (y: number) => LOGICAL_H / 2 - y;

  // Keyed on inkVersion, not on the segments array: the Surface mutates that
  // array in place, so its identity never changes. inkVersion bumps on every
  // draw/clear and stays put while only the turtle sprite moves.
  const inkPath = useMemo(
    () => buildPath(snap.segments, px, py),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap.inkVersion],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.sheet, { width, height: width * (LOGICAL_H / LOGICAL_W) }]}>
        <Canvas style={{ flex: 1 }}>
          <Group transform={[{ scale }]}>
            {inkPath.map((p, i) => (
              <Path key={i} path={p.path} color={p.color} style="stroke"
                strokeWidth={p.width} strokeCap="round" strokeJoin="round" />
            ))}
            {snap.turtle && <TurtleSprite state={snap.turtle} px={px} py={py} />}
          </Group>
        </Canvas>
      </View>
      <View style={styles.bar}>
        <Text style={styles.status}>{status}</Text>
        <Pressable style={styles.btn} onPress={run}>
          <Text style={styles.btnText}>▶ Teken</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Group segments by (color,width) into Skia paths. */
function buildPath(segments: readonly Segment[], px: (n: number) => number, py: (n: number) => number) {
  const groups = new Map<string, { path: ReturnType<typeof Skia.Path.Make>; color: string; width: number }>();
  for (const s of segments) {
    const key = `${s.color}|${s.width}`;
    let g = groups.get(key);
    if (!g) { g = { path: Skia.Path.Make(), color: s.color, width: s.width }; groups.set(key, g); }
    g.path.moveTo(px(s.x0), py(s.y0));
    g.path.lineTo(px(s.x1), py(s.y1));
  }
  return [...groups.values()];
}

/** Placeholder sprite — port the full turtle from web canvas-surface.ts. */
function TurtleSprite({ state, px, py }: { state: TurtleState; px: (n: number) => number; py: (n: number) => number }) {
  const dot = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(px(state.x), py(state.y), 8);
    return p;
  }, [state.x, state.y]);
  return <Path path={dot} color={state.color} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1622', justifyContent: 'center' },
  sheet: { backgroundColor: '#FCFBF7', alignSelf: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  status: { color: '#8CA0B8', flex: 1, fontFamily: 'monospace', fontSize: 12 },
  btn: { backgroundColor: '#33A06B', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  btnText: { color: '#06210F', fontWeight: '600' },
});
