# Rostiro Brand Kit v1.0
## Pass this file to Claude Code alongside Rostiro_PRD_v5.0.md

---

## The concept in one sentence

The pulse mark to the left of the wordmark changes color, amplitude, and animation speed based on the active Rostiro OS State. The wordmark stays constant. The pulse is what breathes.

---

## 1. Wordmark specification

**Font:** Inter, loaded from Google Fonts
**Weight:** 500 (Medium) — never 600 or 700
**Case:** ALL CAPS
**Letter-spacing:** -1px at large sizes, -0.5px at nav/small sizes
**Never use:** bold weight, italic, rotation, distortion, drop shadows, gradients

### Color versions

| Version | Wordmark color | Use case |
|---|---|---|
| In-product (dark) | `#D0E4F5` off-white | All in-app screens on dark bg |
| Marketing (dark) | `#FFFFFF` pure white | Landing page, social, press, App Store |
| On light/white | `#0D1B2A` navy | Docs, press kit, light mode surfaces |

### Tagline
- Text: `RUN EVERY LEAGUE`
- Font: Inter 400, ALL CAPS, letter-spacing 3.5px
- Color: `#4A6580`
- Size: 11px
- Use: Marketing / hero surfaces ONLY. Never inside the product UI.

---

## 2. The pulse mark

The pulse mark is an SVG polyline rendered to the left of the wordmark, separated by a thin vertical rule.

### Vertical divider rule
- Color on dark: `#1A3050`
- Color on light: `#CCC` or `#DDD`
- Width: 1px (0.8px at nav scale)
- Height: spans from cap-height to baseline of wordmark

### Assembly order (left to right)
```
[pulse polyline] [vertical rule] [ROSTIRO wordmark]
```

### Desktop mark dimensions (nav scale, ~17-20px wordmark)
- Pulse polyline viewBox width: ~28-32px
- Divider gap: 6-8px each side
- Total mark width: ~160-170px

### Large/hero mark dimensions (~38-44px wordmark)
- Pulse polyline viewBox width: ~36px
- Divider gap: 10px each side
- Total mark width: ~280-300px

---

## 3. OS State system — pulse configuration

The active state is computed by `lib/rostiroState.ts`. The `PulseMark` component reads `currentState` and maps it to these values.

### State configs

```typescript
const STATE_CONFIG = {
  draft: {
    color: '#EF9F27',      // amber
    amplitude: 11,          // px deviation from center baseline
    cycleSec: 1.8,
    strokeWidth: 2.0,
    description: 'High, fast. Opportunistic, forward momentum.',
    activePeriod: 'Preseason through last draft completion',
    emotion: 'Hope, excitement — This is my year',
  },
  standard: {
    color: '#378ADD',      // blue (matches primary UI accent)
    amplitude: 7,
    cycleSec: 3.0,
    strokeWidth: 2.0,
    description: 'Medium, slow. Calm intelligence, monitoring.',
    activePeriod: 'Wednesday through Saturday (default/resting state)',
    emotion: 'Preparation, planning, optimization',
  },
  waiver: {
    color: '#1D9E75',      // green
    amplitude: 10,
    cycleSec: 2.2,
    strokeWidth: 2.0,
    description: 'Medium-high, sharp peaks. Mission briefing energy.',
    activePeriod: 'Tuesday night / Wednesday AM (per-league cutoff)',
    emotion: 'Opportunity, urgency — Mission briefing',
  },
  gameday: {
    color: '#E24B4A',      // red
    amplitude: 13,          // maximum — jagged, volatile
    cycleSec: 1.2,
    strokeWidth: 2.2,       // slightly thicker for emphasis
    description: 'Maximum amplitude, fastest cycle. Alive, urgent.',
    activePeriod: 'Thursday night, Sunday (full intensity), Monday night',
    emotion: 'Mission control — suspense, momentum, alive',
  },
  filmroom: {
    color: '#7F77DD',      // purple
    amplitude: 5,           // minimum — shallow, contemplative
    cycleSec: 4.0,
    strokeWidth: 2.0,
    description: 'Low amplitude, slowest cycle. Reflective, review mode.',
    activePeriod: 'Monday night through Tuesday AM',
    emotion: 'Review, analysis — What happened?',
  },
};
```

