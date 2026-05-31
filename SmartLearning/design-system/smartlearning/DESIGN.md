# Design System: SmartLearning (Stitch DESIGN.md)

> Semantic design language for generating new SmartLearning screens in Google Stitch.
> Faithful to the locked implementation in `static/css/main.css` + `app.css`.
> When this file and `MASTER.md` disagree on a value, the **live CSS tokens win** (this file reflects them).

---

## 1. Visual Theme & Atmosphere

A calm, focused **study workspace** — Notion-style block notes plus a built-in Pomodoro timer.
The mood is *clinical-warm*: a clean teal-tinted canvas, deep petroleum-green ink, and a single
warm orange reserved for the one thing that matters on each screen. Flat design with real depth
coming from **petroleum-tinted shadows** (never harsh black), generous whitespace, and confident
asymmetry on marketing surfaces.

- **Density:** Daily App Balanced (4/10) — comfortable padding, breathing room, never cockpit-dense.
- **Variance:** Offset Asymmetric (6/10) — split hero, bento feature grid, left-aligned headers. No dead-centered hero.
- **Motion:** Fluid CSS Restrained (5/10) — scroll reveals, hover lifts, pointer-driven micro-interactions. No perpetual decorative loops.

---

## 2. Color Palette & Roles

Teal is the **brand anchor**; Orange is the **single saturated accent**. No purple, no neon, no second accent.

### Light (default)
- **Mint Frost** (`#F0FDFA`) — Primary page canvas (teal-tinted near-white)
- **Pure Surface** (`#FFFFFF`) — Cards, panels, popovers, modal fill
- **Deep Petroleum** (`#134E4A`) — Primary text and headings (off-black, never `#000000`)
- **Muted Teal** (`#2F6F69`) — Secondary text, metadata, descriptions
- **Progress Teal** (`#0D9488`) — Brand, links, active state, focus ring, secondary-button outline
- **Aqua** (`#2DD4BF`) — Lighter teal for illustration glows and ambient radial light
- **Achievement Orange** (`#EA580C`) — The single accent: primary CTA fill, achievement highlights, focus-pulling moments
- **Pale Mist** (`#E8F1F4`) — Muted surfaces, eyebrow pill background
- **Seafoam** (`#5EEAD4`) — Structural borders and decorative hairlines
- **Alert Red** (`#DC2626`) — Destructive actions and error text only

### Dark (opt-in via profile, never forced)
- **Ink Petroleum** (`#071716`) — Canvas · **Panel Petroleum** (`#0D2220`) — Surface
- **Mint Light** (`#EAFDF9`) — Primary text · **Sage** (`#9FC9C1`) — Secondary text
- **Deep Muted** (`#12302D`) — Muted · **Pine Border** (`#1E5E55`) — Border
- Brand teal and accent orange stay recognizable; design and contrast-check both modes independently.

### Shadows (petroleum-tinted, never pure black)
- **sm** `0 1px 2px rgba(19,78,74,0.06)` · **md** `0 6px 18px -6px rgba(19,78,74,0.14)`
- **lg** `0 18px 36px -10px rgba(19,78,74,0.18)` · **xl** `0 30px 60px -16px rgba(19,78,74,0.24)`
- **accent** `0 12px 28px -8px rgba(234,88,12,0.35)` (orange CTA only)

---

## 3. Typography Rules

- **Display / Headlines:** **Poppins** (600–700). Tracking-tight (`-0.02em`), line-height `1.12`,
  `text-wrap: balance`. Hierarchy through weight + color, not screaming scale.
  Hero scales via `clamp(2rem, 5vw + 1rem, 3.5rem)`.
- **Body:** **Open Sans** (400). Line-height `1.6`, max measure `65ch`, `text-wrap: pretty`,
  secondary color Muted Teal.
- **Labels / Eyebrows:** Poppins 600, uppercase, letter-spacing `0.04em`, small (`0.875rem`), Progress Teal on Pale Mist pill.
- **Numbers / Timers / Stats:** `font-variant-numeric: tabular-nums` (Pomodoro `25:00`, focus stats) to prevent layout shift. No separate mono font needed at this density.
- **Banned:** `Inter`, generic system fonts, all serifs (this is a software UI).

---

## 4. Component Stylings

- **Primary Button (one per screen):** Achievement Orange fill, white text, radius `8px`, petroleum-tinted accent shadow.
  Hover: lift `translateY(-2px)` + a soft light **sheen sweep** across. Active: `scale(0.98)` tactile push. Focus-visible: 3px teal ring.
- **Secondary Button:** Transparent, Progress Teal text + 2px teal border. Hover: fills teal, white text, lift `-2px`.
- **Nav links (pill):** Poppins 600 `0.92rem`, `padding 9px 14px`, radius `999px`, Muted Teal.
  Hover: subtle tinted background `rgba(19,78,74,0.06)` + lift `-1px`. One consistent pill family across marketing nav and app nav.
- **Cards:** Pure Surface, radius `12px`, 1px Pale Mist border, sm shadow. Hover: md shadow + lift `-2px`.
  Use cards only where elevation serves hierarchy; otherwise group with hairlines and whitespace.
