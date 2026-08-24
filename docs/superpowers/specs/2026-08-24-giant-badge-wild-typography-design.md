# Giant Badge Wild Typography Design

## Summary

Increase the visual aggression of Work Shackle by applying a poster-scale typography system across the app. The approved direction is **B · 巨型工牌**: giant Today headlines and countdown numbers, enlarged brand and page headings, heavier task titles, and oversized key times, while metadata and form help text remain compact enough for daily use.

This design builds on the approved dopamine-brutalist color system. It changes hierarchy and scale, not application behavior or information architecture.

## Goals

- Make the UI feel like a street poster, scoreboard, and oversized employee badge rather than a conventional productivity dashboard.
- Let the Today cockpit dominate the first screen through type, not extra decoration.
- Carry the same personality into Tasks and Settings without making forms or metadata hard to scan.
- Preserve Chinese readability, responsive behavior, keyboard focus, and reduced-motion support.
- Avoid making every label large; contrast between giant and compact type creates the wildness.

## Typography roles

The system uses local fonts only. Chinese display text uses the existing heavy system sans stack; large Latin labels and numbers use the condensed data stack. No remote font dependency is introduced.

| Role | Desktop range | Mobile range | Treatment |
| --- | --- | --- | --- |
| Cockpit headline | 64–88 px | 38–48 px | Weight 950–1000, line-height 0.86–0.92, strongly negative tracking, maximum two lines |
| Countdown hour | 128–176 px | 72–92 px | Condensed data face, tabular numbers, line-height about 0.78 |
| Countdown minute/second | 48–68 px | 30–42 px | Condensed data face, subordinate to hour |
| Brand name | 22–28 px | 18–22 px | Heavy, tightly tracked |
| Page/section title | 28–38 px | 24–30 px | Heavy, short line-height |
| Workday time | 64–80 px | 52–64 px | Condensed data face |
| Task title | 18–22 px | 17–20 px | Heavy, line-height 1.05–1.2 |
| Navigation | 15–17 px | 14–16 px | Heavy, button height increases with type |
| Metadata/help | 13–15 px | 12–14 px | Regular or medium weight, normal line-height |

The final values use `clamp()` so type grows smoothly inside the app's 390–1260 px layout range.

## Today cockpit

The Today cockpit becomes a poster-scale composition approximately 390–440 px tall on desktop. The blue countdown field owns the main headline in the upper-left and the giant time in the lower-left. The yellow progress line sits close to the bottom edge so the numbers can fill most of the field.

The headline is constrained to roughly eight Chinese characters per line and no more than two lines. It uses balanced wrapping where supported. Countdown units remain visible but small enough that they do not interrupt the number shapes.

The coral reaction field enlarges the meme mark such as “跑”, “卷”, or “摸” to 160–220 px and intentionally clips it at the panel edges. It remains a background graphic with outlined text and reduced opacity. The active status label is 15–18 px; the meme speech copy is 18–22 px and limited to three lines.

## Shell and navigation

The brand name increases to 22–28 px on desktop. The WS mark grows proportionally but remains smaller than the brand name. The header height increases enough to give the brand and segmented navigation breathing room.

Navigation labels increase to 15–17 px and controls grow to a minimum 46–52 px height. The current work status uses the same enlarged label scale. On narrow screens the current status collapses to its existing compact icon treatment so the navigation still fits without horizontal scrolling.

## Tasks

Task rows grow to approximately 82–96 px on desktop. Titles use 18–22 px heavy type, while deadline, contact, state, and remaining-time metadata stay at 13–15 px. The priority rail, hard dividers, and compact yellow tags remain unchanged in function.

The list remains a dense editorial table rather than becoming a stack of rounded cards. Titles may wrap to two lines; metadata may wrap once when necessary. Long titles are never clipped horizontally.

## Workday tools and settings

The workday control time grows to 64–80 px and behaves like a scoreboard. “工位控制台” and major Settings section titles grow to 28–38 px. Field labels, hints, validation messages, reminder summaries, and select values remain in the metadata range.

Settings uses oversized titles only at page and section boundaries. Repeated form controls do not inherit display sizes. This preserves a deliberate hierarchy and avoids the entire page shouting at once.

## Responsive behavior

- At widths below 760 px, the cockpit remains single-column.
- The cockpit headline uses 38–48 px and the hour uses 72–92 px.
- Reaction copy stays at 17–19 px and the background meme mark shrinks to 120–160 px.
- Task titles stay at least 17 px; metadata stays at least 12 px.
- `overflow-wrap`, two-line clamps, and min-width guards prevent horizontal overflow.
- Large offset shadows are reduced on narrow screens so they do not expand the document width.

## Motion

A successful status change triggers one short poster-slam animation on the meme mark and speech sticker. The animation uses scale, a small translation, and shadow compression for 180–240 ms. It does not loop.

The existing countdown horse animation remains. No continuous animation is added to headlines, navigation, or task titles. Reduced-motion mode disables the poster-slam transform while leaving the final state visible.

## Accessibility and error handling

- Giant text must not replace semantic heading levels or accessible names.
- Large display text uses the existing high-contrast white-on-blue or dark-on-yellow/coral combinations.
- Keyboard focus remains visible after button sizes change.
- Dynamic headlines and status copy wrap inside their panels; text overflow never hides error or deadline information.
- Loading skeletons match the final block height to avoid severe layout shift.
- Error, empty, disabled, and long-content states are tested at desktop and 390 px.

## Implementation boundary

Implementation primarily changes CSS tokens and component styles. A small markup change is allowed only when needed to provide a stable wrapper or key for the one-shot poster-slam animation. Business logic, Tauri IPC, status automation, reminders, task data, SQLite, and page navigation remain unchanged.

## Verification

- Add a source-level typography contract covering approved `clamp()` ranges and responsive fallbacks.
- Run the full Vitest suite and production build.
- Inspect Today, Tasks, and Settings at desktop width and 390 px.
- Test short and long task titles, long status copy, loading, error, overdue, and disabled states.
- Confirm there is no horizontal overflow or clipped actionable text.
- Confirm reduced-motion mode removes the poster-slam transform.

## Out of scope

- New application features or navigation changes.
- Remote or newly bundled font files.
- Rewriting status or task copy solely to fit the typography.
- Changing the approved dopamine-brutalist palette.
