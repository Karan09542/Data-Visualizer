import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $nodesOfType } from 'lexical';
import { CodeNode } from '@lexical/code';

export default function CodeGutterPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updateGutters = () => {
      editor.getEditorState().read(() => {
        const codeNodes = $nodesOfType(CodeNode);
        for (const node of codeNodes) {
          const dom = editor.getElementByKey(node.getKey());
          if (dom) {
            const text = node.getTextContent();
            const lineCount = (text.match(/\n/g) || []).length + 1;
            let gutter = '';
            for (let i = 1; i <= lineCount; i++) gutter += i + '\n';
            if (dom.getAttribute('data-gutter') !== gutter) {
              dom.setAttribute('data-gutter', gutter);
            }
          }
        }
      }, { editor });
    };

    // Run once on mount
    updateGutters();

    // Run on every update
    return editor.registerUpdateListener(() => {
      updateGutters();
    });
  }, [editor]);

  return null;
}
