export type CommandHandler = (args?: any[]) => void;

export interface VoiceCommand {
  phrases: string[];
  execute: CommandHandler;
  description?: string;
}

class Registry {
  private commands: VoiceCommand[] = [];

  register(command: VoiceCommand) {
    this.commands.push(command);
  }

  getCommands() {
    return this.commands;
  }

  getAnnyangCommands(): Record<string, (...args: any[]) => void> {
    const annyangCommands: Record<string, (...args: any[]) => void> = {};
    
    this.commands.forEach((cmd) => {
      cmd.phrases.forEach((phrase) => {
        annyangCommands[phrase] = (...args: any[]) => {
          // annyang passes arguments for wildcards, etc.
          cmd.execute(args);
        };
      });
    });

    return annyangCommands;
  }

  clear() {
    this.commands = [];
  }
}

export const CommandRegistry = new Registry();
