# Celebration & Event Planner Dashboard

A dependency-free, accessible and secure dashboard for planning weddings, birthdays and community events.

## Features
- **Dynamic Budget Calculator:** pick an event type, enter a budget, get an editable breakdown (Venue & Food, Decor, Logistics, Contingency) that always totals exactly 100%.
- **Chronological Timeline Tracker:** 3 Months Out, 1 Month Out and Day-Of phases with progress bar, custom milestones and removal.
- **Vendor Checklist:** Vetting, Contracting and Final Payment stages with custom tasks.
- **Personalized Idea Generator:** concepts, activities, decor and layouts for each event type and vibe (Elegant, Rustic, Modern, Low-Waste).

## Run
Open `index.html` in a browser, or serve it locally with `npm start` and visit http://localhost:8080.

## Test
Requires Node 18 or newer. No packages to install.
```
npm test
```

## Architecture
| File | Responsibility |
|---|---|
| `js/core.js` | Pure logic: validation, sanitising, allocation maths, idea generation (unit tested) |
| `js/app.js` | DOM controller, uses `textContent` only |
| `css/styles.css` | Design tokens, WCAG AA colours, dark mode, reduced motion |
| `tests/core.test.js` | Unit tests with `node:test` |

## Security
- Content-Security-Policy meta tag: `default-src 'none'`, scripts and styles from `'self'` only (no inline code).
- All user text is sanitised, then rendered with `textContent`, never `innerHTML`.
- Numeric input is validated for empty, negative, non-numeric and oversized values.

## Accessibility (WCAG 2.1 AA)
Semantic landmarks, skip link, explicit labels and `aria-label`s, live status region, `role="alert"` errors, `role="progressbar"`, visible focus rings, 44px touch targets, high-contrast tokens, dark mode and `prefers-reduced-motion` support.

## License
MIT