### Playoffs / Championship overlay (weeks 15–17)

During NFL weeks 15–17, render a SECOND polyline over the active State pulse:

```typescript
const PLAYOFFS_OVERLAY = {
  color: '#F5C842',          // championship gold
  strokeWidth: 1.5,
  strokeDasharray: '3,2',    // dashed gold trace
  amplitude: 'same as active State',
  cycleSec: 'same as active State',
  opacity: 1,                // full opacity gold over dimmed State pulse
};

// When playoffs active, dim the State pulse to opacity 0.5
// then render gold dashed trace at full opacity on top
```

---

## 4. Animation implementation

### State transition
```typescript
// When state changes:
// - Color: CSS transition 800ms ease-in-out
// - Amplitude: interpolate over 800ms
// - Cycle speed: interpolate over 800ms
// Never an instant swap — user should feel the shift, not see a glitch
```

### Pulse animation approach
```typescript
// Use requestAnimationFrame or CSS animation on the polyline points
// The pulse "breathes" — peaks animate up and down on the cycle timer
// Each state's polyline shape reflects its amplitude permanently
// (not just animated to that amplitude — the shape IS the state)

// Simple approach: animate stroke-dashoffset on the polyline
// for a "drawing" effect that loops continuously
// More sophisticated: actually animate the Y coordinates of midpoints
```

### Boot sequence (first login only — Section 6.8 E1)
```
1. Pulse line draws left → right in current State color (600ms)
2. Vertical divider fades in (100ms)
3. ROSTIRO wordmark fades in letter by letter or as one (400ms)
4. Total: ~1.1 seconds before landing on Pulse dashboard
5. Never repeat this animation on subsequent logins
```

### prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Show static polyline in current State color */
  /* No animation loop */
  /* Color still transitions on State change (800ms) */
  /* Boot sequence: instant reveal, no draw animation */
}
```

---

## 5. Mobile mark (under 768px)

On screens under 768px, the full wordmark is hidden and replaced with:

```
[R lettermark] [pulse mark]
```

### R lettermark spec (mobile only)
- Character: `R`
- Font: Inter 500
- Color: `#D0E4F5` (same as in-product wordmark)
- Size: matches nav height (typically 18-20px)
- No vertical divider between R and pulse on mobile

### Mobile pulse mark
- Same polyline shape as desktop
- Same State color
- Same animation
- Scaled to ~16px height
- Rendered immediately to the right of the R

### Breakpoint
```css
@media (max-width: 767px) {
  /* Show: R + pulse mark */
  /* Hide: full ROSTIRO wordmark + vertical divider */
}
@media (min-width: 768px) {
  /* Show: pulse mark + divider + ROSTIRO wordmark */
  /* Hide: mobile R mark */
}
```

---

## 6. Color tokens — add to globals.css

```css
:root {
  /* Foundation */
  --r-navy-page:    #0D1B2A;  /* page background */
  --r-navy-dark:    #0A1520;  /* topbar, nav, system bar */
  --r-navy-card:    #0F2235;  /* cards, action items */
  --r-border:       #1A3050;  /* all borders on dark */
  --r-text-primary: #D0E4F5;  /* body text, in-product wordmark */
  --r-text-muted:   #4A6580;  /* secondary labels, timestamps */
  --r-off-white:    #F5F4F0;  /* light surface, daylight mode bg */

  /* OS State pulse colors */
  --r-draft:        #EF9F27;  /* amber */
  --r-standard:     #378ADD;  /* blue — also primary UI accent */
  --r-waiver:       #1D9E75;  /* green */
  --r-gameday:      #E24B4A;  /* red — also critical alert color */
  --r-filmroom:     #7F77DD;  /* purple — also Intelligence layer */
  --r-playoffs:     #F5C842;  /* championship gold */

  /* Animation */
  --r-state-transition: 800ms ease-in-out;

  /* Typography */
  --r-font:         'Inter', system-ui, sans-serif;
  --r-wm-weight:    500;
}
```

