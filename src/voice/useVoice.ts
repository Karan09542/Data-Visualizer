import { useEffect } from "react";
import { VoiceManager } from "./VoiceManager";
import { registerAllVoiceCommands } from "./VoiceCommands";

export const useVoice = () => {
  useEffect(() => {
    registerAllVoiceCommands();
    // Do not start automatically, let user click the mic
    // VoiceManager.init(); is called within VoiceManager.start()

    return () => {
      VoiceManager.stop();
    };
  }, []);

  return { VoiceManager };
};