- **Feature Bento (benefits):** One large tinted feature cell (teal radial wash) + two supporting cells. **Never 3 equal cards.**
  Cursor **spotlight** highlight follows the pointer inside each card (progressive enhancement only).
- **Inputs:** Label **above** the field, helper text below, error text below in Alert Red. Focus: teal border + 3px teal ring glow. No placeholder-as-label.
- **User menu:** Native `<details>` avatar pill (rounded-square avatar `26px` + name), popover with `menu-pop` spring entrance, right-aligned.
- **Pomodoro:** Floating bottom-right panel, radius `16px`, xl shadow, spring rise-in; head turns orange in break mode.
- **Loading:** Skeletal shimmer matching the real layout. No generic circular spinners.
- **Empty States:** Composed message + a clear action to populate (e.g. "Crie sua primeira anotação"). Never a bare "Sem dados".
- **Error States:** Inline, near the field/context, with a recovery path.

---

## 5. Layout Principles

- **Container:** centered, max-width `72rem` (~1152px); app shell `84rem`. Side gutter `1.5rem`.
- **Spacing:** strict 4/8px scale — `4 · 8 · 16 · 24 · 32 · 48 · 64`. Section blocks use `64px` vertical rhythm.
- **Grid over flex-math:** CSS Grid for all multi-column structure. No `calc()` percentage hacks.
- **Hero:** asymmetric split (copy left, animated preview right). **Centered hero banned.**
- **Mobile (<640px):** every multi-column layout collapses to a single column; bento → stacked; no horizontal scroll.
- **Viewport:** full-height sections use `min-h-[100dvh]`, never `h-screen`.
- **No overlapping content:** every element owns its spatial zone (the hero preview is a self-contained panel, not text over image).

---

## 6. Motion & Interaction

- **Easing tokens:** entrances `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-out`); playful pops `cubic-bezier(0.34, 1.4, 0.64, 1)` (`--ease-spring`). No linear easing on UI.
- **Scroll reveals:** `.reveal` fade-up via IntersectionObserver, staggered `~70–90ms` per item inside `[data-stagger]`.
- **Signature interactions:** pointer-driven **3D tilt** on the hero preview (max ~6deg, eases back on leave); **cursor spotlight** on benefit cards; **sheen sweep** + press-scale on buttons; brand-mark wobble; grow-underline on footer links.
- **Hero preview:** finite WAAPI float on the floating cards (3 iterations, `fill: both`) — never infinite.
- **Performance:** animate **only** `transform` and `opacity`. Grain/noise lives on a fixed `pointer-events:none` pseudo-element.
- **Reduced motion:** `prefers-reduced-motion` collapses tilt, spotlight, reveals, and all hover transforms to static/instant. Non-negotiable.
- **Restraint rule (learned):** **no perpetual decorative infinite loops** (pulsing CTAs, floating icon bobs). They fight hover states and distract. Motion must convey cause/effect, feedback, or hierarchy.

---

## 7. Anti-Patterns (Banned)

- ❌ **Em-dash (`—`) in any visible copy** — headings, eyebrows, buttons, body, captions, titles. Use a period, comma, colon, or parentheses. (Hard rule.)
- ❌ Emojis as structural icons — use SVG (Lucide / Heroicons / Simple Icons), one family, consistent stroke.
- ❌ `Inter` or generic system fonts; any serif in this software UI.
- ❌ Pure black `#000000` (text is Deep Petroleum `#134E4A`; dark canvas is `#071716`).
- ❌ Neon / outer-glow shadows; oversaturated accents beyond the single orange.
- ❌ Purple / blue "AI gradient" aesthetic.
- ❌ Gradient text on large headlines; custom mouse cursors.
- ❌ Overlapping elements; absolute-positioned content stacking on top of text.
- ❌ **3 equal feature cards** — use the asymmetric bento (1 feature + 2 support).
- ❌ Perpetual decorative infinite loops (pulse/bob on every component).
- ❌ Generic placeholder names ("John Doe", "Acme", "Nexus"); fake-round metrics (`99.99%`, `50%`).
- ❌ AI copy clichés ("Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize").
- ❌ Filler UI text / scroll cues ("Scroll to explore", bouncing chevrons).
- ❌ Broken Unsplash links — use `picsum.photos/seed/...` or generated/SVG assets.
- ❌ Centered hero; layout-shifting hovers; invisible focus states; placeholder-as-label.
- ❌ Dark mode forced by default (it is opt-in per user profile).

---

## Pre-Delivery Checklist (per screen)

- [ ] Zero em-dashes in visible copy
- [ ] One primary CTA (Achievement Orange); everything else subordinate
- [ ] Teal accent used identically across the whole screen; one 8px-scale radius system
- [ ] Poppins headings / Open Sans body; tabular figures for timers and stats
- [ ] Text contrast ≥ 4.5:1 in **both** light and dark; brand stays recognizable in dark
- [ ] `cursor: pointer` + visible focus ring + smooth 150–300ms transitions on all interactives
- [ ] Touch targets ≥ 44px; `prefers-reduced-motion` honored
- [ ] Responsive at 375 / 768 / 1024 / 1440; single-column collapse; no horizontal scroll
- [ ] No content hidden behind the sticky header / floating Pomodoro
