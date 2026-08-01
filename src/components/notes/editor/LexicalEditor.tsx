import React, { useMemo } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode as LexicalCodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { DOMConversionMap, NodeKey } from 'lexical';

import { ImageNode } from './nodes/ImageNode';
import { AudioNode } from './nodes/AudioNode';
import AutoSavePlugin from './plugins/AutoSavePlugin';
import ImagePlugin from './plugins/ImagePlugin';
import AudioPlugin from './plugins/AudioPlugin';
import CodeHighlightPlugin from './plugins/CodeHighlightPlugin';
import CursorToolbarPlugin from './plugins/CursorToolbarPlugin';
import SlashCommandPlugin from './plugins/SlashCommandPlugin';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

// Custom CodeNode subclass that overrides importDOM to return null.
// This prevents text/HTML pasted from IDEs (like VS Code) containing <pre> or <code>
// from automatically converting into a CodeNode code block in the sticky notes editor.
export class CodeNode extends LexicalCodeNode {
  static getType(): string {
    return 'code';
  }

  static clone(node: CodeNode): CodeNode {
    return new CodeNode(node.getLanguage(), node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  static importJSON(serializedNode: any): CodeNode {
    return LexicalCodeNode.importJSON(serializedNode) as CodeNode;
  }
}

interface LexicalEditorProps {
  initialContent: string;
  noteId: string;
  onSave: (content: string) => void;
  onChange?: (content: string) => void;
  isEditing: boolean;
  style?: React.CSSProperties;
}

const theme = {
  paragraph: 'mb-4 leading-relaxed',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 font-mono text-[0.85em] text-black/80 dark:text-white/80',
  },
  code: 'editor-code',
  codeHighlight: {
    atrule: 'editor-tokenAttr',
    attr: 'editor-tokenAttr',
    boolean: 'editor-tokenNumber',
    builtin: 'editor-tokenSelector',
    cdata: 'editor-tokenComment',
    char: 'editor-tokenSelector',
    class: 'editor-tokenFunction',
    'class-name': 'editor-tokenFunction',
    comment: 'editor-tokenComment',
    constant: 'editor-tokenProperty',
    deleted: 'editor-tokenProperty',
    doctype: 'editor-tokenComment',
    entity: 'editor-tokenOperator',
    function: 'editor-tokenFunction',
    important: 'editor-tokenVariable',
    inserted: 'editor-tokenSelector',
    keyword: 'editor-tokenAttr',
    namespace: 'editor-tokenVariable',
    number: 'editor-tokenNumber',
    operator: 'editor-tokenOperator',
    prolog: 'editor-tokenComment',
    property: 'editor-tokenProperty',
    punctuation: 'editor-tokenPunctuation',
    regex: 'editor-tokenVariable',
    selector: 'editor-tokenSelector',
    string: 'editor-tokenSelector',
    symbol: 'editor-tokenProperty',
    tag: 'editor-tokenProperty',
    url: 'editor-tokenOperator',
    variable: 'editor-tokenVariable',
  },
  heading: {
    h1: 'text-3xl font-extrabold mb-4 mt-8 tracking-tight text-black dark:text-white',
    h2: 'text-2xl font-bold mb-3 mt-6 tracking-tight text-black/90 dark:text-white/90',
    h3: 'text-xl font-semibold mb-2 mt-4 tracking-tight text-black/80 dark:text-white/80',
  },
  list: {
    ul: 'list-disc ml-6 mb-4 space-y-1',
    ol: 'list-decimal ml-6 mb-4 space-y-1',
    listitem: 'leading-relaxed',
    listitemChecked: 'lexical-checklist-checked',
    listitemUnchecked: 'lexical-checklist-unchecked',
  },
  quote: 'border-l-4 border-black/20 dark:border-white/20 pl-4 italic my-4 text-black/70 dark:text-white/70 bg-black/5 dark:bg-white/5 py-2 pr-4 rounded-r-lg',
} as any;

export default function LexicalEditor({ initialContent, noteId, onSave, onChange, isEditing, style }: LexicalEditorProps) {
  
  const initialConfig = useMemo(() => {
    let parsedState = null;
    try {
      if (initialContent.trim().startsWith('{') && initialContent.includes('"root"')) {
        parsedState = initialContent;
      }
    } catch (e) {
      // Not JSON
    }

    return {
      namespace: `StickyNoteEditor-${noteId}`,
      theme,
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        LinkNode,
        ImageNode,
        AudioNode,
      ],
      onError: (error: Error) => {
        console.error('Lexical Error:', error);
      },
      editorState: parsedState ? parsedState : (editor: any) => {
        // Plain text fallback initialization
        if (initialContent) {
          const root = $getRoot();
          if (root.getFirstChild() === null) {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(initialContent));
            root.append(paragraph);
          }
        }
      },
    };
  }, [initialContent, noteId]);

  return (
    <div className={`relative w-full h-full flex flex-col ${isEditing ? 'bg-black/[0.03] ring-1 ring-black/5 rounded-xl' : ''}`} style={style}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar sticky-note-scrollbar">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className={`w-full max-w-4xl mx-auto min-h-full outline-none px-6 py-8 sm:px-10 sm:py-12 ${isEditing ? 'cursor-text' : 'cursor-pointer select-none'}`} 
                style={{ 
                  ...style, 
                  pointerEvents: isEditing ? 'auto' : 'none',
                }}
              />
            }
            placeholder={
              isEditing ? (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-30 px-6 py-8 sm:px-10 sm:py-12 w-full max-w-4xl mx-auto overflow-hidden" 
                  style={style}
                >
                  Start typing or press '/' for commands...
                </div>
              ) : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          
          <AutoSavePlugin onSave={onSave} onChange={onChange} debounceMs={500} />
          <ImagePlugin />
          <AudioPlugin />
          
          {isEditing && (
            <>
              <CodeHighlightPlugin />
              <CursorToolbarPlugin />
              <SlashCommandPlugin />
            </>
          )}
        </div>
      </LexicalComposer>
    </div>
  );
}
