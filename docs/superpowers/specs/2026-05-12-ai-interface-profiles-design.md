# AI Interface Profiles Design

## Goal

Let the reader app keep multiple AI interface profiles, choose one global default for everyday use, and optionally assign a specific interface to individual AI book friends.

## Current State

The app already stores model profiles in `rwm_model_profiles` and API keys in `rwm_model_api_keys`. The runtime currently always uses the first profile in the list as `currentProfile`, so saved profiles are not yet selectable. AI book friends are stored in `rwm_personas` and do not currently have an interface preference.

## Product Behavior

The global default interface is the main profile used for AI comment generation. Each AI book friend can either follow the global default or override it with a specific interface profile.

When generating comments, enabled book friends are grouped by their effective interface:

- Friends set to "follow default" use `liveSettings.profileId`.
- Friends with a valid override use that profile.
- Friends whose override no longer resolves fall back to the default profile.
- Groups without a complete profile or API connection data are skipped without crashing the reader.

Each interface group makes one model request containing only the personas assigned to that interface. Results from all groups are merged into the same paragraph comment map.

## Interface Settings UI

The AI interface settings screen becomes a profile manager:

- Show all saved interfaces in a compact list.
- Let the user select a profile for editing.
- Allow adding a new profile.
- Allow editing profile name, Base URL, API Key, and model name.
- Keep the existing test connection flow for the selected profile.
- Add a "set as default" action for the selected profile.

The first implementation will not include deleting profiles. This avoids dangling persona references and keeps the data migration smaller.

## AI Friend Settings UI

The AI friend edit screen adds a "Use interface" selector:

- Default value: follow global default.
- Other options: each saved interface profile by name.
- The selected value is stored on the persona as `modelProfileId`.

Existing personas without `modelProfileId` follow the global default.

## Data Model

Model profiles keep the existing shape:

```js
{
  id,
  name,
  baseUrl,
  model,
  temperature,
  maxOutputTokens
}
```

Personas add an optional field:

```js
{
  modelProfileId: null | string
}
```

`null`, empty string, or missing means "follow default".

`liveSettings.profileId` stores the default profile id. On startup, if it is missing or invalid, the app should use the first normalized profile and persist that id through normal settings saving.

## Generation Flow

The generation code resolves profiles with a helper that returns:

- `defaultProfile`
- `profilesById`
- effective profile for each persona

It then:

1. Filters enabled personas.
2. Groups personas by effective profile id.
3. For each group, validates proxy URL, Base URL, model name, and non-placeholder endpoint.
4. Calls `aiClient.generateChunk` for that group and profile.
5. Uses that profile id when building returned AI comments.
6. Merges all returned comments.

The cache fingerprint must include the default profile, profile details, persona prompt data, and persona-to-profile mapping, so switching a friend's model does not reuse stale cached comments.

## Error Handling

The reader should continue to show already generated comments if one interface group fails after another succeeds. If every group fails, it should show the existing error state. Missing or incomplete profiles should not throw; they should be skipped.

The settings screen keeps connection status scoped to the selected profile and current fields through the existing connection fingerprint.

## Validation

Because this repository has no automated test suite, validation will combine:

- A small local script for pure helpers if practical.
- Manual browser smoke testing through `http://localhost:3000/app.html`.
- UI checks for adding a second interface, selecting it, setting it as default, assigning it to a book friend, and returning to the reader.
- Console/error inspection during the browser smoke test.

## Out of Scope

- Deleting interface profiles.
- Per-profile temperature and token editing UI beyond the existing stored fields.
- Import/export of interface profiles.
- Backend proxy changes unless the existing proxy contract is insufficient.
