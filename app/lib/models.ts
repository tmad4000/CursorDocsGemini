// Available OpenAI models - ordered by capability (best first)
export const AVAILABLE_MODELS = [
    { id: 'o1', name: 'o1 (Most Capable)', description: 'Best reasoning and complex tasks' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Fast and highly capable' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation, very capable' },
] as const;

export const DEFAULT_MODEL = 'o1';

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
