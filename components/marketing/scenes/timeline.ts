/** Deterministic frame-timeline math — the "editing timeline" for scenes. */

export function interpolate(
  frame: number,
  [f0, f1]: [number, number],
  [v0, v1]: [number, number],
  { clamp = true }: { clamp?: boolean } = {},
): number {
  if (f1 === f0) return v0
  let t = (frame - f0) / (f1 - f0)
  if (clamp) t = Math.max(0, Math.min(1, t))
  return v0 + t * (v1 - v0)
}

/** Inclusive of `start`, exclusive of `end`. */
export function inRange(frame: number, start: number, end: number): boolean {
  return frame >= start && frame < end
}

/** 0..1 position of `frame` within [start, end], clamped. */
export function progress(frame: number, start: number, end: number): number {
  return interpolate(frame, [start, end], [0, 1])
}
