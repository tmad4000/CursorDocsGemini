// Available OpenAI models - ordered by capability (best first)
// Updated December 2025
export const AVAILABLE_MODELS = [
    { id: 'o3', name: 'o3 (Most Capable)', description: 'Best reasoning, complex tasks' },
    { id: 'o4-mini', name: 'o4-mini', description: 'Fast reasoning, excellent math/coding' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Coding specialist, 1M context' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast, efficient, good coding' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'General purpose, multimodal' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
] as const;

export const DEFAULT_MODEL = 'o4-mini';

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
