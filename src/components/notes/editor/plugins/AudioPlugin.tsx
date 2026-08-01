import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import { useEffect } from 'react';
import { $createAudioNode, AudioNode } from '../nodes/AudioNode';
import { MediaStore } from '../../storage/MediaStore';

export const INSERT_AUDIO_COMMAND: LexicalCommand<{ noteId: string, file: Blob }> = createCommand('INSERT_AUDIO_COMMAND');

export default function AudioPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([AudioNode])) {
      throw new Error('AudioPlugin: AudioNode not registered on editor');
    }

    const unregisterCommand = editor.registerCommand<{ noteId: string, file: Blob }>(
      INSERT_AUDIO_COMMAND,
      (payload) => {
        const { noteId, file } = payload;
        
        MediaStore.saveMedia(noteId, file.type, file).then(mediaId => {
          editor.update(() => {
            const audioNode = $createAudioNode(mediaId);
            $insertNodes([audioNode]);
          });
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      unregisterCommand();
    };
  }, [editor]);

  return null;
}
