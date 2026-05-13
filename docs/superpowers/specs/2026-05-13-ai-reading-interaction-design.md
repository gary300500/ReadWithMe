# AI Reading Interaction Design

## Goal

Turn the current static AI comments into a memory-driven reading interaction system with:

- paragraph comments that can be followed up in-thread
- chapter-end discussion threads
- shared rolling chapter memory
- background pre-generation for the next reading window
- limited AI-to-AI interaction that increases community feel without turning into autonomous group chat

## Current State

The app already has:

- AI interface profiles and per-friend profile selection
- AI friend personas with prompt fields
- chapter comment generation through the local proxy
- local comment caching
- a reader UI with paragraph comment entry points

Today the runtime still behaves like one-shot comment generation. AI comments are generated as paragraph comments, and the user can manually add comments, but there is no true threaded follow-up, no chapter discussion surface, no shared reading memory, and no rolling pre-generation pipeline.

## Product Structure

The first version adds four connected product surfaces:

1. `Paragraph interaction`
   - Keep the existing paragraph comment entry point.
   - Upgrade it into a thread anchored to a specific paragraph.
   - AI friends can give first-pass comments, and the user can keep asking follow-up questions in the same thread.

2. `Chapter interaction`
   - Add a chapter-end discussion area.
   - This is a chapter-scoped discussion thread, not just a one-time summary block.
   - It is the better place for whole-chapter questions, pacing discussion, character movement, and unresolved chapter-level issues.

3. `Shared chapter memory`
   - All AI friends share one chapter-by-chapter rolling memory for each book.
   - This memory is meant to feel like a reader's remembered understanding, not a lossless archive.

4. `Background pre-generation`
   - The system pre-builds chapter memory and first-pass comments ahead of the current reading position.
   - The default rolling window is the next 5 chapters.

## Reading-Time Boundary

All AI interaction must be constrained by the interaction anchor, not by whether the user has manually peeked ahead.

- Paragraph interaction sees:
  - prior chapter memory
  - the current chapter up to the paragraph's local scope
  - the paragraph thread history
- Chapter interaction sees:
  - prior chapter memory
  - the full current chapter
  - the chapter thread history

If the user opens a later chapter and then comes back, the AI should still answer from the earlier chapter timepoint. Peeking ahead must not count as "read" for memory scope.

## Shared Chapter Memory

Each book has one committed memory artifact per chapter:

- `summary_1` is generated from empty prior memory plus chapter 1
- `summary_n` is generated from `summary_(n-1)` plus chapter `n`

The summary should feel like compressed reading memory:

- broad plot progression
- current important characters and their states
- relationship shifts
- unresolved questions
- currently relevant world or setting facts

This memory is shared across AI friends in v1. Persona differences come from prompt style and attention preferences, not separate long-term memory stores.

### Summary Output Shape

The app will assume structured schema output is available and will harden it with validation and repair. The summary artifact should stay compact and stable. A representative shape is:

```json
{
  "chapterIndex": 12,
  "plotSummary": "string",
  "majorCharacters": [
    { "name": "string", "state": "string", "salience": "high" }
  ],
  "relationships": [
    { "a": "string", "b": "string", "state": "string" }
  ],
  "openQuestions": ["string"],
  "worldFacts": ["string"]
}
```

Exact field names can change during implementation, but the schema must remain:

- small
- bounded in length
- stable across chapters
- suitable as the next chapter's memory input

## Thread Model

Each interaction surface owns its own thread:

- paragraph thread key: `bookId + chapterIndex + paragraphIndex`
- chapter thread key: `bookId + chapterIndex + anchorType=chapter`

Threads are user-visible as open-ended, but internally they are compressed over time.

The runtime should retain:

- the latest few raw turns
- a thread summary for older turns
- the current active anchor context

This keeps follow-up conversation coherent without forcing every old message to remain in the prompt forever.

## Paragraph and Chapter Behavior

### Paragraph Interaction

- centered on specific text and nearby local context
- first-pass AI comments should stay short, specific, and text-near
- user follow-ups may expand into local chapter context when needed
- AI-to-AI interaction is allowed, but should stay sparse

### Chapter Interaction

- centered on the whole chapter
- meant more as a discussion area than a static chapter review
- better suited for chapter-wide interpretation and unresolved questions
- may allow slightly more AI-to-AI reply activity than paragraph threads

## AI-to-AI Interaction Boundary

AI friends may interact with each other, but only under strict limits:

- only inside the same paragraph or chapter anchor
- mainly agreement or supplementation
- occasional mild disagreement is allowed
- no autonomous multi-round self-chat
- once the user asks something, user-directed replies take priority

The purpose is to create the feeling that AI friends notice each other, not to create an AI-only social feed.

## Comment Output Model

The first version should keep comment structure minimal. Each generated message should carry:

```json
{
  "text": "string",
  "replyToCommentId": "string | null",
  "discussionMode": "closed | open | inviting"
}
```

