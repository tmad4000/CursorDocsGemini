import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models';

// Lazy initialization to avoid errors during static export
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openai;
}

// ============================================
// RATE LIMITING - $100/month budget protection
// ============================================
// Assumptions: ~$0.025/request average (GPT-4o)
// $100/month = ~4000 requests = ~130/day = ~5-6/hour
// Being conservative: 100 requests/day global, 20/hour per IP

const DAILY_GLOBAL_LIMIT = 100;        // Total requests per day across all users
const HOURLY_PER_IP_LIMIT = 10;        // Requests per hour per IP address
const WARNING_THRESHOLD = 0.8;          // Warn at 80% of daily limit

// In-memory storage (resets on cold start, but that's fine for basic protection)
interface RateLimitData {
    globalDaily: { count: number; resetTime: number };
    ipHourly: Map<string, { count: number; resetTime: number }>;
}

const rateLimitData: RateLimitData = {
    globalDaily: { count: 0, resetTime: Date.now() + 86400000 },
    ipHourly: new Map(),
};

function getClientIP(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; error?: string; warning?: string } {
    const now = Date.now();

    // Reset daily counter if day has passed
    if (now > rateLimitData.globalDaily.resetTime) {
        rateLimitData.globalDaily = { count: 0, resetTime: now + 86400000 };
        console.log('[Rate Limit] Daily counter reset');
    }

    // Check global daily limit
    if (rateLimitData.globalDaily.count >= DAILY_GLOBAL_LIMIT) {
        const hoursUntilReset = Math.ceil((rateLimitData.globalDaily.resetTime - now) / 3600000);
        return {
            allowed: false,
            error: `Daily limit reached (${DAILY_GLOBAL_LIMIT} requests). Resets in ~${hoursUntilReset} hours. This protects against unexpected costs.`
        };
    }

    // Check/reset per-IP hourly limit
    const ipData = rateLimitData.ipHourly.get(ip);
    if (ipData && now > ipData.resetTime) {
        rateLimitData.ipHourly.delete(ip);
    }

    const currentIpData = rateLimitData.ipHourly.get(ip);
    if (currentIpData && currentIpData.count >= HOURLY_PER_IP_LIMIT) {
        const minsUntilReset = Math.ceil((currentIpData.resetTime - now) / 60000);
        return {
            allowed: false,
            error: `Rate limit: ${HOURLY_PER_IP_LIMIT} requests/hour. Try again in ~${minsUntilReset} minutes.`
        };
    }

    // Increment counters
    rateLimitData.globalDaily.count++;

    if (currentIpData) {
        currentIpData.count++;
    } else {
        rateLimitData.ipHourly.set(ip, { count: 1, resetTime: now + 3600000 });
    }

    // Check if we should warn
    const usagePercent = rateLimitData.globalDaily.count / DAILY_GLOBAL_LIMIT;
    let warning: string | undefined;

    if (usagePercent >= WARNING_THRESHOLD) {
        const remaining = DAILY_GLOBAL_LIMIT - rateLimitData.globalDaily.count;
        warning = `Warning: ${Math.round(usagePercent * 100)}% of daily budget used. ${remaining} requests remaining today.`;
        console.log(`[Rate Limit Warning] ${warning}`);
    }

    // Log usage periodically
    if (rateLimitData.globalDaily.count % 10 === 0) {
        console.log(`[Rate Limit] Daily usage: ${rateLimitData.globalDaily.count}/${DAILY_GLOBAL_LIMIT} (${Math.round(usagePercent * 100)}%)`);
    }

    return { allowed: true, warning };
}

// ============================================
// API ROUTE
// ============================================

export async function POST(req: Request) {
    // Debug: Check if API key is available
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const keyPrefix = process.env.OPENAI_API_KEY?.substring(0, 7) || 'not set';
    console.log(`[API Debug] API key available: ${hasApiKey}, prefix: ${keyPrefix}`);

    try {
        // Check rate limits first
        const ip = getClientIP(req);
        const rateCheck = checkRateLimit(ip);

        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: rateCheck.error },
                { status: 429 }
            );
        }

        const { messages, model = DEFAULT_MODEL } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Validate model
        const validModels = AVAILABLE_MODELS.map(m => m.id);
        const selectedModel = validModels.includes(model) ? model : DEFAULT_MODEL;

        const completion = await getOpenAI().chat.completions.create({
            model: selectedModel,
            messages: [
                { role: "system", content: "You are a helpful AI writing assistant. You can help users refine their documents. Keep your answers concise and helpful." },
                ...messages
            ],
        });

        const reply = completion.choices[0].message.content;

        // Include warning in response if applicable
        const response: { reply: string | null; warning?: string } = { reply };
        if (rateCheck.warning) {
            response.warning = rateCheck.warning;
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('OpenAI API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorDetails = error instanceof Error ? error.stack : String(error);
        console.error('Error details:', errorDetails);
        return NextResponse.json({
            error: 'Internal Server Error',
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        }, { status: 500 });
    }
}

// GET endpoint to check current usage (for monitoring)
export async function GET() {
    const now = Date.now();
    const hoursUntilReset = Math.max(0, Math.ceil((rateLimitData.globalDaily.resetTime - now) / 3600000));
    const usagePercent = Math.round((rateLimitData.globalDaily.count / DAILY_GLOBAL_LIMIT) * 100);

    return NextResponse.json({
        daily: {
            used: rateLimitData.globalDaily.count,
            limit: DAILY_GLOBAL_LIMIT,
            percent: usagePercent,
            hoursUntilReset,
        },
        estimatedCost: `~$${(rateLimitData.globalDaily.count * 0.025).toFixed(2)} today`,
        status: usagePercent >= 100 ? 'LIMIT_REACHED' : usagePercent >= 80 ? 'WARNING' : 'OK',
    });
}
