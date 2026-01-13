import { NextResponse } from 'next/server';

/**
 * Frontend Error Logging Endpoint
 *
 * Accepts frontend errors and logs them server-side for debugging.
 * This helps correlate frontend issues with backend logs.
 *
 * POST /api/log
 * Body: { level, message, error?, stack?, context? }
 */

interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    error?: string;
    stack?: string;
    context?: Record<string, unknown>;
    timestamp?: string;
    userAgent?: string;
}

export async function POST(req: Request) {
    try {
        const body: LogEntry = await req.json();
        const { level = 'info', message, error, stack, context } = body;

        // Add metadata
        const logEntry = {
            source: 'frontend',
            level,
            message,
            error,
            stack: stack?.slice(0, 2000), // Limit stack trace size
            context,
            timestamp: new Date().toISOString(),
            userAgent: req.headers.get('user-agent')?.slice(0, 200),
        };

        // Log with appropriate level
        const prefix = `[Frontend ${level.toUpperCase()}]`;
        switch (level) {
            case 'error':
                console.error(prefix, message, error ? `\n${error}` : '', context ? `\nContext: ${JSON.stringify(context)}` : '');
                if (stack) console.error('Stack:', stack.slice(0, 500));
                break;
            case 'warn':
                console.warn(prefix, message, context || '');
                break;
            case 'info':
                console.info(prefix, message, context || '');
                break;
            case 'debug':
                console.debug(prefix, message, context || '');
                break;
        }

        return NextResponse.json({ logged: true });
    } catch (err) {
        console.error('[Frontend Log] Failed to parse log entry:', err);
        return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
    }
}

// GET endpoint to check logging is working
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        usage: 'POST { level, message, error?, stack?, context? }',
        levels: ['error', 'warn', 'info', 'debug'],
    });
}
