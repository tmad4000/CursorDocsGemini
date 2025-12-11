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
