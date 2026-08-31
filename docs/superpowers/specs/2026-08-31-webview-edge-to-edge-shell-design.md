# Work Shackle WebView Edge-to-Edge Shell Design

## Goal

Make the main Work Shackle interface fill the entire WebView below the native macOS title bar, removing the dark outer "picture frame" while preserving the existing internal cards, borders, radii, shadows, and Chinese cartoon visual language.

## Problem

The WebView root currently paints a dark dotted background. The main `.ws-shell` is then rendered as a centered, width-limited panel with margins, an outer border, rounded corners, and a hard shadow. The root background remains visible around that panel, so the installed desktop app appears to have a wide black or dark-brown border around its actual interface.

The effect is caused by page-level presentation, not by the native macOS window configuration or application business logic.

## Chosen Approach

Treat the WebView root and the main app shell as one continuous, edge-to-edge paper canvas:

- Make `html`, `body`, and `#root` fill the WebView height.
- Give the root page a solid paper-colored background instead of the dark dotted treatment.
- Make `.ws-shell` use the full available width and at least the full WebView height.
- Remove only the shell's panel-like outer margin, maximum width, border, radius, and shadow.
- Retain the shell's internal padding so the header and page content keep appropriate breathing room.
- Preserve the existing full-screen modifier and responsive layouts; their edge-to-edge rules remain compatible with the new default shell.
- Do not change React structure, Tauri window behavior, data flow, or business functions.

## Alternatives Considered

### Add another full-screen wrapper

A new React wrapper could own the WebView background while retaining the existing shell. This adds markup and still requires neutralizing the shell's picture-frame styles, so it creates complexity without improving isolation.

### Change only the root background color

Replacing the dark root background would make the frame less conspicuous, but the main shell would remain centered, width-limited, rounded, and shadowed. It would not satisfy the requirement that the interface fill the available WebView.

## Visual Boundaries

The removal applies only to the outermost application frame. Existing internal design elements remain unchanged, including:

- the yellow sticky brand header;
- navigation, status, cards, panels, and their borders;
- component-level corner radii and shadows;
- mascot and Chinese cartoon styling;
- internal color and typography tokens.

The dark dotted texture is not required at the WebView boundary. This change removes it from the global page background rather than relocating it, avoiding a new visual element outside the requested repair.

## Responsive and Window Behavior

The default desktop shell fills the normal window. Narrow-screen media queries must not reintroduce an outer margin, reduced width, or outer radius. Full-screen mode continues to fill the viewport and may keep its existing responsive content padding. Scrolling remains owned by the document, and sticky header behavior remains unchanged.

## Verification

Add or update a shell layout contract test that reads the relevant CSS and verifies:

- the default shell is full width and has no outer margin, maximum width, border, radius, or shadow;
- the narrow breakpoint does not restore picture-frame styling;
- the root page uses the paper canvas instead of the dark dotted background.

Then run the focused shell tests, the complete frontend test suite, and the production frontend build. If a runnable preview is available, visually inspect the normal desktop window and a narrow viewport to confirm that no dark perimeter remains and internal styling is intact.

## Out of Scope

- Native title-bar customization
- Tauri window configuration changes
- Business behavior or data-layer changes
- Redesigning internal cards or removing existing design elements
- Introducing a new decorative texture placement
