# AI Friend Prompt And Preview Design

## Goal

Upgrade the AI friend settings flow so users can shape a stable reading persona by filling in a few focused prompt sections, while advanced users can fully take over the generated prompt. The system also provides a lightweight preview surface that lets the user "test listen" to how a friend comments before using that configuration in real reading.

## Current State

The app has:

- AI friends stored in `rwm_personas`
- a friend edit screen with avatar, name, frequency, interface selection
- local AI comment generation and chapter pre-generation
- per-book friend visibility controls
- thread replies, comment replies, chapter discussion, and summoned comments — all of which resolve persona text through the same compilation path

## Authoring Model

The friend editor has two authoring modes:

1. `Sectioned base persona` (default)
   The user configures a friend through a small set of free-text prompt sections plus an example pool. This is the source of truth until advanced mode is enabled.

2. `Advanced prompt takeover` (optional escape hatch)
   When entered, the system compiles the current sectioned persona into a complete editable prompt document. From then on, real generation uses only the advanced prompt text until the user exits advanced mode.

Earlier iterations used fixed-choice structured controls (attention tags, voice style, relationship feel, comment length as enums). Those were replaced: the enums produced no visible difference in output because abstract option labels gave the model nothing concrete to anchor on. The current design lets the user write the persona behavior directly, in their own words, per section.

## Sectioned Persona Model

The persona is authored as a set of free-text sections. The user edits each section in turn; empty sections fall back to a built-in default at compile time.

Editable sections (`PERSONA_SECTION_FIELDS`):

- `identity` — 人设 / 角色定位: who this friend is and their personality
- `attentionFocus` — 关注点 / 读法: what they notice first while reading
- `voice` — 说话风格 / 语气: how they talk, may include sample phrasing
- `relationship` — 与读者的关系: how they relate to the user
- `interaction` — 互动方式: how they reply to the user and talk to other AI friends (single combined section)

Plus an example pool:

- `examples` — 案例: up to 6 `{ trigger, reply }` pairs showing "when you see content like this → you respond like this". Used as few-shot guidance for tone and reaction shape, not to be copied verbatim.

Data model additions on the persona object:

```js
{
  identity: string,
  attentionFocus: string,
  voice: string,
  relationship: string,
  interaction: string,
  examples: Array<{ trigger: string, reply: string }>,
  advancedPromptEnabled: boolean,
  advancedPromptText: string
}
```

Notes:

- `advancedPromptEnabled` selects the active authoring mode.
- `advancedPromptText` stores the full advanced takeover prompt.
- Existing `frequency` is retained as-is.
- Legacy migration: if a saved persona has no `identity` but has an old freeform `stylePrompt`, the `stylePrompt` text seeds `identity`. No stored data is dropped.

## Prompt Architecture

Every compiled friend prompt uses the same fixed high-level shape, assembled in `compilePersonaPrompt`:

1. `[Shared Rules]` — locked
2. `[Persona]` — from `identity` (prefixed with name + tag)
3. `[Attention]` — from `attentionFocus`
4. `[Voice]` — from `voice`
5. `[Relationship]` — from `relationship`
6. `[Interaction]` — from `interaction`
7. `[Examples]` — from `examples`, only emitted when at least one example exists
8. `[Output Contract]` — locked

### Locked sections

`[Shared Rules]` and `[Output Contract]` are product-wide and not user-editable. They are appended automatically at compile time so output quality cannot be broken by a user persona.

Shared Rules require the friend to:

- sound like a real reader firing off a quick in-line reaction, not a review, appreciation, or summary
- grab one concrete detail in the paragraph and react to it in casual spoken Chinese
- never spoil later content, restate the paragraph, give generic praise, or explain the persona
- the block carries explicit ✗/✓ contrast examples so the model can see the difference between a vague book-review line and a grounded reader reaction

Output Contract requires:

- exactly one paragraph-style short comment, plain text, no prefix/suffix
- target `16-28` Chinese characters, hard ceiling `36`
- one sentence or at most two short clauses, no bullet points, no quote wrapping

### Examples block

