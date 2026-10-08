import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $isRootNode,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
} from 'lexical';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { $createYouTubeNode, YouTubeNode, YouTubeSize } from '../nodes/YouTubeNode';

export const INSERT_YOUTUBE_COMMAND: LexicalCommand<{
  videoId: string;
  url?: string;
  size?: YouTubeSize;
}> = createCommand('INSERT_YOUTUBE_COMMAND');

export default function YouTubePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([YouTubeNode])) {
      throw new Error('YouTubePlugin: YouTubeNode not registered on editor');
    }

    const unregisterCommand = editor.registerCommand(
      INSERT_YOUTUBE_COMMAND,
      (payload) => {
        const { videoId, url, size = 'full' } = payload;
        const youtubeNode = $createYouTubeNode({ videoId, url, size });

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const topBlock = anchorNode.getTopLevelElement();
          if (
            topBlock &&
            topBlock.getTextContent().trim() === selection.getTextContent().trim()
          ) {
            topBlock.replace(youtubeNode);
          } else {
            $insertNodes([youtubeNode]);
          }
        } else {
          $insertNodeToNearestRoot(youtubeNode);
        }

        const parent = youtubeNode.getParent();
        if (parent && $isRootNode(parent)) {
          if (!youtubeNode.getNextSibling()) {
            const p = $createParagraphNode();
            youtubeNode.insertAfter(p);
          }
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    return () => {
      unregisterCommand();
    };
  }, [editor]);

  return null;
}
