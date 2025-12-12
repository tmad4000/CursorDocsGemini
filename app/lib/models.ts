// Available models - ordered by capability (best first)
// Updated December 2025
export const AVAILABLE_MODELS = [
    // GPT-5.2 series (latest, Dec 2025)
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', description: 'Most capable, highest accuracy', provider: 'openai' },
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Latest model, 400K context', provider: 'openai' },
    // Fast alternatives
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fastest (372 tok/s)', provider: 'google' },
    // Other GPT models
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Best for coding, 1M context', provider: 'openai' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, general purpose', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable', provider: 'openai' },
] as const;

export const DEFAULT_MODEL = 'gpt-5.2';

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
export type ModelProvider = 'openai' | 'google';
