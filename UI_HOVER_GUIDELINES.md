# UI Hover Guidelines

## Principles

- Navigation uses light hover only: background, text, border.
- Clickable list rows use medium hover: background, border, shadow.
- Surface cards use subtle hover only when the whole block is actionable.
- Static information containers should not get hover just for decoration.

## Shared Classes

- `ui-hover-nav`: for sidebar items, tabs, menu rows.
- `ui-hover-item`: for clickable list rows and interactive content entries.
- `ui-hover-surface`: for interactive cards or blocks with internal actions.

## Do Not Do

- Do not use lift/translate on regular list rows.
- Do not mix strong motion hover with silent hover in the same interaction layer.
- Do not add hover to read-only metric cards unless the whole card is clickable.
