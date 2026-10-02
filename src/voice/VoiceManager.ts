import annyang from "annyang";
import { CommandRegistry, type VoiceCommand } from "./CommandRegistry";
import { useVoiceStore } from "./useVoiceStore";
import { matchCommand, prepare as prepareMatcher } from "./semantic/SemanticMatcher";
import { findLeadIn, findOption } from "./semantic/intentMatcher";

/** How long a command said without its argument ("search") waits for the next sentence to supply it. */
const ARGUMENT_WAIT_MS = 10000;

/** What a wildcard asks for, for the "say the …" prompt. */
const ARGUMENT_NAMES: Record<string, string> = {
  node: "node name",
  query: "search term",
  format: "format (png, jpeg, webp or svg)",
  fmt: "format (json or yaml)",
  edge: "edge style",
  args: "direction",
};

/** How a matched command reads in the toast: the phrase with its argument filled in. */
const describe = (command: VoiceCommand, phrase: string, args: string[]) => {
  // An example ("get closer") isn't something to teach; show the command's own phrase instead.
  const shown = command.phrases.includes(phrase) ? phrase : command.phrases.find((p) => !p.includes("*")) ?? command.phrases[0];
  return shown.replace(/\*\w+/, args[0] ?? "").replace(/\s+/g, " ").trim();
};

class Manager {
  private isInitialized = false;
  /** A command said without its argument, waiting for the next sentence to supply it. */
  private awaiting: { command: VoiceCommand; phrase: string; until: number } | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Shows the outcome briefly, then goes back to listening (or idle if listening stopped). */
  private settle(outcome: "success" | "error") {
    useVoiceStore.getState().setState(outcome);
    // A newer outcome gets its full two seconds, not what was left of the previous one's.
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (annyang && annyang.isListening()) {
        useVoiceStore.getState().setState("listening");
      } else {
        useVoiceStore.getState().setState("idle");
      }
    }, 2000);
  }

  /**
   * annyang found no exact phrase: match what was heard by meaning instead, across every
   * alternative the recognizer offered ("hit center" may come with "fit center").
   */
  private async matchByMeaning(phrases: string[]) {
    const store = useVoiceStore.getState();
    const heard = phrases[0];

    if (store.smartMatching && store.matcherStatus === "ready") {
      store.setState("processing");
      store.setErrorMessage(null);
      const result = await matchCommand(phrases).catch((e) => {
        console.error("Voice matcher error:", e);
        return null;
      });

      if (result?.match) {
        const { command, phrase, args } = result.match;
        store.setFeedback({ kind: "ran", heard, command: describe(command, phrase, args), byMeaning: true });
        command.execute(args, phrase);
        this.settle("success");
        return;
      }
      if (result?.candidates.length) {
        const options = result.candidates.slice(0, 3).map((m) => describe(m.command, m.phrase, m.args));
        store.setFeedback({ kind: "ambiguous", heard, options });
        this.settle("error");
        return;
      }
    }

    store.setFeedback({ kind: "unrecognized", heard });
    this.settle("error");
  }

  /**
   * Handles a sentence that is (or completes) a command said in two parts. The recognizer ends a
   * sentence at the first pause, so "search … users" arrives as "search", then "users".
   */
  private completeInTwoParts(phrases: string[]): boolean {
    const store = useVoiceStore.getState();
    const heard = phrases[0];

    if (this.awaiting && Date.now() < this.awaiting.until) {
      const { command, phrase } = this.awaiting;
      this.awaiting = null;
      const value = command.options ? phrases.map((p) => findOption(p, command.options!)).find(Boolean) ?? heard : heard;
      store.setFeedback({ kind: "ran", heard, command: describe(command, phrase, [value]), byMeaning: false });
      command.execute([value], phrase);
      this.settle("success");
      return true;
    }
    this.awaiting = null;

    const leadIn = findLeadIn(phrases, CommandRegistry.getCommands());
    if (!leadIn) return false;
    this.awaiting = { ...leadIn, until: Date.now() + ARGUMENT_WAIT_MS };
    const name = leadIn.phrase.match(/\*(\w+)/)![1];
    store.setFeedback({ kind: "awaiting", heard, wants: ARGUMENT_NAMES[name] ?? name });
    store.setErrorMessage(null);
    store.setState("listening");
    return true;
  }

  init() {
    if (this.isInitialized || !annyang) return;
    this.isInitialized = true;

    // Add commands from registry
    annyang.addCommands(CommandRegistry.getAnnyangCommands());

    // Callbacks
    annyang.addCallback('start', () => {
      useVoiceStore.getState().setState("listening");
      useVoiceStore.getState().setErrorMessage(null);
    });

    annyang.addCallback('error', (err: any) => {
      // Not failures: "aborted" is our own stop(), and "no-speech" is a quiet moment that
      // annyang's autoRestart listens through.
      if (err && (err.error === 'aborted' || err.error === 'no-speech')) return;
      let msg = "Speech recognition error";
      if (err) {
        if (typeof err === 'string') msg = err;
        else if (typeof err.error === 'string') msg = err.error;
        else if (err.message) msg = err.message;
        else if (err.type) msg = `Error type: ${err.type}`;
      }
      console.error("Annyang error:", err, msg);
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage(msg);

      if (err && err.error === 'network') {
        if (annyang) annyang.abort();
      }
    });

    annyang.addCallback('errorNetwork', (err: any) => {
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage("Network error occurred.");
      if (annyang) annyang.abort();
    });

    annyang.addCallback('errorPermissionBlocked', () => {
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage("Microphone permission blocked.");
    });

    annyang.addCallback('errorPermissionDenied', () => {
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage("Microphone permission denied.");
    });

    annyang.addCallback('resultMatch', (userSaid: string, commandText: string, phrases: string[]) => {
      this.awaiting = null;
      useVoiceStore.getState().setFeedback({ kind: "ran", heard: userSaid, command: userSaid, byMeaning: false });
      this.settle("success");
    });

    annyang.addCallback('resultNoMatch', (phrases: string[]) => {
      if (!phrases || phrases.length === 0) {
        this.settle("error");
        return;
      }

      // Speech recognition sometimes includes punctuation (e.g., "Zoom in.")
      // Strip it from every alternative and retry exact matching once
      const cleaned = phrases.map((p) => p.replace(/[.,!?]/g, '').trim());
      if (cleaned.some((c, i) => c !== phrases[i])) {
        // trigger will run through resultMatch or resultNoMatch again
        annyang.trigger(cleaned.filter(Boolean));
        return;
      }

      if (this.completeInTwoParts(phrases)) return;
      void this.matchByMeaning(phrases);
    });
  }

  start() {
    if (!navigator.onLine) {
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage("Network error: You are offline.");
      return;
    }

    if (annyang) {
      if (!this.isInitialized) {
        this.init();
      }
      useVoiceStore.getState().setFeedback(null); // a new session starts with a clean toast
      annyang.start({ autoRestart: true, continuous: false });
      // Downloads the matcher the first time (about 23 MB, kept in OPFS), loads it after that.
      if (useVoiceStore.getState().smartMatching) void prepareMatcher();
    } else {
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage("Speech recognition not supported in this browser.");
    }
  }

  stop() {
    if (annyang) {
      annyang.abort();
      useVoiceStore.getState().setState("idle");
    }
  }

  toggle() {
    // Not the displayed state: it reads "processing" or "success" for a moment while still listening.
    if (annyang && annyang.isListening()) {
      this.stop();
    } else {
      this.start();
    }
  }

  isSupported() {
    return !!annyang;
  }
}

export const VoiceManager = new Manager();
