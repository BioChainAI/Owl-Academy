# UI boundary

`ExplorerDashboard.tsx` renders the real public canon, module state, source paths and panel descriptions. `store.ts` holds search, department selection and current module in memory. There is no role selector or fake production user. React escapes record text; lesson URLs are displayed as text rather than opened from unvalidated data.

The dark void, gold, purple, serif headings and monospace labels follow Academy styling without requiring CDN fonts or Tailwind. Native buttons, labeled inputs/selects, focus indicators, live result counts and details/summary provide keyboard access. The layout adapts below 800px.

Future renderers should add loading/error/disconnected/session-expired states and preserve keyboard/list alternatives to visual graphs. Keep domain permissions out of presentation-only stores. Source references are not production launch links.
