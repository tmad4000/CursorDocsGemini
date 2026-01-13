# CursorDocsGemini Architecture

AI-powered document editor with meeting context integration.

## Overview

CursorDocsGemini is a "Cursor-like" document editing experience that:
1. Provides an AI sidebar for editing documents
2. Integrates with RealtimeMeetingOutline (RMO) for meeting context
3. Supports multiple LLM providers (Gemini, OpenAI)

## Integration with RealtimeMeetingOutline (RMO)

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   CursorDocsGemini      │         │  RealtimeMeetingOutline │
│   (localhost:3001)      │         │    (localhost:3002)     │
│                         │         │                         │
│  ┌─────────────────┐    │  HTTP   │  ┌─────────────────┐    │
│  │   AISidebar     │────┼────────►│  │ /api/assistant/ │    │
│  │                 │    │         │  │    context      │    │
│  │ - meeting ctx   │◄───┼─────────│  │                 │    │
│  │ - chat history  │    │  JSON   │  │ Returns:        │    │
│  │ - model select  │    │         │  │ - userFiles     │    │
│  └─────────────────┘    │         │  │ - meetings      │    │
│                         │         │  │ - knowledgeBase │    │
│  ┌─────────────────┐    │         │  │ - entities      │    │
│  │   /api/chat     │    │         │  └─────────────────┘    │
│  │                 │    │         │                         │
│  │ - Gemini 3 Flash│    │         │  ┌─────────────────┐    │
│  │ - GPT-5.2       │    │         │  │   Neo4j DB      │    │
│  │ - rate limiting │    │         │  │   (meetings)    │    │
│  └─────────────────┘    │         │  └─────────────────┘    │
└─────────────────────────┘         └─────────────────────────┘
```

## Key Files

### Frontend (React/Next.js)

| File | Purpose |
|------|---------|
| `app/components/Sidebar/AISidebar.tsx` | Main AI chat sidebar component |
| `app/components/Sidebar/AISidebar.module.css` | Sidebar styling |
| `app/lib/meeting-context.ts` | RMO integration - fetches meeting context |
| `app/lib/models.ts` | Available LLM models configuration |
| `app/lib/openai-client.ts` | Client-side API utilities |

### Backend (API Routes)

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | Main chat endpoint - handles Gemini & OpenAI |
| `app/api/log/route.ts` | Frontend error logging endpoint |

## RMO Context API

**Endpoint:** `GET http://localhost:3002/api/assistant/context`

**Auth:**
- JWT token in `Authorization: Bearer <token>` header (for user-specific meetings)
- Localhost requests bypass auth (for inter-service communication)

**Response:**
```typescript
{
  userFiles: Array<{ filename: string, content: string }>,
  recentMeetings: Array<{
    id: string,
    title: string,
    date: string,
    outline: object,
    transcript: string
  }>,
  knowledgeBase: {
    structuredEntries: Array<{ source: string, content: string }>,
    markdownFiles: Array<{ name: string, content: string }>
  },
  entities: {
    people: Array<{ name: string, title?: string, company?: string }>,
    organizations: Array<{ name: string, description?: string }>
  }
}
```

## Chat Behavior

### Edit Detection

The AI detects whether to edit the document or respond conversationally:

```typescript
const editKeywords = /\b(edit|change|fix|improve|rewrite|revise|update|make|add|remove|delete|insert|replace|proofread|correct|shorten|expand|summarize|rephrase)\b/i;
const looksLikeEditRequest = alwaysSuggestChanges || editKeywords.test(userMessage);
```

- **Edit mode**: Returns HTML, applies to document
- **Conversational mode**: Returns plain text, displays in chat

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Track Changes | ON | Show insertions/deletions with highlighting |
| Always suggest changes | OFF | Force edit mode for all messages |
| Use my own API key | OFF | Use client-side API key instead of server |
| Include meeting context | OFF | Fetch and include RMO context in prompts |

## Rate Limiting

The `/api/chat` endpoint enforces:
- **100 requests/day** global limit
- **10 requests/hour** per IP
- Warnings at 80% usage
- Suggests switching to Gemini when rate limited

## Error Logging

Frontend errors can be sent to `/api/log`:

```typescript
fetch('/api/log', {
  method: 'POST',
  body: JSON.stringify({
    level: 'error',
    message: 'Chat failed',
    error: error.message,
    stack: error.stack,
    context: { model: selectedModel }
  })
});
```

Server logs will show: `[Frontend ERROR] Chat failed`

## Models (January 2026)

| Model | Provider | Notes |
|-------|----------|-------|
| gemini-3-flash | Google | Default, fastest frontier model |
| gemini-2.5-flash | Google | Fast, reliable |
| gemini-2.0-flash | Google | 1M context |
| gpt-5.2-pro | OpenAI | Most capable |
| gpt-5.2 | OpenAI | 400K context |
| gpt-4.1 | OpenAI | Best for coding |
| gpt-4o | OpenAI | Multimodal |
| gpt-4o-mini | OpenAI | Fast & affordable |

## Development

```bash
# Start CursorDocsGemini
cd ~/code/CursorDocsGemini
npm run dev  # localhost:3001

# Start RMO backend (for meeting context)
cd ~/code/RealtimeMeetingOutline/backend
PORT=3002 npm run dev
```

## Related Projects

- **RealtimeMeetingOutline**: Meeting transcription & knowledge base
- **noosphere-proto**: Unified semantic memory layer (future integration)
