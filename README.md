# AI Editor Prototype

This is a Next.js-based AI Document Editor that mimics features found in tools like Cursor and Google Docs.

## Demo (v1)
[Watch the demo on Loom](https://www.loom.com/share/1c850b64a7bb4054bc53e5ca9c4e3ccc)

## Features
- **AI Sidebar**: Chat with an AI assistant to edit your document.
- **Track Changes**: AI suggestions appear as insertions (green) and deletions (red).
- **Review Mode**: A sidebar tab to review, accept, and reject changes one by one.
- **Atomic Edits**: Robust handling of adjacent changes.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack
- **Framework**: Next.js 15
- **Editor**: Tiptap (ProseMirror)
- **AI**: OpenAI API (gpt-4o / gpt-3.5-turbo)
- **Styling**: CSS Modules