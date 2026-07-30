export interface AITool {
  id: string;
  name: string;
  description: string;
  inputSchema: any; // JSON schema for input
  outputSchema?: any; // JSON schema for output
  execute: (input: any) => Promise<any>;
}

export class ToolRegistry {
  private tools = new Map<string, AITool>();

  registerTool(tool: AITool) {
    this.tools.set(tool.id, tool);
  }

  getTool(id: string): AITool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(id: string, input: any): Promise<any> {
    const tool = this.getTool(id);
    if (!tool) throw new Error(`Tool ${id} not found`);
    
    // In a full implementation, validate input against inputSchema here
    
    return await tool.execute(input);
  }
}

export const toolRegistry = new ToolRegistry();
