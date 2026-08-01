import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, TextFormatType, $isNodeSelection, LexicalEditor, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, BLUR_COMMAND, $createParagraphNode } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $isCodeNode, $createCodeNode } from '@lexical/code';
import { Type, Image as ImageIcon, Camera, Mic, Square, Code, CheckSquare, Minus, Link2, Smile, Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { createPortal } from 'react-dom';
import { INSERT_IMAGE_COMMAND } from './ImagePlugin';
import { INSERT_AUDIO_COMMAND } from './AudioPlugin';
import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';

export default function CursorToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCodeBlock, setIsCodeBlock] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateToolbarPosition = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!selection) {
        setShow(false);
        return;
      }

      if ($isRangeSelection(selection)) {
        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
        setIsStrikethrough(selection.hasFormat('strikethrough'));

        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : (typeof (anchorNode as any).getTopLevelElementOrThrow === 'function' 
              ? (anchorNode as any).getTopLevelElementOrThrow() 
              : (anchorNode as any).getTopLevelElement?.() || anchorNode);
        setIsCodeBlock($isCodeNode(element));
      }

      let rect: DOMRect | null = null;

      if ($isNodeSelection(selection)) {
        const nodes = selection.getNodes();
        if (nodes.length > 0) {
          const element = editor.getElementByKey(nodes[0].getKey());
          if (element) {
            rect = element.getBoundingClientRect();
          }
        }
      } else if ($isRangeSelection(selection)) {
        const nativeSelection = window.getSelection();
        if (!nativeSelection) {
          setShow(false);
          return;
        }

        if (nativeSelection.isCollapsed) {
          const text = nativeSelection.anchorNode?.textContent || '';
          if (text.trim().length > 0) {
            setShow(false);
            return;
          }
        }
        if (nativeSelection && nativeSelection.rangeCount > 0) {
          const domRange = nativeSelection.getRangeAt(0);
          rect = domRange.getBoundingClientRect();
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
        setShow(false);
        return;
      }

      // Use fixed positioning relative to viewport
      const top = rect.bottom + 8;

      const toolbarHalfWidth = 140;
      const margin = 10;

      const desiredLeft = rect.left + (rect.width / 2);
      const clampedLeft = Math.max(
        toolbarHalfWidth + margin,
        Math.min(window.innerWidth - toolbarHalfWidth - margin, desiredLeft)
      );

      setPosition({
        top: Math.max(margin, top),
        left: clampedLeft,
      });
      setShow(true);
    });
  }, [editor]);

  useEffect(() => {
    const handleSelectionChange = () => {
      // Hide immediately on interaction
      setShow(false);

      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);

      showTimeoutRef.current = setTimeout(() => {
        updateToolbarPosition();
      }, 600); // 600ms idle time
    };

    const handleScroll = () => {
      setShow(false);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('scroll', handleScroll, true);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    };
  }, [editor, updateToolbarPosition]);

  // Update on editor state changes
  useEffect(() => {
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND as any,
      () => {
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = setTimeout(() => {
          updateToolbarPosition();
        }, 600);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterSelection();
      unregisterBlur();
    };
  }, [editor, updateToolbarPosition]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file });
    }
  };

  const toggleAudioRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
        editor.dispatchCommand(INSERT_AUDIO_COMMAND, { noteId, file: audioBlob });
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const handleCodeToggle = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : (typeof (anchorNode as any).getTopLevelElementOrThrow === 'function' 
              ? (anchorNode as any).getTopLevelElementOrThrow() 
              : (anchorNode as any).getTopLevelElement?.() || anchorNode);

        if ($isCodeNode(element)) {
          // Inside a Code Block -> Convert back to normal text paragraph
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          // Explicitly convert selected block into a Code Block
          $setBlocksType(selection, () => $createCodeNode('typescript'));
        }
      }
    });
  };

  if (!show && !isRecording && !showCamera) return null;

  return createPortal(
    <>
      <div
        ref={toolbarRef}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          transform: 'translateX(-50%)',
          zIndex: 100000,
        }}
        className="flex items-center gap-1 p-1 bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.18)] border border-black/10 dark:border-white/15 transition-opacity duration-300"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); formatText('bold'); }}
          className={`p-2 rounded-full transition-colors ${isBold ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); formatText('italic'); }}
          className={`p-2 rounded-full transition-colors ${isItalic ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); formatText('underline'); }}
          className={`p-2 rounded-full transition-colors ${isUnderline ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
          title="Underline (Ctrl+U)"
        >
          <Underline size={15} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); formatText('strikethrough'); }}
          className={`p-2 rounded-full transition-colors ${isStrikethrough ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleCodeToggle(); }}
          className={`p-2 rounded-full transition-colors ${isCodeBlock ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
          title="Code Block"
        >
          <Code size={15} />
        </button>

        <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5" />

        <button onClick={(e) => { e.stopPropagation(); imageUploadRef.current?.click(); }} className="p-2 rounded-full transition-colors text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white" title="Upload Image">
          <ImageIcon size={16} />
        </button>
        <input type="file" accept="image/*" ref={imageUploadRef} className="absolute opacity-0 w-px h-px overflow-hidden" onChange={handleImageUpload} tabIndex={-1} />

        <button onClick={(e) => { e.stopPropagation(); setShowCamera(true); }} className="p-2 rounded-full transition-colors text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white" title="Camera">
          <Camera size={16} />
        </button>

        <button onClick={(e) => { e.stopPropagation(); toggleAudioRecording(); }} className={`p-2 rounded-full transition-colors ${isRecording ? 'bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`} title={isRecording ? "Stop Recording" : "Record Audio"}>
          {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
        </button>
      </div>

      {showCamera && <CameraCaptureModal
        onClose={() => setShowCamera(false)}
        onCapture={(file) => {
          const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
          if (file.type.startsWith('image/')) {
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file });
          } else {
            editor.dispatchCommand(INSERT_AUDIO_COMMAND, { noteId, file });
          }
        }}
      />}
    </>,
    document.body
  );
}
