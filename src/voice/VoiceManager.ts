import annyang from "annyang";
import { CommandRegistry } from "./CommandRegistry";
import { useVoiceStore } from "./useVoiceStore";

class Manager {
  private isInitialized = false;

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
    });

    annyang.addCallback('errorNetwork', (err: any) => {
      useVoiceStore.getState().setState("error");
      useVoiceStore.getState().setErrorMessage("Network error occurred.");
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
      useVoiceStore.getState().setLastCommand(userSaid);
      useVoiceStore.getState().setState("success");
      
      // Briefly show success before returning to listening or idle
      setTimeout(() => {
        if (annyang && annyang.isListening()) {
          useVoiceStore.getState().setState("listening");
        } else {
          useVoiceStore.getState().setState("idle");
        }
      }, 2000);
    });

    annyang.addCallback('resultNoMatch', (phrases: string[]) => {
      if (phrases && phrases.length > 0) {
        // Speech recognition sometimes includes punctuation (e.g., "Zoom in.")
        // Let's strip it and retry matching manually
        const original = phrases[0];
        const cleaned = original.replace(/[.,!?]/g, '').trim();
        
        // If stripping punctuation actually changed the string, retry matching once
        if (cleaned && cleaned !== original) {
          // trigger will run through resultMatch or resultNoMatch again
          annyang.trigger(cleaned);
          return;
        }

        useVoiceStore.getState().setLastCommand(`Unrecognized: "${original}"`);
      }
      useVoiceStore.getState().setState("error");
      setTimeout(() => {
        if (annyang && annyang.isListening()) {
          useVoiceStore.getState().setState("listening");
        } else {
          useVoiceStore.getState().setState("idle");
        }
      }, 2000);
    });
  }

  start() {
    if (annyang) {
      if (!this.isInitialized) {
        this.init();
      }
      annyang.start({ autoRestart: true, continuous: false });
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
    if (useVoiceStore.getState().state === "listening") {
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
