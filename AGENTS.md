# Repository Guidelines

## Project Structure & Module Organization

- `app.html` is the primary application entry point and contains the full React app, styles, and UI logic in one file.
- `ReadWithMe.html` is a concept or wireframe artifact, not the main runtime target.
- `大隐.txt` is a sample novel used for manual import and reader testing.
- `.claude/launch.json` defines the local preview command: `python -m http.server 3000`.
- `CLAUDE.md`, `design_bundle.txt`, and `bundle_tail.txt` are reference notes and design artifacts; keep product logic in `app.html` unless a refactor is intentional.

## Build, Test, and Development Commands

- `python -m http.server 3000` — serves the repository locally.
- `python proxy_server.py` — runs the local development proxy for model requests.
- `powershell -ExecutionPolicy Bypass -File .\start-dev.ps1` — opens both the frontend server and proxy in separate windows, then opens `app.html` automatically.
- Open `http://localhost:3000/app.html` — loads the main app in a browser.
- No build step is required; React and Babel are loaded from CDNs at runtime.

Example:

```powershell
cd ReadWithMe
python -m http.server 3000
```

## Coding Style & Naming Conventions

- Use 2-space indentation in HTML, CSS, and embedded JavaScript to match `app.html`.
- Prefer small, focused React function components and local helper functions.
- Use `camelCase` for variables and functions, `PascalCase` for React components, and descriptive names such as `handleImport` or `ReaderScreen`.
- Preserve the single-file structure unless the change clearly justifies modularization.
- No formatter or linter is configured; keep style consistent manually.

## Testing Guidelines

- There is no automated test suite in this repository currently.
- Validate changes manually in the browser against the main flows: import `.txt`, bookshelf display, chapter navigation, reading progress restore, theme/settings changes, and comment interactions.
- When fixing UI behavior, include the exact scenario tested in your handoff notes.

## Commit & Pull Request Guidelines

- Local Git history is not available in this workspace, so no repository-specific commit convention can be inferred.
- Recommended commit style: Conventional Commits, e.g. `feat: add chapter jump control` or `fix: restore scroll position correctly`.
- Pull requests should include: summary of user-facing changes, affected files, manual test steps, and screenshots or screen recordings for UI changes.

## Architecture Notes

- Application state is stored in `localStorage` using the `rwm_*` key pattern.
- Navigation is state-driven (`bookshelf`, `chapters`, `reader`) rather than URL-routed.
- Demo AI comments are deterministic mock data; do not describe them as backend-generated behavior.
