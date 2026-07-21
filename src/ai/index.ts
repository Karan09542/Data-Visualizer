// Main API Exports
export { aiService as ai } from './services/AIService';
export { modelRegistry } from './registry/ModelRegistry';

import { registerTasks } from './tasks';
// Register tasks on the main thread so the UI knows what is available
registerTasks();

// Hook Exports
export * from './hooks';

// Type Exports
export * from './types';
