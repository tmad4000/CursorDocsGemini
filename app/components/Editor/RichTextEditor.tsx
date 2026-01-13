"use client";

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import Link from '@tiptap/extension-link';
import EditorToolbar from './EditorToolbar';
import styles from './RichTextEditor.module.css';
import { useEditorContext } from '@/context/EditorContext';
import { Insertion, Deletion } from './extensions/Suggestions';
import SuggestionBubbleMenu from './SuggestionBubbleMenu';
import SelectionBubbleMenu from './SelectionBubbleMenu';

export type EditorWidth = 'compact' | 'default' | 'wide' | 'full';
export type EditorPane = 'notes' | 'final';

const DEFAULT_CONTENT = `
<h1>The Future of Writing</h1>
<p>
  Writing is no longer a solitary activity. With the power of <strong>Artificial Intelligence</strong>, we can iterate faster, write better, and communicate more effectively.
</p>
<p>
  This document is an example of a "Cursor-like" experience for editing.
  You can use the sidebar to ask the AI to rewrite sections, fix grammar, or even change the tone of the entire document.
</p>
<blockquote>
  "The best editor is the one that's always available."
</blockquote>
<ul>
  <li>Try asking the AI to "make the first paragraph exciting".</li>
  <li>Or "change the quote to something about technology".</li>
</ul>
`;

const DEFAULT_NOTES_CONTENT = `
<h2>Notes & Scratch</h2>
<p>Use this space for:</p>
<ul>
  <li>Research and reference material</li>
  <li>Rough outlines and ideas</li>
  <li>Content you might want to move to the final doc</li>
</ul>
<p>Tell the AI things like "expand the outline into the final doc" or "incorporate these notes".</p>
`;

const STORAGE_KEY_FINAL = 'ai-docs-document';
const STORAGE_KEY_NOTES = 'ai-docs-notes';

// Load saved content from localStorage
function getInitialContent(pane: EditorPane): string {
  if (typeof window === 'undefined') {
    return pane === 'notes' ? DEFAULT_NOTES_CONTENT : DEFAULT_CONTENT;
  }
  try {
    const key = pane === 'notes' ? STORAGE_KEY_NOTES : STORAGE_KEY_FINAL;
    const saved = localStorage.getItem(key);
    if (saved && saved.trim().length > 10) return saved;
  } catch { /* ignore */ }
  return pane === 'notes' ? DEFAULT_NOTES_CONTENT : DEFAULT_CONTENT;
}

// Debounced save to localStorage - use a map for multiple editors
const saveTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
function saveContent(html: string, pane: EditorPane) {
  if (typeof window === 'undefined') return;
  const key = pane === 'notes' ? STORAGE_KEY_NOTES : STORAGE_KEY_FINAL;

  const existing = saveTimeouts.get(key);
  if (existing) clearTimeout(existing);

  saveTimeouts.set(key, setTimeout(() => {
    try {
      localStorage.setItem(key, html);
    } catch { /* ignore quota errors */ }
  }, 500)); // Debounce 500ms
}

interface RichTextEditorProps {
  pane?: EditorPane;
}

export default function RichTextEditor({ pane = 'final' }: RichTextEditorProps) {
  const { setNotesEditor, setFinalEditor } = useEditorContext();
  const [editorWidth, setEditorWidth] = useState<EditorWidth>('default');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      Insertion,
      Deletion,
      BubbleMenuExtension,
    ],
    content: getInitialContent(pane),
    editorProps: {
      attributes: {
        class: styles.tiptapEditor,
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Auto-save document content to localStorage
      saveContent(editor.getHTML(), pane);
    },
  });

  useEffect(() => {
    if (pane === 'notes') {
      setNotesEditor(editor);
    } else {
      setFinalEditor(editor);
    }
  }, [editor, pane, setNotesEditor, setFinalEditor]);

  const containerClass = `${styles.editorContainer}${editorWidth !== 'default' ? ` ${styles[editorWidth]}` : ''}`;

  return (
    <div className={containerClass}>
      <EditorToolbar editor={editor} editorWidth={editorWidth} setEditorWidth={setEditorWidth} />
      <SuggestionBubbleMenu editor={editor} />
      <SelectionBubbleMenu editor={editor} />
      <EditorContent editor={editor} className={styles.contentArea} />
    </div>
  );
}
