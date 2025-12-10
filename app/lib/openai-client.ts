// Client-side OpenAI service for static/standalone mode
import OpenAI from 'openai';
import { ModelId } from './models';

const API_KEY_STORAGE_KEY = 'openai_api_key';

export function getStoredApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function hasStoredApiKey(): boolean {
    return !!getStoredApiKey();
}

export async function chatWithOpenAI(
    messages: Array<{ role: string; content: string }>,
    model: ModelId,
    apiKey: string
): Promise<string> {
    const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true, // Required for client-side usage
    });

    const completion = await openai.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
    });

    return completion.choices[0].message.content || '';
}

// Determine if we're in static mode (no server-side API)
export function isStaticMode(): boolean {
    // Check for explicit environment variable
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_STATIC_MODE === 'true') {
        return true;
    }
    // In production static builds, the API route won't exist
    // We can also check if we're on github.io
    if (typeof window !== 'undefined') {
        return window.location.hostname.endsWith('.github.io');
    }
    return false;
}
