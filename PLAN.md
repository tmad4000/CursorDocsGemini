# Development Plan: Editor Enhancements & Fixes

## Phase 1: Core Reliability (The Foundation) - [COMPLETED]
*Crucial for any "Track Changes" workflow to work reliably.*
- [x] **Fix Accept/Reject Bugs**: 
    -   Refactor `SuggestionBubbleMenu.tsx` to handle adjacent insertions/deletions robustly.
    -   Ensure "Accepting" an insertion correctly removes any linked "Deletion" marks (clean up the diff).

## Phase 2: The "Cursor-Like" Review Workflow - [COMPLETED]
*Addressing: "Click through improve stuff", "One after another", "Sidebar list".*
- [x] **Sidebar Review Queue (The "List")**:
    -   Create a new tab in `AISidebar` called "Review".
    -   Auto-scan the document for pending changes (`insertion`/`deletion` marks).
    -   Display them as a list of cards.
    -   Clicking a card scrolls the editor to that change.
    -   Include "Accept/Reject" buttons directly on the cards.

## Phase 3: Context-Aware Interaction - [COMPLETED]
*Addressing: "Select text and improve", "Make it better button".*
- [x] **Inline Edit (Cmd+K style)**:
    -   Add a "Magic Wand" or "Edit" button to the text selection bubble menu.
    -   Add input field for custom instructions ("Make shorter", etc.).
    -   This triggers a *partial* AI update for just that selection.

## Phase 4: Advanced Views - "Focused Split" - [DEFERRED]
*Addressing: "Real time editing view", "Split pane".*
- [ ] **Under-Paragraph Suggestion Drawer**:
    -   (Future) Implement an "In-line" expansion drawer.
    -   Current Solution: Inline Diff Marks (Red/Green) + Sidebar Review List covers the "Review" use case effectively for V1.

## Backlog
- [ ] **Email Integration**: View clients/drafts (Deferred).

## Phase 5: Review + Chat UX Brainstorm - [PLANNING]
*Goal: keep AI conversation useful while reviewing suggested edits.*

### UX options
- **Persistent chat drawer**: keep the main chat thread visible as a collapsible bottom panel even in the Review tab. Review list stays primary; chat is always one click away.
- **Per‑suggestion “Discuss”**: add a button on each review card to open a focused chat about that specific edit. Could be:
  - same global thread, but auto‑injects the selected suggestion as context, or
  - a lightweight per‑suggestion thread (like Google Docs comments).
- **Reference by click / @mention**: clicking a suggestion inserts a token into the chat input (`@change 3`) and the send handler includes that suggestion range + text in the prompt.
- **Quick AI actions from Review**: “rephrase this edit”, “make this smaller”, “undo this change” buttons on cards that call the same AI pipeline using the suggestion range as the selection.

### Recommended V1
- Keep **one global chat thread**, but allow **context targeting**:
  - Add “Discuss” on each suggestion card.
  - Clicking it sets a `currentSuggestion` (from/to/type/text) in shared context and either:
    - opens a small inline chat drawer in Review, or
    - switches to Chat with the prompt prefilled.
  - Chat send includes the suggestion’s clean text + type and (optionally) nearby paragraph for context.

### Implementation notes
- Extend `EditorContext` or add a small `ReviewContext` to store `currentSuggestion`.
- In `AISidebar.handleSend`, if `currentSuggestion` exists, include it in the system/user prompt and clear it after send (unless “pin” is enabled).
- In `ReviewTab`, wire card “Discuss” to set context and optionally focus chat input.

### Open questions
- Should per‑suggestion chats persist as comments (shareable), or stay transient in the main thread?
- When multiple suggestions are selected, do we batch into one prompt or allow multi‑select review actions?
