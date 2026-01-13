/**
 * Frontend Logger
 *
 * Logs to both browser console and server via /api/log endpoint.
 * Use this for errors you want to see in server logs for debugging.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
    [key: string]: unknown;
}

async function sendToServer(
    level: LogLevel,
    message: string,
    error?: Error | string,
    context?: LogContext
): Promise<void> {
    try {
        await fetch('/api/frontend-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level,
                message,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                context,
            }),
        });
    } catch {
        // Silently fail - don't create infinite error loops
    }
}

export const logger = {
    /**
     * Log an error - appears in browser console AND server logs
     */
    error(message: string, error?: Error | string, context?: LogContext): void {
        console.error(`[Error] ${message}`, error, context);
        sendToServer('error', message, error, context);
    },

    /**
     * Log a warning - appears in browser console AND server logs
     */
    warn(message: string, context?: LogContext): void {
        console.warn(`[Warn] ${message}`, context);
        sendToServer('warn', message, undefined, context);
    },

    /**
     * Log info - appears in browser console AND server logs
     */
    info(message: string, context?: LogContext): void {
        console.info(`[Info] ${message}`, context);
        sendToServer('info', message, undefined, context);
    },

    /**
     * Log debug - browser console only (unless NODE_ENV !== production)
     */
    debug(message: string, context?: LogContext): void {
        console.debug(`[Debug] ${message}`, context);
        // Only send debug logs to server in development
        if (process.env.NODE_ENV !== 'production') {
            sendToServer('debug', message, undefined, context);
        }
    },
};

export default logger;