---

## 7. Typography system

| Role | Font | Weight | Size | Details |
|---|---|---|---|---|
| Wordmark | Inter | 500 | Any | ALL CAPS, letter-spacing -1px large / -0.5px nav |
| Tagline | Inter | 400 | 11px | ALL CAPS, letter-spacing 3.5px, #4A6580 |
| Nav / UI labels | Inter | 500 | 13–15px | Sentence case, #D0E4F5 |
| Body / secondary | Inter | 400 | 13–14px | #4A6580 or #88AACC, line-height 1.6 |
| Live data values | Inter | 500 | 12–13px | font-variant-numeric: tabular-nums — always |
| State badges | Inter | 500 | 10–11px | Lowercase, pill border-radius |
| Section labels | Inter | 500 | 11px | ALL CAPS, letter-spacing .1em, #4A6580 |

**Rule: font-variant-numeric: tabular-nums on ALL numeric values in the product. No exceptions.**

---

## 8. App icon system

### Standard icon (256x256)
- Background: `#0A1520`
- Border-radius: 18px (at 256px scale)
- Content: pulse mark only (no wordmark, no R)
- Pulse color: current State color (defaults to Standard blue)
- Pulse centered in icon canvas

### Notification icon
- Background: `#378ADD` (always blue, State-independent)
- Content: pulse mark in `#FFFFFF` white
- This is what users see in the notification tray

### Game Day icon variant
- Background: `#0A1520`
- Pulse: Game Day red `#E24B4A`, maximum amplitude

### Playoffs icon variant
- Background: `#0A1520`
- Pulse: red `#E24B4A` at 0.5 opacity + gold `#F5C842` dashed overlay

---

## 9. Usage rules

### Always
- Use pulse mark + wordmark together on desktop (768px+)
- Let pulse color reflect the active State from `lib/rostiroState.ts`
- Use `#D0E4F5` for in-product wordmark on dark backgrounds
- Use `#FFFFFF` for marketing wordmark (landing page, press, social)
- Show R + pulse on mobile under 768px
- Apply gold playoff overlay during NFL weeks 15–17
- Transition state colors over 800ms ease-in-out
- Honor `prefers-reduced-motion`
- Use `tabular-nums` on all live data

### Never
- Use the R lettermark alone as a desktop logo substitute
- Hardcode the pulse to Standard blue at all times
- Use Inter 600 or 700 on the wordmark
- Change wordmark color to anything other than `#FFFFFF` or `#D0E4F5` on dark
- Use the tagline (`RUN EVERY LEAGUE`) inside the product UI
- Add drop shadows, glow, or gradients to any mark element
- Show the pulse mark without the vertical divider on desktop
- Use Game Day red (`#E24B4A`) outside of Game Day State or critical alerts
- Rotate, stretch, or distort any mark element

---

## 10. File manifest

```
/docs/
  rostiro-brand-kit.md          ← this file (Claude Code reference)
  rostiro-brand-kit.html        ← full visual reference (open in browser)
  Rostiro_PRD_v5.0.md           ← product requirements

/public/
  /brand/
    wordmark-dark.svg           ← in-product (off-white text)
    wordmark-marketing.svg      ← marketing (pure white text)
    wordmark-light.svg          ← on light surfaces (navy text)
    wordmark-tagline.svg        ← with "Run Every League" tagline
    icon-standard.svg           ← app icon, Standard State
    icon-gameday.svg            ← app icon, Game Day State
    icon-notification.svg       ← notification tray icon

/components/
  PulseMark.tsx                 ← animated pulse mark component
  Wordmark.tsx                  ← full wordmark (pulse + divider + text)
  WordmarkMobile.tsx            ← mobile mark (R + pulse)

/lib/
  rostiroState.ts               ← State computation (already specified in PRD)
  brandTokens.ts                ← exports STATE_CONFIG and PLAYOFFS_OVERLAY
```

---

*Rostiro Brand Kit v1.0 · July 2026 · Run Every League.*
*Pass alongside Rostiro_PRD_v5.0.md to Claude Code.*
