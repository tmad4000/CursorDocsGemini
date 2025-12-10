import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages, model = DEFAULT_MODEL } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Validate model
        const validModels = AVAILABLE_MODELS.map(m => m.id);
        const selectedModel = validModels.includes(model) ? model : DEFAULT_MODEL;

        const completion = await openai.chat.completions.create({
            model: selectedModel,
            messages: [
                { role: "system", content: "You are a helpful AI writing assistant. You can help users refine their documents. Keep your answers concise and helpful." },
                ...messages
            ],
        });

        const reply = completion.choices[0].message.content;

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
