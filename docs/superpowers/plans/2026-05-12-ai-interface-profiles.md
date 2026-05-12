# AI Interface Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multiple AI interface profiles, one global default profile, and optional per-AI-friend profile overrides.

**Architecture:** Keep the existing single-file React app. Add small pure helpers for profile selection and persona grouping, then wire those helpers into settings UI, friend edit UI, and comment generation.

**Tech Stack:** Static HTML, React 18 UMD, Babel in-browser transform, localStorage, existing Python local server and proxy.

---

## File Structure

- Modify `app.html`: all application state, UI, helper functions, and AI generation logic live here.
- Create `tests/ai-profile-helpers.test.js`: Node-based smoke tests for pure helper behavior copied into an isolated harness.

## Task 1: Profile Selection Helpers

**Files:**
- Modify: `app.html`
- Create: `tests/ai-profile-helpers.test.js`

- [ ] Add pure helper tests for default profile selection, persona fallback, and grouping.
- [ ] Run `node tests/ai-profile-helpers.test.js` and verify it fails because helpers are not implemented in the harness yet.
- [ ] Add helpers in `app.html`: `getDefaultProfileId`, `getProfileById`, `getPersonaProfileId`, and `groupPersonasByProfile`.
- [ ] Mirror the helper code in the test harness.
- [ ] Run `node tests/ai-profile-helpers.test.js` and verify it passes.

## Task 2: App State Uses Active Profile Id

**Files:**
- Modify: `app.html`

- [ ] Change `currentProfile` from always using `modelProfiles[0]` to using `liveSettings.profileId` with fallback to the first profile.
- [ ] Add `selectedProfileId` UI state for the interface currently being edited.
- [ ] Change `updateCurrentProfile` so it updates the selected profile by id.
- [ ] Add `addModelProfile` and `setDefaultProfileId` callbacks.
- [ ] Keep API keys indexed by profile id.
- [ ] Run `node tests/ai-profile-helpers.test.js`.

## Task 3: Interface Settings UI

**Files:**
- Modify: `app.html`

- [ ] Pass `modelProfiles`, `selectedProfileId`, `setSelectedProfileId`, `addModelProfile`, and `setDefaultProfileId` to `SettingsScreen`.
- [ ] Render a profile list above the existing form.
- [ ] Add an "add interface" button.
- [ ] Add a "set as default" button for non-default selected profiles.
- [ ] Keep existing test connection and save behavior scoped to selected profile.

## Task 4: AI Friend Interface Override UI

**Files:**
- Modify: `app.html`

- [ ] Preserve `modelProfileId` in `normalizePersona`.
- [ ] Pass `modelProfiles` and default profile id to `FriendEditScreen`.
- [ ] Add a selector with "follow default" plus each profile.
- [ ] Save `modelProfileId` as empty string for follow default, or the selected profile id.
- [ ] Verify existing personas without the field still load.

## Task 5: Multi-Profile Generation

**Files:**
- Modify: `app.html`

- [ ] Update `profileFingerprint` to include all effective profile details and persona-to-profile mapping.
- [ ] In `generateChapterComments`, group enabled personas by effective profile.
- [ ] For each group, call `aiClient.generateChunk` with that group's profile and API key.
- [ ] Merge successful group comments into one `commentsByKey` object.
- [ ] If at least one group succeeds, show success; if all attempted groups fail, show the error state.
- [ ] Run `node tests/ai-profile-helpers.test.js`.

## Task 6: Browser Verification

**Files:**
- No code changes unless verification finds a bug.

- [ ] Start `python -m http.server 3000`.
- [ ] Open `http://localhost:3000/app.html` in the available browser tool.
- [ ] Inspect console errors.
- [ ] Verify the settings screen can add and select profiles.
- [ ] Verify the default marker changes when setting a profile as default.
- [ ] Verify the friend edit screen shows the interface selector.
- [ ] Verify returning to the reader does not throw.

## Self-Review

Spec coverage:
- Multiple saved profiles: Tasks 2 and 3.
- Global default: Tasks 2 and 3.
- Per-friend override: Task 4.
- Grouped generation: Task 5.
- Cache correctness: Task 5.
- Validation: Task 6.

Placeholder scan:
- No TBD, TODO, or unspecified implementation steps remain.

Type consistency:
- The plan uses `modelProfileId` for persona override and `liveSettings.profileId` for the global default throughout.
