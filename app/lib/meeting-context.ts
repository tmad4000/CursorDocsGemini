// Meeting context integration for RealtimeMeetingOutline
// Fetches recent meetings/knowledge to provide context for document editing

const RMO_API_BASE = 'http://localhost:3002';

export interface MeetingContext {
  meetings: Array<{
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
  }>;
  summary: string;
}

/**
 * Fetch recent meetings from RealtimeMeetingOutline backend
 * Requires the RMO backend to be running on localhost:3002
 */
export async function fetchMeetingContext(authToken?: string): Promise<MeetingContext | null> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${RMO_API_BASE}/api/meetings`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('Failed to fetch meetings:', response.status);
      return null;
    }

    const meetings = await response.json();

    // Build a summary from recent meetings
    const recentMeetings = meetings.slice(0, 5);
    const summary = buildMeetingSummary(recentMeetings);

    return {
      meetings: recentMeetings,
      summary,
    };
  } catch (error) {
    console.warn('Could not connect to RealtimeMeetingOutline:', error);
    return null;
  }
}

/**
 * Build a text summary of meetings for AI context
 */
function buildMeetingSummary(meetings: MeetingContext['meetings']): string {
  if (!meetings.length) return '';

  const parts: string[] = ['## Recent Meeting Context\n'];

  for (const meeting of meetings) {
    parts.push(`### ${meeting.title || 'Untitled Meeting'} (${meeting.date || 'Unknown date'})`);

    if (meeting.outline) {
      const outline = typeof meeting.outline === 'string'
        ? JSON.parse(meeting.outline)
        : meeting.outline;

      // Participants
      if (outline.meeting?.participants?.length) {
        parts.push(`**Participants:** ${outline.meeting.participants.map((p: { name?: string; display?: string }) => p.name || p.display).join(', ')}`);
      }

      // Topics
      if (outline.meeting?.topics?.length) {
        parts.push('**Topics:**');
        for (const topic of outline.meeting.topics.slice(0, 5)) {
          parts.push(`- ${topic.title}${topic.notes ? `: ${topic.notes}` : ''}`);
        }
      }

      // People mentioned
      if (outline.people?.length) {
        parts.push(`**People mentioned:** ${outline.people.slice(0, 10).map((p: { name?: string; display?: string }) => p.name || p.display).join(', ')}`);
      }

      // Organizations
      if (outline.organizations?.length) {
        parts.push(`**Organizations:** ${outline.organizations.slice(0, 10).map((o: { name?: string; display?: string }) => o.name || o.display).join(', ')}`);
      }
    }

    // Include transcript excerpt if available
    if (meeting.transcript && meeting.transcript.length > 50) {
      const excerpt = meeting.transcript.slice(0, 500);
      parts.push(`**Transcript excerpt:** "${excerpt}..."`);
    }

    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Parse pasted meeting context (from user copy-paste)
 */
export function parsePastedContext(text: string): string {
  // Just clean up and format the pasted text
  return `## Meeting Context (Pasted)\n\n${text.trim()}`;
}

/**
 * Storage key for meeting context
 */
const CONTEXT_STORAGE_KEY = 'ai-editor-meeting-context';

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
