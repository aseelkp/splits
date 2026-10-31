---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: []
---

# Surface brief: Splits app (all screens)

Mode: Operate. Visitor: the owner, mid-workout, one hand, phone. Task: log sets and runs in a few taps, compare with last time, read history.
Constraints: kg and lbs both first-class; dark default plus light; accent only for primary action and progress; 48px targets; 14px minimum text; no emoji, gradients, glass, nested cards. Code-led build (Operate). Approved design: Claude Design canvas EDNaqF2VuiacENZZnQk2HW, screens C1 to C9. Direction pinned by the user, so no concept roll.

Unresolved: none.

## Direction contract

THESIS: Weight is a thing you load, not a number you type. A barbell with real plates is the main control; a ring counts reps; progress shows as outlined new plates. Refuses the table-of-inputs logbook and the dashboard of cards.

OWN-WORLD: Deep green ground (#0F1A17) with chalk text; lime accent (#C6F135) only on primary actions and progress; flat plate colours in real standard sizes (blue, green, yellow, white, red, silver) each with its number printed on it; Bricolage Grotesque throughout, heavy tabular numerals; pills and discs, 2px hairline rules, no shadows. Light theme is pale green-white with a deeper green accent.

STORY: You open it, see what is overdue as the biggest plate, tap Start, and each exercise opens pre-filled from last time. Load plates, tap reps, log. Rest timer runs, a PR sticker appears only on a real best. You finish with honest totals.

FIRST VIEWPORT: Home at 390x844. Top bar with wordmark left, settings and Exercises right. Heading "Pull is due." at 58px. Below, six discs sized by days since last time, the due one outlined in lime. A full-width lime pill "Start pull" at thumb height, then recent lifts. Primary action sits in the lower third.

FORM: Pinned by the user from the approved canvas (screens C1 to C9), position n/a, seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
