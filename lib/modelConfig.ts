export type ModelConfig = {
    contextWindow: number;
    tokenSafetyMargin: number;
    maxChunkSize: number;
    reservedCompletionTokens: number;
  };
  
  export const MODEL_TOKEN_LIMITS: Record<string, ModelConfig> = {
    // DeepSeek models (adjust according to actual limits)
    'deepseek:deepseek-chat': {
      contextWindow: 32768,
      tokenSafetyMargin: 1024,
      maxChunkSize: 4000,
      reservedCompletionTokens: 8000
    },
    'deepseek:deepseek-reasoner': {
      contextWindow: 32768,
      tokenSafetyMargin: 1024,
      maxChunkSize: 4000,
      reservedCompletionTokens: 8000
    },
    // Add other models as needed
    'gpt-4': {
      contextWindow: 8192,
      tokenSafetyMargin: 512,
      maxChunkSize: 2000,
      reservedCompletionTokens: 8000
    }
  };
  
  export function getModelConfig(model: string): ModelConfig {
    const defaultConfig: ModelConfig = {
      contextWindow: 4000,
      tokenSafetyMargin: 256,
      maxChunkSize: 2000,
      reservedCompletionTokens: 800
    };
    
    return MODEL_TOKEN_LIMITS[model] || defaultConfig;
  }