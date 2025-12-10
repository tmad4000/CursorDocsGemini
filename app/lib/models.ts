// Available OpenAI models - ordered by capability (best first)
// Updated December 2025
export const AVAILABLE_MODELS = [
    { id: 'gpt-5.1', name: 'GPT-5.1 (Latest)', description: 'Most capable, adaptive reasoning' },
    { id: 'gpt-5', name: 'GPT-5', description: 'Flagship model, state-of-the-art' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast GPT-5 variant' },
    { id: 'o3', name: 'o3', description: 'Best reasoning, complex tasks' },
    { id: 'o4-mini', name: 'o4-mini', description: 'Fast reasoning, math/coding' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Coding specialist, 1M context' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'General purpose, multimodal' },
] as const;

export const DEFAULT_MODEL = 'gpt-4o';

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
