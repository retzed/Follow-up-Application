# Application Release Notes

## Current public demo

- Bilingual English/Arabic workspace for projects, jobs, tasks, and follow-ups.
- Search and assignment views, item metadata, priority/status controls, item and application-wide activity history, archive, and hierarchy-aware restore.
- Responsive desktop/mobile interface with light and dark themes.
- Mixed Arabic/English item-name handling and localized activity labels.
- Built-in team demo identities and browser-local workspace persistence.
- Automated regression tests for JavaScript syntax, local data behavior, activity history, archive/restore, search, language rendering, and UI refinements.
- GitHub Actions workflow that tests, builds, and publishes the static demo with GitHub Pages.

## Demo limitations

- Username-based demo sign-in accepts any non-empty password and is not real authentication.
- Workspaces persist only in the current browser's local storage; there is no cross-device or shared team database.
- A server-side backend is not included in the public application repository. Backend technology and hosting will be chosen separately if shared persistence is required.
