import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, $getNodeByKey } from 'lexical';
import { CodeNode } from '@lexical/code';
import { createPortal } from 'react-dom';
import { Check, Copy, CornerDownLeft } from 'lucide-react';
import { $createParagraphNode } from 'lexical';

export default function CodeActionMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [activeCodeDOM, setActiveCodeDOM] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    const handleEvent = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!target) return;
      
      const rootEl = editor.getRootElement();
      if (!rootEl?.contains(target)) return;

      editor.getEditorState().read(() => {
        const node = $getNearestNodeFromDOMNode(target);
        let codeNode: CodeNode | null = null;
        
        if (node instanceof CodeNode) {
          codeNode = node;
        } else if (node?.getParent() instanceof CodeNode) {
          codeNode = node.getParent() as CodeNode;
        }

        if (codeNode) {
          const dom = editor.getElementByKey(codeNode.getKey());
          if (dom) {
            setActiveCodeDOM(dom);
            
            // Calculate and set line numbers
            const text = codeNode.getTextContent();
            const lineCount = (text.match(/\n/g) || []).length + 1;
            let gutter = '';
            for (let i = 1; i <= lineCount; i++) gutter += i + '\n';
            dom.setAttribute('data-gutter', gutter);
          }
        }
      }, { editor });
    };

    document.addEventListener('mouseover', handleEvent);
    document.addEventListener('touchstart', handleEvent);
    return () => {
      document.removeEventListener('mouseover', handleEvent);
      document.removeEventListener('touchstart', handleEvent);
    };
  }, [editor]);

  if (!activeCodeDOM) return null;

  return <CodeActionMenu element={activeCodeDOM} editor={editor} onClose={() => setActiveCodeDOM(null)} />;
}

function CodeActionMenu({ element, editor, onClose }: { element: HTMLElement, editor: any, onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState('text');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [bottomPosition, setBottomPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      onClose();
      return;
    }
    setPosition({
      top: rect.top + 8,
      left: rect.right - 100, // Approximate width of the button + language
    });
    setBottomPosition({
      top: rect.bottom - 30, // Position within bottom padding
      left: rect.left + 16, // Align with line numbers
    });
  }, [element, onClose]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      const node = $getNearestNodeFromDOMNode(element);
      let codeNode: CodeNode | null = null;
      if (node instanceof CodeNode) codeNode = node;
      else if (node?.getParent() instanceof CodeNode) codeNode = node.getParent() as CodeNode;
      
      if (codeNode && codeNode.getLanguage) {
        setLanguage(codeNode.getLanguage() || 'text');
      }
    }, { editor });
  }, [editor, element]);

  const handleCopy = () => {
    editor.getEditorState().read(() => {
      const node = $getNearestNodeFromDOMNode(element);
      let codeNode: CodeNode | null = null;
      if (node instanceof CodeNode) codeNode = node;
      else if (node?.getParent() instanceof CodeNode) codeNode = node.getParent() as CodeNode;
      
      if (codeNode) {
        // Also update gutter here just in case text changed while hovering
        const text = codeNode.getTextContent();
        const lineCount = (text.match(/\n/g) || []).length + 1;
        let gutter = '';
        for (let i = 1; i <= lineCount; i++) gutter += i + '\n';
        element.setAttribute('data-gutter', gutter);
        
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, { editor });
  };

  const handleExitCodeBlock = () => {
    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(element);
      let codeNode: CodeNode | null = null;
      if (node instanceof CodeNode) codeNode = node;
      else if (node?.getParent() instanceof CodeNode) codeNode = node.getParent() as CodeNode;
      
      if (codeNode) {
        const p = $createParagraphNode();
        codeNode.insertAfter(p);
        p.select();
      }
    });
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const bottomMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!element.contains(target) 
          && (!menuRef.current || !menuRef.current.contains(target))
          && (!bottomMenuRef.current || !bottomMenuRef.current.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousemove', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousemove', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [element, onClose]);

  return (
    <>
      {createPortal(
        <div 
          ref={menuRef}
          contentEditable={false} 
          className="fixed z-[100000] flex items-center justify-end gap-3 select-none min-w-[100px]" 
          style={{ 
            top: position.top, 
            left: position.left - 12, // adjust for padding 
            userSelect: 'none' 
          }}
        >
          <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider bg-[#1e1e1e] px-1">{language}</span>
          <button 
            onClick={handleCopy}
            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-md transition-colors shadow-sm"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>,
        document.body
      )}

      {createPortal(
        <div 
          ref={bottomMenuRef}
          contentEditable={false}
          className="fixed z-[100000] select-none"
          style={{
            top: bottomPosition.top,
            left: bottomPosition.left,
            userSelect: 'none'
          }}
        >
          <button 
            onClick={handleExitCodeBlock}
            className="w-[20px] h-[20px] flex items-center justify-center bg-white/5 hover:bg-white/20 text-white/30 hover:text-white rounded-sm transition-colors border border-white/10 shadow-sm"
            title="Add block below"
          >
            <CornerDownLeft size={12} />
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
