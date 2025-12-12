import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models';

// Lazy initialization to avoid errors during static export
let openai: OpenAI | null = null;
let gemini: GoogleGenerativeAI | null = null;

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

function getGemini(): GoogleGenerativeAI {
    if (!gemini) {
        if (!process.env.GOOGLE_AI_API_KEY) {
            throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
        }
        gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
    return gemini;
}

// Tool definitions for function calling
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'fetch_url',
            description: 'Fetch content from a URL. Use this to get information from web pages when the user asks about external content or needs current information.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The URL to fetch content from'
                    }
                },
                required: ['url']
            }
        }
    }
];

// Execute the fetch_url tool
async function executeFetchUrl(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AIDocsEditor/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            return `Error fetching URL: ${response.status} ${response.statusText}`;
        }

        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        // For HTML, try to extract meaningful content
        if (contentType.includes('text/html')) {
            // Simple HTML to text conversion - strip tags and limit length
            const stripped = text
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return stripped.slice(0, 8000); // Limit to ~8K chars
        }

        return text.slice(0, 8000);
    } catch (error) {
        return `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
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

        // Validate model and get provider
        const modelConfig = AVAILABLE_MODELS.find(m => m.id === model);
        const selectedModel = modelConfig ? model : DEFAULT_MODEL;
        const provider = modelConfig?.provider || 'openai';

        const systemPrompt = "You are a helpful AI writing assistant. You can help users refine their documents. Keep your answers concise and helpful. You have access to a fetch_url tool to retrieve content from web pages when needed.";

        let reply: string | null = null;

        if (provider === 'google') {
            // Use Gemini
            const genAI = getGemini();
            const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

            // Convert messages to Gemini format
            const geminiHistory = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const lastMessage = messages[messages.length - 1];
            const chat = geminiModel.startChat({
                history: geminiHistory.length > 0 ? geminiHistory : undefined,
                systemInstruction: systemPrompt,
            });

            const result = await chat.sendMessage(lastMessage.content);
            reply = result.response.text();
        } else {
            // Use OpenAI with tool support
            const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: "system", content: systemPrompt },
                ...messages
            ];

            let completion = await getOpenAI().chat.completions.create({
                model: selectedModel,
                messages: openaiMessages,
                tools: tools,
                tool_choice: 'auto',
            });

            // Handle tool calls
            let responseMessage = completion.choices[0].message;
            while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                // Add assistant's message with tool calls
                openaiMessages.push(responseMessage);

                // Process each tool call
                for (const toolCall of responseMessage.tool_calls) {
                    if (toolCall.type === 'function' && toolCall.function.name === 'fetch_url') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const urlContent = await executeFetchUrl(args.url);
                        openaiMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: urlContent,
                        });
                    }
                }

                // Get the next response
                completion = await getOpenAI().chat.completions.create({
                    model: selectedModel,
                    messages: openaiMessages,
                    tools: tools,
                    tool_choice: 'auto',
                });
                responseMessage = completion.choices[0].message;
            }

            reply = responseMessage.content;
        }

        // Include warning in response if applicable
        const response: { reply: string | null; warning?: string } = { reply };
        if (rateCheck.warning) {
            response.warning = rateCheck.warning;
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
