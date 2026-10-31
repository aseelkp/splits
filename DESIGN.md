---
name: Splits
description: A one-handed gym logger where weight is loaded as real plates on a barbell, not typed into a table.
colors:
  ground: "#0f1a17"
  chalk: "#eaf2ec"
  muted-sage: "#a9baaf"
  hairline: "#2a3d36"
  field-edge: "#6f8a7e"
  lime: "#c6f135"
  on-lime: "#121b05"
  sheet: "#162620"
  scrim: "#070d0b"
  error-coral: "#ff8a8a"
  plate-edge: "#0f1a17"
  plate-ink: "#0b1210"
  plate-blue: "#6aa4ff"
  plate-green: "#3ddc97"
  plate-yellow: "#ffd23f"
  plate-white: "#f2f5f3"
  plate-red: "#ff7a7a"
  plate-silver: "#b9c7be"
  plate-neutral: "#7f968a"
  light-ground: "#f1f5ee"
  light-ink: "#101a15"
  light-muted: "#4f6056"
  light-hairline: "#c9d5cb"
  light-field-edge: "#7a8f82"
  light-green: "#2f7d1f"
  light-on-green: "#ffffff"
  light-scrim: "#9faaa1"
  light-error: "#b3261e"
  light-plate-neutral: "#9db0a3"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.25
  label:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.25
rounded:
  field: "1rem"
  key: "0.875rem"
  box: "1.375rem"
  sheet: "1.75rem"
  pill: "999px"
  disc: "50%"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  gutter: "1.25rem"
  lg: "1.75rem"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.on-lime}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem 0 1.75rem"
    height: "4.25rem"
  pill:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.pill}"
    padding: "0 1.125rem"
    height: "3rem"
  pill-selected:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
  field:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.field}"
    padding: "0 0.875rem"
    height: "3.5rem"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.sheet}"
  plate-button:
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.disc}"
    size: "66px down to 48px"
  tag-pr:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.on-lime}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 0.875rem"
---

# Design System: Splits

## Overview

**Creative North Star: "The Barbell"**

Weight is a thing you load, not a number you type. The system is built from the parts of a lifting floor: a deep green ground like gym-wall paint, chalk text, and flat colour-coded plates in real standard sizes with the number printed on each. A barbell drawing is the main control, a ring counts reps, and progress shows as a newly added plate with a lime outline. Everything is a pill, a disc, or a hairline rule. Nothing floats, glows, or casts a shadow.

It is an operating tool used mid-set with one hand, so density is low and type is large and heavy. Numerals are the content: heavy, tabular, and sized by importance (up to 5.5rem). The primary action sits in the thumb zone. Light and dark are both first-class; dark is default, light follows the phone unless the setting overrides it.

**Key Characteristics:**
- Deep green ground, chalk text, one lime accent (green in light) kept for primary action and progress.
- Plates are the only multi-hue colour, and colour is never the sole carrier: number and size always print too.
- Bricolage Grotesque throughout, weights 500 to 800, tabular numerals, tight negative tracking on big type.
- Pills, discs and 2px hairline rules; no shadows, no gradients.
- 48px minimum targets; rem sizes, 14px (0.875rem) smallest text.

## Colors

A green-black ground with chalk text, a single acid accent, and a plate palette borrowed from competition plates.

