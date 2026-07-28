import { useEffect } from "react";
import { VoiceManager } from "./VoiceManager";
import { registerAllVoiceCommands } from "./VoiceCommands";
import { useVoiceStore } from "./useVoiceStore";

export const useVoice = () => {
  const isVoiceEnabled = useVoiceStore((state) => state.isVoiceEnabled);

  useEffect(() => {
    registerAllVoiceCommands();
    // Do not start automatically, let user click the mic
    // VoiceManager.init(); is called within VoiceManager.start()

    return () => {
      VoiceManager.stop();
    };
  }, []);

  useEffect(() => {
    if (!isVoiceEnabled) {
      VoiceManager.stop();
    }
  }, [isVoiceEnabled]);

  return { VoiceManager };
};
