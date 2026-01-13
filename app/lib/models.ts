// Available models - ordered by capability (best first)
// Updated January 2026
export const AVAILABLE_MODELS = [
    // Gemini 3 series (latest, Jan 2026) - fast and capable
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Fastest frontier model, 78% SWE-bench', provider: 'google' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast (372 tok/s), reliable', provider: 'google' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '1M context, native tools', provider: 'google' },
    // GPT-5.2 series (Dec 2025)
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', description: 'Most capable OpenAI model', provider: 'openai' },
    { id: 'gpt-5.2', name: 'GPT-5.2', description: '400K context', provider: 'openai' },
    // Other GPT models
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Best for coding, 1M context', provider: 'openai' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, general purpose', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable', provider: 'openai' },
] as const;

export const DEFAULT_MODEL = 'gemini-3-flash';

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
export type ModelProvider = 'openai' | 'google';
