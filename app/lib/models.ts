// Available OpenAI models - ordered by capability (best first)
// Updated December 2025 - using actual OpenAI API model IDs
export const AVAILABLE_MODELS = [
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Best for coding, 1M context' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast & affordable' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Fastest, cheapest' },
    { id: 'o3', name: 'o3', description: 'Best reasoning' },
    { id: 'o3-mini', name: 'o3-mini', description: 'Fast reasoning' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, general purpose' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast multimodal' },
] as const;

export const DEFAULT_MODEL = 'gpt-4o';

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
