---
name: YUMMY
description: AI-powered multi-agent SDLC platform — phosphor terminal aesthetic
colors:
  # ── Primary ────────────────────────────────────────────────────────────────
  primary: "#00ff88"
  primary-dim: "#00cc66"
  primary-mute: "#004422"
  # ── Surface / Background ──────────────────────────────────────────────────
  bg: "#080c0a"
  bg-1: "#0d1210"
  bg-2: "#111a14"
  bg-3: "#1a2620"
  # ── Borders ───────────────────────────────────────────────────────────────
  border: "#1e2e24"
  border-2: "#243628"
  # ── Secondary — Amber (warnings / progress) ───────────────────────────────
  amber: "#ffb300"
  amber-dim: "#cc8800"
  # ── Semantic — Red (errors / destructive) ─────────────────────────────────
  red: "#ff4444"
  red-dim: "#991111"
  # ── Text ──────────────────────────────────────────────────────────────────
  text: "#c8ddd2"
  text-2: "#7a9e8a"
  text-3: "#3a5a48"
  text-inv: "#080c0a"
  # ── Panel Accent Colors ───────────────────────────────────────────────────
  accent-blue: "#00aaff"
  accent-cyan: "#00ffaa"
  accent-pink: "#ff79c6"
  accent-purple: "#aa88ff"
  accent-orange: "#ff6644"
  # ── Glow / Translucent — described in prose (alpha-based, no hex equivalent)
typography:
  font-mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
  font-display:
    fontFamily: "Syne, sans-serif"
  text-2xs:
    fontSize: 0.7rem
  text-xs:
    fontSize: 0.75rem
    lineHeight: 1.1rem
  text-sm:
    fontSize: 0.875rem
    lineHeight: 1.25rem
  text-base:
    fontSize: 0.925rem
    lineHeight: 1.5rem
  text-md:
    fontSize: 0.95rem
    lineHeight: 1.7
  text-lg:
    fontSize: 1.05rem
    lineHeight: 1.6rem
  text-xl:
    fontSize: 1.2rem
    lineHeight: 1.6rem
  text-2xl:
    fontSize: 1.4rem
    lineHeight: 1.85rem
  prose-h1:
    fontSize: 1.35rem
    fontFamily: "Syne, sans-serif"
    fontWeight: "700"
    letterSpacing: -0.02em
  prose-h2:
    fontSize: 1.15rem
    fontFamily: "Syne, sans-serif"
    fontWeight: "700"
    letterSpacing: -0.02em
  prose-h3:
    fontSize: 1rem
    fontFamily: "Syne, sans-serif"
    fontWeight: "700"
  prose-body:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: 0.85rem
    lineHeight: 1.7
  prose-code:
    fontSize: 0.82rem
  prose-code-block:
    fontSize: 0.8rem
    lineHeight: 1.6
  header-label:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: 0.7rem
    fontWeight: "400"
    letterSpacing: 0.1em
rounded:
  xs: 3px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  unit: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  tree-indent: 14px
  button-padding: 0.5em
  input-padding: 0.5em
  panel-padding: 20px
  tag-padding-x: 0.55em
  code-padding-x: 0.4em
  dialog-padding: 24px