Notes:

- `text` is the core output
- `replyToCommentId` is only for controlled local replies
- `discussionMode=inviting` is primarily used to make a comment more likely to receive one additional AI reply
- users do not see this metadata directly

The first version does not require extra topic tags such as `replyHooks`.

## Persona and Prompt Architecture

Prompting should be layered, not replaced by one large freeform persona block.

### Shared System Layer

Common rules for all AI friends:

- do not spoil unread content
- answer from the current reading timepoint
- do not act omniscient about distant details
- sound like Chinese web novel readers or reading companions, not customer support

### Scene Layer

Different prompt templates are needed for:

- paragraph first comment
- paragraph follow-up reply
- chapter first comment
- chapter follow-up reply
- AI-to-AI supplemental reply
- chapter memory update
- background pre-generation

### Persona Layer

AI friend configuration should use a mixed structure:

- structured fields for stable behavior
- a short custom style note for extra flavor

Representative structured dimensions:

- focus tendency
- tone
- energy
- preferred reply length
- interaction tendency
- disagreement style
- relationship feel

### Context Layer

Each request then injects:

- shared committed chapter memory
- current paragraph or chapter text
- thread summary
- most recent messages
- target comment or user question

## Pre-Generation Pipeline

### Cold Start

When a new book is imported, the app should not wait for the user to read before starting AI preparation.

The default cold-start warm-up covers chapters 1 through 5 in this order:

1. `summary_1`
2. `chapter_1 comments`
3. `summary_2`
4. `chapter_2 comments`
5. continue until `summary_5` and `chapter_5 comments` are ready

This ensures the first chapter is usable immediately while also building the rolling memory chain correctly.

### Rolling Window

After cold start, the app maintains a forward window of about 5 prepared chapters past the user's current reading chapter.

Background priority order:

1. current chapter live interaction
2. missing summary for the next needed chapter
3. first-pass comments for that chapter
4. later chapters in the rolling window

Pre-generation must never block the user's current interaction path.

## Data Model and Cache Boundaries

The design should keep these state classes separate:

1. `chapter memory summaries`
2. `first-pass comment caches`
3. `live interaction threads`
4. `pre-generation task state`

### Summary Artifacts

Each summary should carry at least:

- `bookId`
- `chapterIndex`
- `generatedAt`
- `schemaVersion`
- a fingerprint tied to relevant model and prompt settings
- generation state such as `candidate` or `committed`

### Cache Invalidation

The system should invalidate or mark stale when relevant inputs change, including:

- prompt version changes
- enabled AI friend set changes
- persona configuration changes
- model profile changes
- chapter segmentation changes

Existing stale caches do not need to be hard-deleted immediately. They may be marked stale and gradually replaced.

## Structured Output Hardening

This design assumes models can generally follow schema, but the runtime still needs standard hardening.

### Preferred Flow

1. use structured schema output first
2. check response completeness before parsing
3. validate with Pydantic
4. if syntax is malformed, run limited `json_repair`
5. validate with Pydantic again
6. if still invalid, retry generation

### Rules

- Pydantic is the final validator
- `json_repair` is only for lightweight syntax repair
- repair must never bypass schema validation
- small, bounded schemas are preferred over rich flexible schemas

### Summary Chain Safety

Summary generation is stricter than comment generation:

- summaries are written to `candidate` first
- only validated summaries become `committed`
- only `committed` summaries may seed the next chapter

This prevents a bad chapter summary from poisoning the rest of the memory chain.

## Failure Policy

### Summary Failure

- a failed summary does not become committed
- the memory chain pauses at that chapter until retry succeeds
- later summaries do not advance from an invalid predecessor
- live interaction may temporarily fall back to local chapter context if needed, but the chain itself must not advance with bad state

### Comment Failure

- comment failure must not block the reader
- the affected anchor may show no AI comment yet, or show a lightweight retry state
- user-triggered live generation can retry on demand

### Metadata Failure

- malformed reply metadata must not discard a valid comment text
- AI-to-AI enhancement may be skipped if the metadata pass fails

### Pre-Generation Failure

- background failures should stay in task state and be retried later
- they should not surface as intrusive reading errors

## Validation Plan

The finished implementation should be accepted only after verifying these flows:

1. cold-start warm-up produces usable chapter 1 output and rolls to chapter 5
2. paragraph follow-up threads stay coherent across multiple turns
3. chapter discussion supports whole-chapter questions
4. peeking ahead does not contaminate earlier chapter interaction scope
5. rolling pre-generation replenishes the next-5-chapter window
6. structured output validation, repair, retry, and candidate/committed behavior work as designed

## Out of Scope for v1

- separate long-term memory per AI friend
- a standalone full-screen AI chat panel
- unrestricted AI-only conversations
- exposing internal discussion metadata to the user
- building for intentionally poor or schema-hostile model interfaces