When the persona has examples, the compiled prompt emits a numbered `[Examples]` block phrased as "see this kind of content → respond like this", with an instruction to follow the trigger→reaction feel without copying the content. Examples flow into every generation path because all paths read the persona through the same compilation.

## Runtime Source Of Truth

`getActivePersonaPrompt` resolves the active prompt:

- if `advancedPromptEnabled` is true and `advancedPromptText` is non-empty, use `advancedPromptText`
- otherwise compile from the sectioned persona via `compilePersonaPrompt`

This same resolution path is used by:

- preview generation
- paragraph comment generation (and chapter pre-generation)
- thread replies to the user
- comment replies between friends / chapter discussion
- summoned on-demand reactions

## Mode Switching

### Entering Advanced Mode

The friend editor exposes a single-row entry into a dedicated advanced page. On entry, if advanced mode is not already active with non-empty text, the system compiles the current sectioned persona into the advanced editor as a starting point and marks the friend as takeover-active. This preserves continuity from the familiar base persona.

### While Advanced Mode Is Active

The sectioned editors and example editor remain visible but are frozen and visually dimmed, with a banner explaining that the advanced prompt currently controls real generation. The advanced page exposes two recovery actions:

- `Regenerate advanced prompt from current sections` — requires confirmation, overwrites the advanced text with a freshly compiled prompt
- `Exit advanced mode` — requires confirmation, returns control to the sectioned fields and stops using the advanced prompt

### Invalid Advanced Prompt

If the advanced prompt is effectively blank, saving is blocked; the user can regenerate from the sections.

## Preview System

Preview helps the user hear the persona. It is a sandbox and must never write into reading-time data (no chapter caches, no generated paragraph stores, no pre-generation progress, no thread history, no memory summaries, no formal interaction data).

### Scope

Preview supports only one output type: a paragraph-style short comment. It does not preview chapter-end discussion or reply-thread output.

### Sample pool and switching

The app ships an internal `PREVIEW_SAMPLE_POOL` covering directions such as teasing/contradiction, suspense/abnormality, social embarrassment, interpersonal conflict, reckless action, and light emotional pull. Samples read like real comment triggers, not literary prose.

- `Change sample` picks a new sample, avoiding the same direction twice in a row when possible
- `Regenerate preview` reruns the same sample so the user can judge stability
- the UI shows the current sample direction label

### Isolation and interface

Preview reuses the same compiled persona prompt shape plus a lightweight `[Preview Task]` section (one sample fragment, output exactly one short comment, obey the short-comment constraints). It must be generated by the configured AI interface. If the interface is unavailable, the UI shows that preview cannot be generated rather than fabricating a local preview.

## UI Summary

The friend editor surfaces, top to bottom:

- avatar (centered) + freeform name headline
- appearance frequency
- the sectioned persona editors (one text box per section, each with counter and hint)
- the example editor (add/remove `{ trigger, reply }` rows, max 6)
- interface selection
- a single-row entry into the advanced prompt page (shows takeover status)
- the preview panel (sample bubble + friend avatar + reply bubble, with change-sample / regenerate actions)
- a single primary save button

Destructive and reset actions (delete friend, restore default persona) live behind a `⋯` menu in the top-right, shown only in edit mode. Create mode hides the menu.

## Testing

Automated:

- `tests/ai-reading-helpers.test.js` — section compilation, example emission, legacy `stylePrompt → identity` migration, active-prompt resolution, preview prompt shape
- `tests/ai-friend-editor-smoke.js` — section editors render, example add/remove, advanced page prefilled + sections frozen, delete via `⋯` menu persists
- `tests/ai-friend-preview-error-smoke.js` / `tests/ai-friend-preview-profile-lock-smoke.js` — preview uses the configured interface and surfaces errors instead of fabricating output

Manual:

- author a friend entirely from sections + examples
- preview across multiple sample directions and confirm voices read clearly different between friends
- regenerate preview on the same sample and confirm style stability
- enter advanced mode and confirm the compiled prompt is prefilled; regenerate and exit
- confirm preview output never appears in reading content or caches
- confirm real generation uses the advanced prompt when takeover is active, and the compiled sectioned prompt otherwise