components:
  # ── Buttons ──────────────────────────────────────────────────────────────
  button-primary:
    backgroundColor: "{colors.primary-mute}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    padding: "{spacing.button-padding}"
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inv}"
  button-destructive:
    backgroundColor: transparent
    textColor: "{colors.red}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    height: 36px
  button-destructive-hover:
    backgroundColor: "{colors.red-dim}"
    textColor: "#ffffff"
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    height: 36px
  button-outline-hover:
    textColor: "{colors.text}"
  button-secondary:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    height: 36px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.text-3}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    height: 36px
  button-ghost-hover:
    backgroundColor: "{colors.bg-2}"
    textColor: "{colors.text}"
  button-amber:
    backgroundColor: transparent
    textColor: "{colors.amber}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    height: 36px
  button-amber-hover:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.text-inv}"
  # ── Inputs ───────────────────────────────────────────────────────────────
  input-field:
    backgroundColor: "{colors.bg-1}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-sm}"
    padding: "{spacing.input-padding}"
    height: 36px
  # ── Dialog / Modal ───────────────────────────────────────────────────────
  dialog-overlay:
    backgroundColor: "#00000099"
  dialog-content:
    backgroundColor: "{colors.bg-1}"
    rounded: "{rounded.xl}"
    padding: "{spacing.dialog-padding}"
  dialog-title:
    typography: "{typography.prose-h2}"
    textColor: "{colors.primary}"
  # ── Panels ───────────────────────────────────────────────────────────────
  panel:
    backgroundColor: "{colors.bg-1}"
    rounded: "{rounded.lg}"
  panel-header:
    backgroundColor: "{colors.bg}"
    typography: "{typography.header-label}"
    textColor: "{colors.text-3}"
    height: 32px
  # ── Cards ────────────────────────────────────────────────────────────────
  card-agent:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.lg}"
  card-agent-body:
    padding: "{spacing.panel-padding}"
  # ── Tabs ─────────────────────────────────────────────────────────────────
  tab-trigger:
    typography: "{typography.text-xs}"
    textColor: "{colors.text-3}"
    padding: 10px 16px
  tab-trigger-active:
    textColor: "{colors.primary}"
  tab-trigger-hover:
    textColor: "{colors.text}"
  # ── Badges ───────────────────────────────────────────────────────────────
  badge-green:
    backgroundColor: "{colors.primary-mute}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    typography: "{typography.text-xs}"
    padding: 2px 8px
  badge-amber:
    backgroundColor: "#ffb3001a"
    textColor: "{colors.amber}"
  badge-red:
    backgroundColor: "#ff44441a"
    textColor: "{colors.red}"
  badge-gray:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.text-2}"
  # ── Navigation ───────────────────────────────────────────────────────────
  activity-bar:
    backgroundColor: "{colors.bg}"
    width: 48px
  brand-tile:
    backgroundColor: "{colors.primary-mute}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    size: 32px
  # ── SDLC Stepper ─────────────────────────────────────────────────────────
  stepper-completed:
    backgroundColor: "{colors.primary-mute}"
    textColor: "{colors.primary}"
  stepper-active:
    backgroundColor: "#00ff880d"
    textColor: "{colors.primary}"
  stepper-waiting:
    backgroundColor: "#ffb30014"
    textColor: "{colors.amber}"
  stepper-pending:
    textColor: "{colors.text-3}"
  stepper-approve:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.text-inv}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  # ── Progress ─────────────────────────────────────────────────────────────
  progress-track:
    backgroundColor: "{colors.bg-2}"
    rounded: "{rounded.xs}"
    height: 3px
  progress-fill:
    backgroundColor: "{colors.amber}"
  # ── Code Display ─────────────────────────────────────────────────────────
  code-block:
    backgroundColor: "{colors.bg-1}"
    rounded: "{rounded.sm}"
    padding: 0.8em 1em
  inline-code:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.amber}"
    rounded: "{rounded.xs}"
    padding: 0.1em 0.4em
  # ── Blockquote ───────────────────────────────────────────────────────────
  blockquote:
    backgroundColor: "{colors.primary-mute}"
    textColor: "{colors.text-2}"
    padding: 0.5em 1em
  # ── Scrollbar ────────────────────────────────────────────────────────────
  scrollbar-thumb:
    backgroundColor: "{colors.border-2}"
    width: 6px
  scrollbar-thumb-hover:
    backgroundColor: "{colors.primary-mute}"
  # ── Toasts ───────────────────────────────────────────────────────────────
  toast-success:
    backgroundColor: "{colors.primary-mute}"
    textColor: "{colors.primary}"
  toast-error:
    backgroundColor: "{colors.red-dim}"
    textColor: "#ffffff"
  toast-info:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.text-2}"
  # ── Accent Panel References ──────────────────────────────────────────────
  panel-accent-tracing:
    backgroundColor: "{colors.accent-blue}"
  panel-accent-world:
    backgroundColor: "{colors.accent-cyan}"
  panel-accent-wiki:
    backgroundColor: "{colors.accent-pink}"
  panel-accent-backlog:
    backgroundColor: "{colors.accent-purple}"
  panel-accent-db:
    backgroundColor: "{colors.accent-orange}"
