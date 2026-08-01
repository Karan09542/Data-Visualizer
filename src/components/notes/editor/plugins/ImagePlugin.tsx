import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_HIGH, createCommand, LexicalCommand, PASTE_COMMAND, DROP_COMMAND } from 'lexical';
import { useEffect } from 'react';
import { $createImageNode, ImageNode } from '../nodes/ImageNode';
import { MediaStore } from '../../storage/MediaStore';

export const INSERT_IMAGE_COMMAND: LexicalCommand<{ noteId: string, file: File }> = createCommand('INSERT_IMAGE_COMMAND');

export default function ImagePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImagePlugin: ImageNode not registered on editor');
    }

    const unregisterCommand = editor.registerCommand<{ noteId: string, file: File }>(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const { noteId, file } = payload;
        
        MediaStore.saveMedia(noteId, file.type, file).then(mediaId => {
          editor.update(() => {
            const imageNode = $createImageNode({
              mediaId,
              altText: file.name,
              maxWidth: 500,
            });
            $insertNodes([imageNode]);
          });
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    const handleFilePasteDrop = (files: Array<File> | FileList | undefined | null) => {
      if (!files) return false;
      const fileArray = Array.from(files);
      const imageFile = fileArray.find(file => file.type.startsWith('image/'));
      if (imageFile) {
        const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file: imageFile });
        return true;
      }
      return false;
    };

    const unregisterPaste = editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        if (event.clipboardData && event.clipboardData.files.length > 0) {
          return handleFilePasteDrop(event.clipboardData.files);
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );

    const unregisterDrop = editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
          return handleFilePasteDrop(event.dataTransfer.files);
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      unregisterCommand();
      unregisterPaste();
      unregisterDrop();
    };
  }, [editor]);

  return null;
}
