# Pet insurance slide 2 — senior design QA

- Source visual: `/var/folders/0n/5vjszlvd2gd_nbtzpsh6v9nr0000gn/T/codex-clipboard-846af1af-a6e7-4b88-8766-04267544bc86.png`
- Figma JSON: `/Users/fred/.codex/attachments/43c14334-ca88-4f2e-95eb-5908c49063b4/pasted-text.txt`
- Final desktop render: `/private/tmp/pet-insurance-senior-review/02-slide-final-v8-aligned.jpg`
- Source/final comparison: `/private/tmp/pet-insurance-senior-review/02-source-vs-final.jpg`
- Stable deck samples: slides 1, 5, 6, 8, and 9 in `/private/tmp/pet-insurance-senior-review/`
- Responsive renders: `02-slide-final-1280x720.jpg`, `02-slide-final-1088x720-v3.jpg`, `02-slide-final-1280x700.jpg`, and `02-slide-final-mobile-exact.jpg`
- Stepper comparison: `/private/tmp/pet-insurance-stepper-qa/stepper-comparison.jpg`
- Reference constraint: slides 3 and 4 were excluded from all design decisions.

## Design decision

The Figma slide remains the primary visual source. The final pass deliberately harmonizes its composition with the stable deck: the content now uses the shared 1120px rail, the title uses the deck's insight-title scale, and the spacing follows the existing 8px rhythm. The Figma palette, two-column density, 24px subheads, purple callout, 32px radius, copy, and two-line desktop callout are preserved.

Intentional refinements from the source:

- Moved the visible content rail from 155px to the deck-standard 175px at 1470px.
- Changed the desktop column gap from 120px to the deck's 80px spacing token while preserving two 520px columns.
- Scaled the title from 48px/57.6px to 51.45px/53.51px with the deck's 0.012em tracking.
- Increased body leading from 24px to 26px for readability without changing 18px type.
- Kept “fully native experience.” together to remove the lone-word orphan.
- Kept “without compromising” together so the callout never ends a line on “without.”
- Set an explicit 80px gap between the paragraph row and the callout so the vertical rhythm remains stable when copy changes.

## Final desktop geometry — 1470 × 735

- Shared rail: x=175px, width=1120px.
- Title: 51.45px/53.51px, weight 700, one line.
- Columns: 520px + 80px + 520px.
- Column headings: 24px/30px, weight 700.
- Body: 18px/26px; left eight lines, right seven lines.
- Callout: x=175px, y=517px, 1120×112px, 32px radius.
- Navigation clearance: approximately 32px between callout and controls.
- Horizontal overflow: none.

## Responsive and interaction QA

- 1280 × 720: two 520px columns remain intact; no overflow; approximately 43px callout/control clearance.
- 1088 × 720: columns stack on the shared rail before they become too narrow; all content fits the viewport; no overflow.
- 1280 × 700: the compact-height layout switches to top alignment and vertical scrolling to protect the fixed controls.
- 980 × 720: stacked layout is vertically scrollable with no horizontal overflow.
- 390 × 844: continuous mobile layout has no horizontal overflow; controls remain hidden; the protected phrases fit within the 343px content rail.
- Slide navigation updates the counter to `2 / 11` and the final desktop state aligns exactly to the viewport.
- Stepper alignment at 1280 × 720: slide 1 and slide 2 both render at x=1094px, y=646px, 24px from the right edge and 16px from the bottom edge. The slide-2-only bottom override was removed, so the control no longer jumps during navigation.
- Browser console errors and warnings: none.

## Final review

- Hierarchy and deck consistency: passed.
- Line breaks and paragraph endings: passed.
- Spacing, alignment, and optical balance: passed.
- Short-height, tablet, and mobile behavior: passed.
- Overlap, clipping, and horizontal overflow: passed.
- Fixed stepper position across slides: passed.

final result: passed