---

## Overview

**Phosphor Terminal** — a dark, neon-lit, hacker-aesthetic IDE for AI-powered
software development. The design language fuses the utilitarian precision of a
code editor with the kinetic energy of a cyberpunk console. Every surface feels
backlit by phosphor green (#00ff88), every interaction crackles with purpose.

The brand personality is **playful but professional**: the tool is named YUMMY
and ships with taglines like "better than your ex," yet the interface is crisp,
keyboard-driven, and respects the user's time with zero superfluous decoration.

The dominant emotional response is **focused intensity**. The deep charcoal
backgrounds recede, the phosphor green accent pulls the eye to what matters,
and the subtle CRT scanlines evoke a tool that's alive — a machine that's ready
to build.

### Theme Variants

The design system supports six mood-based themes, all sharing the same token
structure but swapping palette values. Each theme overrides every color token
while preserving the same contrast hierarchy:

| Theme    | Mood       | Accent Color     | Surface Tone    |
|----------|------------|------------------|-----------------|
| Dark     | Focused    | Phosphor Green   | Deep charcoal   |
| Light    | Explain    | Forest Green     | Warm white      |
| Dracula  | Nervous    | Electric Purple  | Deep navy       |
| Yummy    | Love       | Bubblegum Pink   | Dark plum       |
| Angry    | Angry      | Hot Orange       | Charred red     |
| Idea     | Idea       | Golden Yellow    | Cool navy       |

Themes are applied at runtime by swapping CSS custom properties on the root
element. The scanline pattern adapts its tint to match the active theme.

## Colors

The palette is built on a **four-layer dark surface stack** that creates depth
without relying on heavy shadows. Each layer steps lighter by a controlled
amount, giving panels, cards, and elevated elements distinct visual weight.

### Surface Layers

- **bg (#080c0a):** The deepest layer — the canvas. Used for the page
  background, layout separators, and the outermost chrome. Nearly black with a
  subtle green undertone.
- **bg-1 (#0d1210):** One step up. The default panel background. Dark enough to
  recede, light enough to hold readable content.
- **bg-2 (#111a14):** Two steps up. Hover states, secondary cards, and active
  item backgrounds. The green undertone becomes more apparent.
- **bg-3 (#1a2620):** The lightest surface. Form field backgrounds, code
  snippets, and tertiary containers. The green tint is now explicit.

### Accent — Phosphor Green

The single most important color in the system. Phosphor green (#00ff88) is a
pure, luminous green with CRT-monitor heritage. It drives every primary action,
brand moment, and active state.

- **primary (#00ff88):** The hero. Used for active tab indicators, primary text
  accents, brand marks, and the landing page ASCII logo. Never used as a solid
  background for large areas — it's a highlight, not a fill.
- **primary-dim (#00cc66):** Muted but still vibrant. Applied as 1px solid
  borders on active elements, hover transitions, and secondary green UI accents.
- **primary-mute (#004422):** A dark, desaturated green. The workhorse
  background for primary buttons, active states, and container accents. Dark
  enough to read white text against, green enough to feel connected to the
  phosphor family.
- **Phosphor glow:** A translucent phosphor wash (`rgba(0,255,136,0.08)`) applied
as subtle box-shadows, focus rings, and atmospheric glows that make UI elements
feel lit from within. Not a color token — always used via CSS box-shadow.

### Semantic Accents

- **amber (#ffb300):** Warnings, progress indicators, SDLC "approve" buttons,
  and inline code text. Warmer than green, it signals action and attention
  without implying danger. Hover states fill solid amber with inverted text.
- **red (#ff4444):** Destructive actions, error states, and the pipeline stop
  button. Always paired with red-dim (#991111) for borders and hover backgrounds.
  The linter warns about this at small sizes — use at 14px+ for legibility.
- **accent-blue (#00aaff):** Tracing and RAG trace panel headers.
- **accent-cyan (#00ffaa):** World panel and tool execution results.
- **accent-pink (#ff79c6):** Wiki panel and Dev/QA/SEC/SRE agent stage.
- **accent-purple (#aa88ff):** Backlog / JIRA Kanban panel headers.
- **accent-orange (#ff6644):** Database explorer panel header.

### Text Hierarchy

Four-tier text scale that maintains readability against the dark surfaces:

- **text (#c8ddd2):** Primary body text. A soft, green-tinted white that won't
  strain eyes during long sessions. Used for paragraphs, labels, and primary
  content.
- **text-2 (#7a9e8a):** Secondary text. Metadata, captions, secondary labels.
  Pulls back from primary while remaining legible.
- **text-3 (#3a5a48):** Tertiary / placeholder text. Borders on decorative.
  Used for disabled states, empty-state hints, placeholder text, and inactive
  navigation icons.
- **text-inv (#080c0a):** Inverse text. The same deep charcoal as the page
  background — used when rendering text on a green or amber solid fill
  (hovered buttons, approve CTAs).

### Color Application Rules

- **Borders are required.** Every container with border-radius must have a 1px
  solid border. `border` (#1e2e24) for structural edges and panel borders;
  `border-2` (#243628) for input fields and lighter dividers.
- **No solid green backgrounds** except for the hover state on primary buttons.
  Phosphor green is always a foreground color or border, never a fill.
- **Glow accents** are applied as `box-shadow` values, not as
background fills. The maximum glow intensity on interactive elements is the
button hover glow: `0 0 12px rgba(0, 255, 136, 0.3)`.
- **Surfaces never use pure black.** Every background token has a green
  undertone. The darkest surface (bg) is `#080c0a`, not `#000000`.

## Typography

The system uses two typefaces in a classic **terminal + editorial** pairing.

### JetBrains Mono (Primary)

A developer-oriented monospace with excellent legibility at small sizes.
The default typeface for body text, code, labels, inputs, buttons, and all
interactive text. Loaded in weights 300, 400, 500, and 700.

- **Body text** is set at 0.925rem (text-base) with 1.5 line-height — slightly
  larger than browser default to compensate for the dark background.
- **UI labels and metadata** use 0.75rem (text-xs) with tight but readable
  spacing.
- **Panel headers** use 0.7rem uppercase (header-label) with wide 0.1em
  tracking — intentionally small and utilitarian, acting as structural labels
  rather than decorative titles.
- **Code blocks** render at 0.8rem (prose-code-block) with 1.6 line-height for
  comfortable reading.

### Syne (Display)

A bold, characterful sans-serif used exclusively for **headings and brand
moments**. Loaded in weights 400, 700, and 800.

- Headings (h1–h4) always use Syne at weight 700 with -0.02em letter-spacing
  for a tight, confident lockup.
- Within prose/markdown content, h1 renders at 1.35rem in phosphor green,
  creating a clear visual anchor for AI-generated content.
- The brand tile (the "Y" in the Activity Bar) uses Syne at weight 800 —
  maximum impact at minimum size.

### Hierarchy Rules

- **Always use Syne for headings** (.prose h1–h4, dialog titles, brand marks).
  Never use it for body text or UI labels.
- **Always use JetBrains Mono for everything else.** The consistency reinforces
  the "terminal IDE" metaphor.
- **Increase font weight** by one level when rendering text on translucent
  backgrounds to compensate for reduced contrast.
- **Never mix typefaces** within the same visual unit. A card header and its
  body text must belong to the same family.

## Layout & Spacing

### Master Layout

The workspace uses a **three-column resizable layout** with a fixed left rail:

```
┌────┬──────────┬──────────────┬──────────┐
│    │          │              │          │
│ AB │ Context  │  MainStage   │ AI       │
│    │ Panel    │  (tabs)      │ Copilot  │
│    │          │              │          │
└────┴──────────┴──────────────┴──────────┘
 48px   20%          50%           30%
```

- **Activity Bar (48px):** Fixed-width vertical icon rail. Never resizes.
- **Left / Center / Right panels:** Resizable via drag handles with 4px-wide
  separators. Default split is 20% / 50% / 30%. Separators use `border` color
  and show a `col-resize` cursor on hover.

### Spacing Scale

Built on a **4px base unit** for precision:

| Token         | Value | Usage                                      |
|---------------|-------|---------------------------------------------|
| unit          | 4px   | Tightest spacing — tag padding, small gaps  |
| xs            | 8px   | Icon gaps, badge padding, compact lists     |
| sm            | 12px  | Card internal padding, list item gaps       |
| md            | 16px  | Panel padding, form field gaps              |
| lg            | 24px  | Dialog padding, section margins             |
| xl            | 32px  | Large section breaks, onboarding spacing    |
| tree-indent   | 14px  | File tree indentation per depth level       |

The File Tree uses a consistent 14px indentation per depth level, creating a
clean, code-editor-like hierarchy without excessive whitespace.

### Negative Space

The design philosophy is **dense where it matters, breathing where it doesn't**.
Panel content is compact and utilitarian — this is a tool, not a marketing page.
The outer chrome (separators, panel margins, the scanline background) gives the
workspace room to feel expansive.

## Elevation & Depth

Depth in this system is achieved through **layered backgrounds and subtle
shadows**, not through dramatic elevation differences.

### The Surface Stack

| Elevation | Token | Visual Cue                                    |
|-----------|-------|-----------------------------------------------|
| 0 (Root)  | bg    | Scanline pattern visible, darkest surface     |
| 1 (Panel) | bg-1  | Solid fill, borders visible                   |
| 2 (Hover) | bg-2  | Slightly lighter, used for hover/active       |
| 3 (Input) | bg-3  | Lightest fill, used for form fields and code  |

### Shadows

Shadows are used sparingly and **always dark**. There are no colored or
multi-layered shadows — the system relies on surface contrast for most depth.

| Name         | Value                                  | Usage                        |
|--------------|----------------------------------------|------------------------------|
| card         | `0 4px 20px rgba(0,0,0,0.25)`        | Agent cards, elevated panels |
| dialog       | `0 32px 80px rgba(0,0,0,0.6)`        | Modal dialogs                |
| modal        | `0 20px 60px rgba(0,0,0,0.5)`        | Inline modals, wizards       |
| input-focus  | `0 0 0 2px rgba(0,255,136,0.06)`     | Input field focus ring       |
| button-glow  | `0 0 12px rgba(0,255,136,0.3)`       | Primary button hover         |
| landing-glow | `0 0 20px rgba(0,255,136,0.4)`       | Landing page ASCII logo      |
| text-glow    | `0 0 10px rgba(0,255,136,0.5)`       | Glow accent on headings      |

The button glow is the **only colored shadow** in the system — it uses phosphor
green to signal interaction energy. All other shadows use black with varying
alpha values.

### Modals & Overlays

The dialog system uses three z-index layers:
1. **Overlay (z-400):** A dark backdrop (`rgba(0,0,0,0.6)`) with 4px backdrop
   blur, creating a frosted-glass effect that obscures the workspace.
2. **Content (z-401):** A centered panel with `rounded.xl` corners, the dialog
   shadow, and a 1px `border`. Close button in the top-right corner.
3. **Command Palette (z-401):** A dialog variant with zero internal padding,
   a search input at the top, and keyboard-navigable results below.

Other z-index values: `separator: 50`, `tooltip: 100`, `fab: 300`, `modal: 500`,
`max: 600`.

## Shapes

The shape language is **industrial but not brutal**. Corners are rounded enough
to feel modern and approachable, but the radii are deliberately small —
reminiscent of terminal windows and code editor tabs.

### Radius Scale

| Token | Value  | Usage                                              |
|-------|--------|-----------------------------------------------------|
| xs    | 3px    | Inline code, progress bar endpoints, small chips    |
| sm    | 4px    | Buttons, inputs, panels, most interactive elements  |
| md    | 6px    | Code block containers, editable textareas           |
| lg    | 8px    | Panel containers, agent cards                       |
| xl    | 12px   | Dialog modals                                       |
| full  | 9999px | Circular elements (status dots, spinners, avatars)  |

### Borders

Borders are **1px solid** everywhere. They're a critical part of the visual
language — without them, dark surfaces would blend into each other.

- **border (#1e2e24):** Structural edges. Panel perimeters, card borders, layout
  separators, tab strip bottom edges.
- **border-2 (#243628):** Secondary borders. Input fields, hover-state
  indicators, non-structural dividers.

**Rule:** No border-radius without a border. Every rounded container must have
a visible 1px solid edge. This isn't a "flat" design system — edges define
the surface hierarchy.

## Components

### Buttons

Six variants built on a shared base: `inline-flex` display, 0.4em icon gap,
monospace font at 0.875rem, and a 150ms ease transition on all properties.
Every variant has a clear hover state that inverts or intensifies colors.

**Sizes:** `sm` (32px height), `default` (36px), `lg` (40px), `icon` (36×36px
square). All maintain the same border-radius and font treatment.

**Disabled state:** 40% opacity with `cursor: not-allowed`. No hover effects.

#### Variant Reference

- **primary (default):** `primary-mute` background, `primary` text, `primary-dim`
  1px border. On hover, fills solid `primary` with `text-inv` text and a
  phosphor glow (`0 0 12px rgba(0,255,136,0.3)`). This is the dramatic
  "ignition" effect — the only colored shadow in the system.
- **outline:** Transparent background, `text-2` text, `border-2` border. Hover
  shifts border to `primary-mute` and text to `text` (full white).
- **secondary:** `bg-3` fill, `text-2` text, `border-2` border. Hover lightens
  to `bg-2` with `text` color. Used for "selected but not primary" states.
- **ghost:** Fully transparent, no border, `text-3` text. Hover reveals `bg-2`
  background and `text` color. Used for Activity Bar icons and subtle navigation.
- **destructive:** Transparent, `red` text, `red-dim` border. Hover fills
  `red-dim` with white text. Used for delete and stop actions.
- **amber:** Transparent, `amber` text, `amber-dim` border. Hover fills solid
  `amber` with `text-inv` text. Used for warning-level actions and the SDLC
  approve flow.

### Input Fields

Monospace text inputs at 36px height with `bg-1` fill and `border-2` border
(1px solid). On focus, the border shifts to `primary-mute` and a subtle green
focus ring appears: `0 0 0 2px rgba(0,255,136,0.06)`. Placeholder text uses
`text-3`. Padding is 0.5em vertical, 0.8em horizontal.

### Dialog / Modal

A three-component system using the dialog shadow (`0 32px 80px rgba(0,0,0,0.6)`):

1. **Overlay:** Full-screen dark backdrop at 60% opacity with 4px backdrop blur.
   Fades in over 300ms.
2. **Content:** Centered panel (max-width 512px) with `rounded.xl` corners,
   `bg-1` fill, 24px padding, and a 1px `border` edge. Animates in with a
   combined fade + zoom (95% → 100%) transition over 300ms.
3. **Close button:** Absolute-positioned top-right. An X icon from Lucide
   rendered in `text-3`, hover shifts to `text`.

**DialogTitle** uses Syne at 1.15rem in phosphor green with -0.02em
letter-spacing. **DialogDescription** uses monospace at 0.875rem in `text-3`.

### Tabs

Monospace trigger buttons at 0.75rem, uppercase with wide tracking. Each tab
has a semantic accent color that activates with a 2px bottom border:

- **Default:** `text-3` text, transparent bottom border.
- **Hover:** `text` (full white) text, `bg-3` bottom border.
- **Active:** Tab's accent color on both text and a 2px solid bottom border.
  Tab accent colors: green (Node Arch), amber (Insights, SDLC), pink (Wiki),
  blue (RAG Trace), purple (Backlog), orange (Database), cyan (World).

Tabs are rendered in a horizontal strip with a `border` bottom edge. The tab
list scrolls horizontally when content overflows.

### Agent Cards

Timeline-anchored cards for the SDLC pipeline. Each card uses the card shadow
(`0 4px 20px rgba(0,0,0,0.25)`) and a 1px `border`:

- **Timeline dot:** 14px circle positioned 38px left of the card. Uses `bg`
  fill and a 2px colored border reflecting the agent's stage color.
- **Header:** Agent name in the agent's semantic color (green for BA, amber for
  SA, blue `#64a0ff` for Dev Lead, pink for DEV/QA/SEC/SRE). 10px vertical
  padding, 20px horizontal, with a `border` bottom edge.
- **Body:** 20px padding. Contains either streaming AI output (rendered as
  `.prose` markdown with auto-scroll), a loading spinner in amber, or an
  editable textarea (280px min-height, 6px border-radius, `bg-1` fill, monospace).
- **Approve button:** Appears at the card footer when in the "waiting for
  approval" state. Solid amber background with `text-inv` text, 6px
  border-radius, and a checkmark icon. Disabled at 60% opacity when busy.

### Badges & Tags

Four preset variants, all using 0.75rem uppercase monospace text in a compact
pill (2px vertical, 8px horizontal padding). Each has a 1px border in its
respective dim color:

- **green:** `primary-mute` background, `primary` text, `primary-dim` border.
  For success and "done" states.
- **amber:** `rgba(255,179,0,0.1)` background, `amber` text, `amber-dim` border.
  For warnings and "in progress" states.
- **red:** `rgba(255,68,68,0.1)` background, `red` text, `red-dim` border.
  For errors and failures.
- **gray:** `bg-3` background, `text-2` text, `border-2` border.
  For neutral metadata and generic labels.

### Activity Bar

A 48px-wide vertical rail with `bg` fill and a 1px right `border`. Contains:

- **Brand tile (top):** 32×32px square with `rounded.md` corners, `primary-mute`
  fill, and a phosphor green "Y" in Syne weight 800.
- **Divider line:** 1px horizontal line in `border` color, 32px wide.
- **Icon buttons:** Six 36×36px buttons with `rounded.md` corners. Lucide icons
  at 20px. Inactive state uses `text-3`. Active state uses the item's semantic
  color with a `bg-2` background. The SDLC icon shows a pulsing amber dot
  (8×8px, `rounded.full`) at its top-right when the pipeline is running.

### SDLC Stepper

A horizontal step indicator with four stages connected by chevron arrows in
`text-3`. Each step is a rounded pill with an icon and label:

- **Completed:** `primary-mute` background, `primary` text, checkmark icon.
- **Active:** `rgba(0,255,136,0.05)` background, `primary` text, spinning
  loader icon.
- **Waiting for approval:** `rgba(255,179,0,0.08)` background, `amber` text,
  `amber-dim` border, with an inline "Approve" button (solid amber, inverted
  text, 4px radius).
- **Pending:** `text-3` text, circle outline icon.

### Code & Prose Display

Rendered markdown throughout the application follows these patterns:

- **Code blocks:** `bg-1` background with a 3px `primary-mute` left border
  (simulating a code editor gutter). A small header bar (0.68rem uppercase in
  `text-3`) displays the language name. Body text at 0.8rem with 1.6
  line-height. Full container uses `rounded.md` with a 1px `border`.
- **Inline code:** `bg-3` background with 1px `border`, `amber` text color,
  3px border-radius, 0.1em vertical / 0.35em horizontal padding.
- **Blockquotes:** 3px `primary-dim` left border, `primary-mute` background,
  rounded right corners (0 4px 4px 0), 0.5em 1em padding. Rendered in `text-2`
  with italic styling.
- **Headings (h1–h3):** Syne font family. h1 and h2 in `primary` (phosphor
  green). h3 in `text` (body color).
- **Tables:** Full-width with `bg-3` header row in `primary`, alternating
  `bg-1` row stripes, all cells bordered with 1px `border`.
- **Links:** `primary` color with underline.
- **Strong text:** `primary-dim` color, weight 600.

### Progress Bar

A thin horizontal bar for scan progress and loading states:
- **Track:** `bg-2` fill, 3px height, `rounded.xs` (3px) endpoints.
- **Fill:** `amber` solid, matching the track's border-radius.

### Scrollbar

Custom scrollbar styling (6px width):
- **Track:** Transparent.
- **Thumb:** `border-2` fill, 2px border-radius. On hover, shifts to
  `primary-mute` with a smooth color transition.

## Motion

All interactive elements use a **150ms ease** transition on color, background,
and border properties. This is the system's default timing — fast enough to
feel responsive, slow enough to be perceived as intentional.

### Animation Catalog

| Animation  | Duration | Easing    | Keyframes                                         |
|------------|----------|-----------|----------------------------------------------------|
| blink      | 1s       | step-end  | 50% `{ opacity: 0 }`, infinite loop               |
| fade-in    | 300ms    | ease      | from `opacity:0; translateY(4px)` to `opacity:1`   |
| slide-in   | 250ms    | ease      | from `opacity:0; translateX(-8px)` to `opacity:1`  |
| spin       | 1s       | linear    | Full rotation, infinite (Tailwind animate-spin)     |

- **blink:** Used for the cursor indicator in streaming text outputs.
- **fade-in:** Panel and card mount transitions. Elements enter from 4px below.
- **slide-in:** List items and sidebar content. Elements enter from 8px left.
- **spin:** Loading spinners (Loader2 icon from Lucide). Used in scan progress,
  streaming indicators, and async action feedback.

### Scanline Background

The page body carries a `repeating-linear-gradient` scanline pattern:
- **Stripe color:** `rgba(0,255,136,0.012)` at 1.2% opacity on the dark theme.
  This is the same phosphor green hue at extremely low alpha — enough to be
  perceived, not enough to distract.
- **Pattern:** 2px transparent, 2px tinted stripe, repeating vertically.
- **Light theme:** Scanlines are disabled (transparent).
- **Other themes:** The tint color shifts to match the theme's accent
  (purple for Dracula, pink for Yummy, orange for Angry, gold for Idea).

## Do's and Don'ts

### Do

- **Use phosphor green as a highlight, not a fill.** It draws the eye — button
  text, border accents, active indicators, headings. The only exception is
  the primary button hover state, which fills solid green.
- **Always pair a border with a border-radius.** Unbordered rounded elements
  feel incomplete in this dark theme. Every rounded container needs a 1px solid
  border from the `border` or `border-2` tokens.
- **Use monospace for all interactive and body text.** The consistency is the
  personality. The only exception is Syne for headings and brand marks.
- **Include the scanline background on every page.** It's the identity signal —
  a quiet reminder that this is a tool, not a brochure.
- **Use the surface stack (bg → bg-1 → bg-2 → bg-3) for depth.** Reserve
  box-shadows for modals, agent cards, and the button hover glow only.
- **Use the 150ms ease transition on all interactive elements.** Faster feels
  mechanical; slower feels sluggish. 150ms is the sweet spot.
- **Maintain the 4px spacing grid** for internal component padding and gaps.
  Deviate only for optical adjustments at very small scales.
- **Round file tree indentation** to multiples of the 14px tree-indent token.

### Don't

- **Don't use Syne for body text, labels, buttons, or code.** It is a display
  face exclusively for headings and brand moments.
- **Don't use pure white (#ffffff) for body text.** Always use the text tokens
  (text, text-2, text-3) which carry the subtle green tint. Pure white is only
  acceptable on destructive/error hover states where maximum contrast is needed.
- **Don't add new shadow colors.** The system uses black-alpha shadows
  exclusively, except for the singular phosphor green button glow. Adding
  colored shadows fragments the lighting model.
- **Don't mix border styles.** Every border is `1px solid` with a border token.
  No dashed, dotted, double, or variable-width borders.
- **Don't introduce font sizes outside the defined scale.** The 2xs through 2xl
  range plus the prose-specific sizes cover every need.
- **Don't use solid color backgrounds for cards and panels** — always use the
  surface tokens (bg-1, bg-2, bg-3) and border tokens.
- **Don't hide the Activity Bar.** It is the primary navigation anchor and brand
  presence. Every workspace view must include it at 48px fixed width.
- **Don't omit the scanline pattern** on the root page background. Even at 1.2%
  opacity, its absence is noticeable and breaks the terminal aesthetic.
