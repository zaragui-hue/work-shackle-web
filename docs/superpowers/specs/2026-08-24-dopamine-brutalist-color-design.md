# Dopamine Brutalist Color Redesign

## Summary

Replace the current cream, cobalt, and lime treatment with a sharper dopamine palette built around extreme contrast, hard-edged color blocking, and editorial sticker energy. The result should feel fashionable, internet-native, and deliberately loud without becoming childish or exhausting during daily use.

The approved direction is **B · 多巴胺工牌**, refined into **潮流粗野主义多巴胺**.

## Design goals

- Make the application immediately more distinctive and current.
- Preserve the workhorse mascot, workplace memes, and irreverent copy.
- Create extreme contrast through controlled color collisions rather than covering every surface with saturated color.
- Keep task-heavy screens readable for sustained use.
- Avoid candy UI, toy-like rounded components, soft pastel gradients, and excessive pill shapes.

## Palette

| Role | Name | Hex | Use |
| --- | --- | --- | --- |
| Canvas | 奶油纸 | `#FFF7DF` | Main reading surfaces, cards, forms, task lists |
| Primary stage | 运动蓝 | `#2448FF` | Countdown cockpit, active navigation, primary focus |
| Signal | 工牌黄 | `#FFD45E` | Progress, selected tags, compact callouts, key buttons |
| Reaction | 珊瑚橙 | `#FF7A52` | Work-status reaction panel and meme surfaces |
| Danger | 番茄红 | `#FF3D57` | Overdue, chased, destructive, and urgent states |
| Anchor | 深咖黑 | `#241C16` | Text, borders, dark control surfaces, structural contrast |
| Muted text | 烟棕灰 | `#6E5548` | Secondary information on light surfaces |

The default distribution is approximately 60% cream reading surfaces, 25% cobalt stage surfaces, 10% yellow signals, and 5% coral or red reactions. This ratio is a ceiling, not a requirement to place every accent on every screen.

## Color responsibilities

Each saturated color has one job:

- Blue owns navigation focus, time, and the main live stage.
- Yellow marks progress, selection, and small interaction hotspots.
- Coral owns humorous status reactions and the mascot's speech area.
- Red is reserved for urgency, pursuit, overdue work, and sharp feedback.
- Deep brown-black anchors typography, borders, large control surfaces, and shadows.

Components must not freely substitute one accent for another. This keeps the palette loud but understandable.

## Surface and shape language

- Replace soft decorative gradients with flat, saturated color fields.
- Use 2–3 px dark structural borders on major blocks.
- Use offset shadows in red or deep brown-black for primary actions and hero blocks.
- Reduce the number of pills. Pills remain appropriate for compact state tags and segmented navigation only.
- Use tighter corner radii: 0–8 px for editorial blocks and controls, 12–16 px only for the cockpit or mascot reaction stage.
- Allow one intentional one-degree rotation on meme stickers or speech bubbles. Functional controls stay level.
- Use dotted or halftone texture only on large quiet backgrounds at very low contrast; never behind dense text.

## Component mapping

### Application shell

The shell uses cream as the reading canvas and yellow as a controlled header band. The navigation becomes a hard-edged segmented control with a cobalt active state. The current work status uses cream or coral against the dark anchor rather than a generic online dot.

### Today cockpit

The countdown occupies a cobalt field with white type, a yellow progress line, and deep brown-black structure. The work-status reaction is a separate coral block divided by a hard border. The meme copy appears on a yellow sticker with a dark offset shadow. Red appears only when the status is chased, urgent, or overdue.

### Tasks and tools

Task lists stay cream for readability. Priority and status are communicated with a narrow colored rail, compact bordered tags, and restrained accent use. The workday control panel uses a deep brown-black body with one oversized yellow time field.

### Settings and secondary pages

Settings remain mostly cream with dark borders. Blue marks the active section, yellow marks saved or selected values, and red is limited to destructive or invalid states. Secondary pages must not reproduce the full four-color cockpit treatment in every card.

## Typography and interaction

The existing system stack remains to avoid adding network font dependencies. Display numbers continue to use the condensed data stack. Character comes from oversized countdown figures, compact monospace labels, compressed headings, and extreme weight contrast rather than novelty fonts.

Hover and pressed states use short 1–3 px translations and shadow compression. A successful work-status change triggers one brief sticker-like snap on the reaction label. Continuous decorative motion is not added. Reduced-motion preferences disable translations and rotations.

## Accessibility and error handling

- Body copy remains dark on cream; white text is only used on sufficiently dark blue or black surfaces.
- Yellow is never used as body text on cream or white.
- Coral and red panels use dark text unless contrast testing proves white is stronger.
- Focus rings must remain visible against blue, yellow, coral, cream, and black surfaces.
- Loading, empty, and error states preserve semantic color meaning; errors use red plus text or icon, never color alone.

## Implementation boundary

This redesign changes CSS tokens and component presentation only. It does not change work-status behavior, reminder automation, database schema, Tauri commands, or page information architecture. Existing mascot assets and meme copy remain in scope.

## Verification

- Run the full Vitest suite and production build.
- Inspect Today, Tasks, and Settings at desktop width and 390 px.
- Confirm no horizontal overflow and no low-contrast body text.
- Verify keyboard focus on navigation, buttons, selects, and task cards.
- Verify normal, chased, urgent, overdue, success, error, loading, and disabled states.
- Check reduced-motion behavior.

## Out of scope

- New mascot generation or illustration replacement.
- New fonts fetched from remote services.
- Layout or information-architecture changes beyond presentation adjustments needed for the new shape language.
- Behavioral changes to reminders, status switching, tasks, or schedules.
