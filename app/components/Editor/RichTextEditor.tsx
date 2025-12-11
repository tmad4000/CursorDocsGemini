"use client";

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import EditorToolbar from './EditorToolbar';
import styles from './RichTextEditor.module.css';
import { useEditorContext } from '@/context/EditorContext';
import { Insertion, Deletion } from './extensions/Suggestions';
import SuggestionBubbleMenu from './SuggestionBubbleMenu';
import SelectionBubbleMenu from './SelectionBubbleMenu';

const content = `
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

export default function RichTextEditor() {
  const { setEditor } = useEditorContext();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Insertion,
      Deletion,
      BubbleMenuExtension,
    ],
    content,
    editorProps: {
      attributes: {
        class: styles.tiptapEditor,
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    setEditor(editor);
  }, [editor, setEditor]);

  return (
    <div className={styles.editorContainer}>
      <EditorToolbar editor={editor} />
      <SuggestionBubbleMenu editor={editor} />
      <SelectionBubbleMenu editor={editor} />
      <EditorContent editor={editor} className={styles.contentArea} />
    </div>
  );
}
