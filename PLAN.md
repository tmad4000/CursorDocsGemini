# Development Plan: Editor Enhancements & Fixes

## Phase 1: Core Reliability (The Foundation)
*Crucial for any "Track Changes" workflow to work reliably.*
1.  **Fix Accept/Reject Bugs**: 
    -   Refactor `SuggestionBubbleMenu.tsx` to handle adjacent insertions/deletions robustly.
    -   Ensure "Accepting" an insertion correctly removes any linked "Deletion" marks (clean up the diff).

## Phase 2: The "Cursor-Like" Review Workflow
*Addressing: "Click through improve stuff", "One after another", "Sidebar list".*
2.  **Sidebar Review Queue (The "List")**:
    -   Create a new tab in `AISidebar` called "Review".
    -   Auto-scan the document for pending changes (`insertion`/`deletion` marks).
    -   Display them as a list of cards.
    -   Clicking a card scrolls the editor to that change.
    -   Include "Accept/Reject" buttons directly on the cards.

## Phase 3: Context-Aware Interaction
*Addressing: "Select text and improve", "Make it better button".*
3.  **Inline Edit (Cmd+K style)**:
    -   Add a "Magic Wand" or "Edit" button to the text selection bubble menu.
    -   (Future) Add keyboard shortcut (Cmd+K) to trigger this.
    -   This triggers a *partial* AI update for just that selection.

## Phase 4: Advanced Views - "Focused Split"
*Addressing: "Real time editing view", "Split pane".*
4.  **Under-Paragraph Suggestion Drawer**:
    -   Implement an "In-line" expansion drawer.
    -   When triggered for a specific paragraph, the document "splits" locally.
    -   Shows [Original Paragraph] vs [AI Suggested Paragraph] stacked vertically.
    -   Allows "Apply", "Discard", or copy-pasting.

## Backlog
5.  **Email Integration**: View clients/drafts (Deferred).