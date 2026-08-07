import React, { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createCommand, LexicalCommand, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { CameraCaptureModal } from '../../../CameraCaptureModal';
import { AudioCaptureModal } from '../../../AudioCaptureModal';
import { INSERT_IMAGE_COMMAND } from './ImagePlugin';
import { INSERT_AUDIO_COMMAND } from './AudioPlugin';

export const OPEN_CAMERA_MODAL_COMMAND: LexicalCommand<void> = createCommand('OPEN_CAMERA_MODAL_COMMAND');
export const OPEN_AUDIO_MODAL_COMMAND: LexicalCommand<void> = createCommand('OPEN_AUDIO_MODAL_COMMAND');

export default function MediaModalsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAudioOpen, setIsAudioOpen] = useState(false);

  useEffect(() => {
    const unregisterCamera = editor.registerCommand(
      OPEN_CAMERA_MODAL_COMMAND,
      () => {
        setIsCameraOpen(true);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    const unregisterAudio = editor.registerCommand(
      OPEN_AUDIO_MODAL_COMMAND,
      () => {
        setIsAudioOpen(true);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    return () => {
      unregisterCamera();
      unregisterAudio();
    };
  }, [editor]);

  const handleCameraCapture = (file: File) => {
    const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file });
  };

  const handleAudioCapture = (file: File) => {
    const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
    editor.dispatchCommand(INSERT_AUDIO_COMMAND, { noteId, file });
  };

  return (
    <>
      {isCameraOpen && (
        <CameraCaptureModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}
      {isAudioOpen && (
        <AudioCaptureModal
          onClose={() => setIsAudioOpen(false)}
          onCapture={handleAudioCapture}
        />
      )}
    </>
  );
}
