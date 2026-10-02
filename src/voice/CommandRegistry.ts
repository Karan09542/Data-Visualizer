/** `phrase` is the registered phrase that matched, so one command can tell "show x" from "hide x". */
export type CommandHandler = (args?: any[], phrase?: string) => void;

/** Sections of the voice help, in the order they are shown. */
export const VOICE_GROUPS = ["navigate", "view", "look", "panels", "files"] as const;
export type VoiceGroup = typeof VOICE_GROUPS[number];

export interface VoiceCommand {
  phrases: string[];
  execute: CommandHandler;
  /** For the voice help: a short name ("Go to a node"), its section, what it does, and a filled-in phrase ("go to users"). */
  title?: string;
  group?: VoiceGroup;
  description?: string;
  example?: string;
  /** Other ways of saying it, used only when matching by meaning (see semantic/intentMatcher). */
  examples?: string[];
  /** The values the phrases' wildcard must be one of, so matching by meaning can find it in a sentence. */
  options?: readonly string[];
  /** Words of which one must be said for the command to match by meaning ("youtube" for YouTube search). */
  requires?: string[];
}

class Registry {
  private commands: VoiceCommand[] = [];
  /** Bumped on every change, so anything built from the commands knows to rebuild. */
  private version = 0;

  register(command: VoiceCommand) {
    this.commands.push(command);
    this.version++;
  }

  getVersion() {
    return this.version;
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
          cmd.execute(args, phrase);
        };
      });
    });

    return annyangCommands;
  }

  clear() {
    this.commands = [];
    this.version++;
  }
}

export const CommandRegistry = new Registry();
