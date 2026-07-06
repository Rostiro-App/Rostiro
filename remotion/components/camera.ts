import { interpolate } from 'remotion'

// A minimal Ken-Burns-style camera helper: interpolates scale and a focus
// point (the origin the scale zooms toward) across a list of keyframes, so
// a scene can push in on the specific UI element being demonstrated instead
// of sitting at a flat, static wide shot the entire clip.

export interface CameraKeyframe {
  frame: number
  scale: number
  originX: number // percentage, 0-100
  originY: number // percentage, 0-100
}

export function cameraStyle(frame: number, keyframes: CameraKeyframe[]): React.CSSProperties {
  const frames = keyframes.map((k) => k.frame)
  const scale = interpolate(frame, frames, keyframes.map((k) => k.scale), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const originX = interpolate(frame, frames, keyframes.map((k) => k.originX), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const originY = interpolate(frame, frames, keyframes.map((k) => k.originY), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return {
    transform: `scale(${scale})`,
    transformOrigin: `${originX}% ${originY}%`,
  }
}