### Primary
- **Lime** (#c6f135, dark theme): primary action pill, progress ring fill, the selected-disc outline, new-plate outline, PR sticker and tag, PR values and focus ring. In light theme the role is carried by **Field Green** (#2f7d1f) with white on-accent text.

### Neutral
- **Deep Barbell Green** (#0f1a17): app ground. Light: **Pale Green-White** (#f1f5ee).
- **Chalk** (#eaf2ec): text and selected-pill fill. Light: #101a15.
- **Muted Sage** (#a9baaf): secondary text, captions, units. Light: #4f6056.
- **Hairline** (#2a3d36): 2px rules, pill borders, ring track, volume track. Light: #c9d5cb.
- **Field Edge** (#6f8a7e): input and round-button borders, kept at 3:1 against the ground. Light: #7a8f82.
- **Sheet** (#162620): bottom-sheet surface. Light: same as ground. **Scrim** #070d0b at 85% (light #9faaa1).
- **Error Coral** (#ff8a8a): error text, always with an icon. Light: #b3261e.
- **Plate Edge** (#0f1a17, light #101a15) outlines plates; **Plate Ink** (#0b1210) prints numerals on plates.

### Plates (same in both themes)
- Blue #6aa4ff, Green #3ddc97, Yellow #ffd23f, White #f2f5f3, Red #ff7a7a, Silver #b9c7be. Assigned heaviest to lightest per unit (kg: 20, 10, 5, 2.5, 1.25; lbs: 45, 35, 25, 10, 5, 2.5). The Plates setting "mono" repoints every plate token to **Plate Neutral** (#7f968a, light #9db0a3), which also fills non-PR volume bars.

### Named Rules
**The Earned Accent Rule.** Lime (green in light) marks only primary actions and progress: the Start pill, filled ring, new plate, PR. If it is on something that is neither, remove it.
**The Number On The Plate Rule.** Plate colour is a hint, never the signal. Every plate shows its number and has its own size, so mono mode loses nothing.

## Typography

**Display, Body and Label Font:** Bricolage Grotesque Variable (self-hosted via Fontsource; fallback system-ui, sans-serif). One family, no second face.

**Character:** Chunky, friendly grotesque at weight 800 for numbers and headings, relaxed 500 to 700 for support text. Tabular numerals keep changing digits from jittering.

### Hierarchy
- **Display** (800, 5rem to 5.5rem, 1, -0.045em): live weight, big stat, rep count (5.25rem), totals (4.75rem), timer (4.5rem).
- **Headline** (800, 3.5rem, 1, -0.04em): home hero, summary head; wordmark 3.75rem; exercise page 2.875rem; primary button label 1.5rem.
- **Title** (800, 1.875rem to 1.625rem, -0.03em): exercise name, sheet heading, home title.
- **Body** (500 to 600, 1rem to 1.125rem): rows, buttons, inputs (text field 1.125rem). Rows use 1.125rem/700 for names.
- **Label** (500 to 700, 0.9375rem, muted): captions, field labels, units, hints. Smallest text is 0.875rem.

### Named Rules
**The Heavy Numeral Rule.** Anything the lifter reads from a distance is weight 800 with tabular figures and negative tracking; units sit beside it at 700 in muted.

## Layout

Single column, phone first: `.app` is capped at 27rem and centred, with 1.25rem side gutters. Screens are vertical stacks with 0.125rem to 1.125rem section padding, tight at the top and loose near the thumb. The primary action sits in the lower third, and the screen pads for the safe-area inset. Lists are full-width rows separated by 2px hairlines (no card per row); rows are at least 3.25rem to 4.25rem tall. Horizontal strips (exercise pills, set chips) scroll with the scrollbar hidden. Two-column field grids use 0.75rem column and 0.5rem row gaps. All sizes are rem; the plate and bar SVGs use fixed viewBoxes. Reduced-motion turns all transitions off.

## Elevation & Depth

Flat. There are no shadows, gradients or blurs anywhere in the stylesheet. Depth comes from the sheet colour plus a scrim over the page, 2px hairlines, a 3px plate edge, and a lime outline for selection. The toast inverts the palette (chalk fill, ground text). The PR sticker is the only tilted element (9 degrees).

### Named Rules
**The Flat Plate Rule.** Surfaces are solid fills and outlines. State is shown by outline, fill inversion, or opacity (disabled 0.5), never by shadow.

## Shapes

Pills (999px) for buttons, chips, tags; true circles (50%) for discs, plates, icon buttons, ring and timer; softly rounded rectangles for fields (1rem), quick keys (0.875rem), create-box (1.375rem), resume box (1.5rem); bottom sheet top corners 1.75rem. Borders are 2px for rules, pills and fields (3px on large fields, discs, plates and boxes). Dashed borders mean provisional or derived: warm-up sets, the "new" disc, the create box and calculated values. A solid lime border marks resume or PR.

## Components

### Buttons
- **Primary:** full-width lime pill, 4.25rem tall, 1.5rem/800 label, with a 3rem on-accent disc holding an arrow at the right (the `plain` variant is centred without the disc). Disabled is 0.5 opacity. Used once per screen.
- **Pill:** 3rem tall, transparent, 2px hairline border, 1rem/600. Selected or current state inverts to chalk fill with ground text and 700 weight. Segmented sets (`seg`) share the row equally at 3.25rem.
- **Link button:** underlined text, 3rem tall. **Round button:** 3.5rem circle, 2px field-edge border. **Icon button:** 3rem circle, no border.
- **Focus (all):** 3px accent outline offset 3px. Fields instead switch the border to chalk with a 2px offset outline.

### Chips
Set chips and mini-chips are pills with 2px hairline borders and tabular numerals. PR chips take a lime border, warm-up chips a dashed border with muted text.

### Inputs / Fields
Transparent fill, 2px Field Edge border at 3:1, 1rem radius, 3.5rem tall, 1.625rem/800 tabular numeral. Text variant uses 1.125rem/600; the large variant (login, create) is 3.75rem tall with a 3px border. Derived values use a dashed hairline border. Errors use Error Coral text with a leading icon.

### Bar (signature)
A barbell SVG with plates mirrored on both sides of the collars. Plate height and width follow rank (100 to 30 units tall), each filled with its plate colour, 2px Plate Edge stroke. A plate that is new since last time gets a 3px lime stroke. It carries a full text alternative.

### PlateButtons
One round button per plate in the active unit, sized 66px stepping down 4px to a 48px floor, filled with the plate colour, 3px Plate Edge border, number in Plate Ink. Press scales to 0.94.

### RepRing
A 9.75rem tap target: 9px hairline track, lime round-capped arc filling toward last time's reps, a 5.25rem count inside and "tap per rep" beneath. It swaps to a numeric field for typing.

### Disc
Home discs are plate circles whose diameter scales with days since last done, name inside, 3px Plate Edge border; selected gets a 5px lime outline; the "new" disc is transparent with a dashed muted border.

### Sheet
Native `dialog` anchored to the bottom, max 27rem wide, 1.75rem top radius, a 2.75rem grab bar, 1.75rem/800 heading, and an 85% scrim. List rows inside are 4.25rem with a 3rem category disc.

### PrSticker
A flat 24-point lime starburst with on-accent text, rotated 9 degrees. Shown only on a real personal best.

### Timer ring, Track, bar chart
The timer is a 13.25rem ring with a 4.5rem time. The run track is a 5.125rem-tall SVG with a 2.75rem figure. Volume rows use a 0.875rem pill track on hairline, filled Plate Neutral, lime when it is a PR.

## Do's and Don'ts

### Do:
- **Do** use lime (green in light) only for the primary action, progress fill, selection outline, new plate and PR.
- **Do** print the number on every plate and size plates by real rank so colour is never the only cue.
- **Do** keep every target at 3rem or larger and text at 0.875rem or larger, in rem.
- **Do** separate list rows with 2px hairline rules rather than wrapping them in cards.
- **Do** use dashed outlines for provisional or derived things and solid for committed ones.
- **Do** keep field borders at 3:1 or better against the ground in both themes.

### Don't:
- **Don't** add shadows, gradients, blur or glass; depth is outline, fill and scrim.
- **Don't** nest cards or build a dashboard of tiles; the home screen is discs, one pill and rows.
- **Don't** show a PR sticker unless the best is real.
- **Don't** introduce a second typeface or fade text below its muted token (placeholders stay at 4.5:1).
- **Don't** use plate colours for anything but plates and their buttons, discs and category discs.

## Larger Screens

The phone layout is the base. Breakpoints are in rem so they follow the user's text size.

- **48rem and up (tablet):** the single column is centred at 40rem. Bottom sheets become centred dialogs.
- **64rem and up (desktop):** a 15rem navigation rail appears (Home, Exercises, Settings, and a Resume card while a session is in progress). The Home header links and wordmark are hidden because the rail replaces them.
- **Two panes** on Home (plates and Start on the left, recent lifts on the right), Exercise (stats and chart on the left, history on the right) and Summary (totals on the left, per-exercise on the right). The session screen puts the exercise list and logged sets on the left (17rem) and the barbell and controls on the right (up to 40rem).
- **Same components, same tokens.** Only the arrangement changes; nothing is redesigned for wide screens. Simple screens (Run, Rest, Settings, Exercises, Login) stay a centred column.
- **Pointer input:** hover states exist only under `@media (hover: hover)`, so touch screens never show sticky hover.

### Laptops and big monitors

- **Scale, not stretch.** From 90rem (1440px) the whole interface scales up in steps through the root font size: 112.5% at 1440px, 125% at 1920px, 150% at 2560px. These are percentages of the user's own text size, so a larger browser setting still wins. Because every size is in rem (plate buttons, discs, rings and timers included), the composition stays the same and nothing floats as a small island.
- **Short laptops.** Under 50rem tall at desktop width (about 768px screens) the weight number and barbell are trimmed so the whole set screen, Log button included, fits without scrolling.
- **Verified** at 1366x768, 1920x1080 and 2560x1440: no sideways overflow, the set screen fits the viewport.
