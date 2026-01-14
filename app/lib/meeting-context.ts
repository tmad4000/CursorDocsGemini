// Meeting context integration for RealtimeMeetingOutline
// Fetches comprehensive context including meetings, files, knowledge base, and entities

// Use environment variable with fallback to default RMO port
const RMO_API_BASE = process.env.NEXT_PUBLIC_RMO_API_URL || 'http://localhost:3848';

export interface UserFile {
  filename: string;
  content?: string;
  error?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  transcript?: string;
  outline?: {
    meeting?: {
      topics?: Array<{ title: string; notes?: string }>;
      participants?: Array<{ name: string }>;
    };
    people?: Array<{ name: string; title?: string }>;
    organizations?: Array<{ name: string }>;
  };
}

export interface KnowledgeEntry {
  source: string;
  content: string;
  date?: string;
}

export interface Entity {
  name: string;
  title?: string;
  company?: string;
  description?: string;
}

export interface RMOContext {
  userFiles: UserFile[];
  recentMeetings: Meeting[];
  knowledgeBase: {
    structuredEntries: KnowledgeEntry[];
    markdownFiles: Array<{ name: string; content: string }>;
  };
  entities: {
    people: Entity[];
    organizations: Entity[];
  };
  capabilities: string[];
}

/**
 * Fetch comprehensive context from RealtimeMeetingOutline backend
 * Requires the RMO backend to be running (default: localhost:3848, or set NEXT_PUBLIC_RMO_API_URL)
 *
 * Auth options:
 * - Pass an auth token for full access to user-specific meetings
 * - From localhost, basic context (files, knowledge base) works without auth
 */
export async function fetchRMOContext(authToken?: string): Promise<RMOContext | null> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${RMO_API_BASE}/api/assistant/context`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('Failed to fetch RMO context:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('Could not connect to RealtimeMeetingOutline:', error);
    return null;
  }
}

/**
 * Build a formatted text summary of RMO context for AI prompts
 */
export function buildContextSummary(context: RMOContext): string {
  const parts: string[] = ['# Knowledge Context from Meeting Assistant\n'];

  // User files
  if (context.userFiles?.length > 0) {
    parts.push('## Your Files\n');
    for (const file of context.userFiles) {
      parts.push(`### ${file.filename}`);
      if (file.content) {
        parts.push('```');
        parts.push(file.content.slice(0, 2000));
        parts.push('```');
      }
      parts.push('');
    }
  }

  // Recent meetings
  if (context.recentMeetings?.length > 0) {
    parts.push('## Recent Meetings\n');
    for (const meeting of context.recentMeetings) {
      parts.push(`### ${meeting.title || 'Untitled Meeting'} (${meeting.date || 'Unknown date'})`);

      if (meeting.outline) {
        // Participants
        if (meeting.outline.meeting?.participants?.length) {
          const participants = meeting.outline.meeting.participants
            .map((p: { name?: string; display?: string }) => p.name || p.display)
            .join(', ');
          parts.push(`**Participants:** ${participants}`);
        }

        // Topics
        if (meeting.outline.meeting?.topics?.length) {
          parts.push('**Topics:**');
          for (const topic of meeting.outline.meeting.topics.slice(0, 5)) {
            parts.push(`- ${topic.title}${topic.notes ? `: ${topic.notes}` : ''}`);
          }
        }

        // People mentioned
        if (meeting.outline.people?.length) {
          const people = meeting.outline.people
            .slice(0, 10)
            .map((p: { name?: string; display?: string }) => p.name || p.display)
            .join(', ');
          parts.push(`**People mentioned:** ${people}`);
        }

        // Organizations
        if (meeting.outline.organizations?.length) {
          const orgs = meeting.outline.organizations
            .slice(0, 10)
            .map((o: { name?: string; display?: string }) => o.name || o.display)
            .join(', ');
          parts.push(`**Organizations:** ${orgs}`);
        }
      }

      // Transcript excerpt
      if (meeting.transcript && meeting.transcript.length > 50) {
        parts.push(`**Transcript excerpt:** "${meeting.transcript.slice(0, 500)}..."`);
      }

      parts.push('');
    }
  }

  // Knowledge base entries
  if (context.knowledgeBase?.structuredEntries?.length > 0) {
    parts.push('## Knowledge Base\n');
    for (const entry of context.knowledgeBase.structuredEntries.slice(0, 20)) {
      parts.push(`- [${entry.source}] ${entry.content}`);
    }
    parts.push('');
  }

  // Markdown knowledge files
  if (context.knowledgeBase?.markdownFiles?.length > 0) {
    for (const file of context.knowledgeBase.markdownFiles) {
      parts.push(`## ${file.name}\n`);
      parts.push(file.content.slice(0, 2000));
      parts.push('');
    }
  }

  // Known entities
  if (context.entities?.people?.length > 0 || context.entities?.organizations?.length > 0) {
    parts.push('## Known Contacts\n');

    if (context.entities.people?.length > 0) {
      parts.push('**People:**');
      for (const person of context.entities.people.slice(0, 20)) {
        const details = [person.title, person.company].filter(Boolean).join(' at ');
        parts.push(`- ${person.name}${details ? ` (${details})` : ''}`);
      }
    }

    if (context.entities.organizations?.length > 0) {
      parts.push('\n**Organizations:**');
      for (const org of context.entities.organizations.slice(0, 20)) {
        parts.push(`- ${org.name}${org.description ? `: ${org.description}` : ''}`);
      }
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Legacy function - still works but prefer fetchRMOContext for full data
 */
export async function fetchMeetingContext(authToken?: string): Promise<{ meetings: Meeting[]; summary: string } | null> {
  const context = await fetchRMOContext(authToken);
  if (!context) return null;

  return {
    meetings: context.recentMeetings,
    summary: buildContextSummary(context),
  };
}

/**
 * Fetch full transcript for a specific meeting
 * Use when you need the complete transcript (not just the 2KB excerpt)
 */
export async function fetchFullTranscript(meetingId: string, authToken?: string): Promise<{
  meetingId: string;
  title: string;
  date: string;
  transcript: string;
  transcriptLength: number;
} | null> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`${RMO_API_BASE}/api/assistant/meeting/${meetingId}/transcript`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('Failed to fetch transcript:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('Could not fetch transcript:', error);
    return null;
  }
}

/**
 * Fetch full meeting details including transcript, outline, entities
 * Use when you need comprehensive meeting data for deep analysis
 */
export async function fetchFullMeeting(meetingId: string, authToken?: string): Promise<{
  id: string;
  title: string;
  date: string;
  endDate?: string;
  duration?: number;
  status: string;
  transcript: string;
  outline: Meeting['outline'];
  listCaptures: Array<{ name: string; lists: string[] }>;
  entities: Array<{ type: string; name: string; [key: string]: unknown }>;
} | null> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`${RMO_API_BASE}/api/assistant/meeting/${meetingId}`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('Failed to fetch meeting details:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('Could not fetch meeting details:', error);
    return null;
  }
}

/**
 * Parse pasted meeting context (from user copy-paste)
 */
export function parsePastedContext(text: string): string {
  return `## Meeting Context (Pasted)\n\n${text.trim()}`;
}

/**
 * Storage key for meeting context
 */
const CONTEXT_STORAGE_KEY = 'ai-editor-meeting-context';
const AUTH_TOKEN_KEY = 'rmo-auth-token';

export function getStoredMeetingContext(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONTEXT_STORAGE_KEY);
}

export function setStoredMeetingContext(context: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONTEXT_STORAGE_KEY, context);
}

export function clearStoredMeetingContext(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONTEXT_STORAGE_KEY);
}

// Auth token storage for cross-app authentication
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
