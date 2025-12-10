import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, List, ListOrdered, Quote } from 'lucide-react';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
    editor: Editor | null;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
    if (!editor) {
        return null;
    }

    return (
        <div className={styles.toolbar}>
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? styles.active : ''}
            >
                <Bold size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? styles.active : ''}
            >
                <Italic size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? styles.active : ''}
            >
                <Strikethrough size={18} />
            </button>
            <div className={styles.divider} />
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? styles.active : ''}
            >
                <Heading1 size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? styles.active : ''}
            >
                <Heading2 size={18} />
            </button>
            <div className={styles.divider} />
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? styles.active : ''}
            >
                <List size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? styles.active : ''}
            >
                <ListOrdered size={18} />
            </button>
            <div className={styles.divider} />
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? styles.active : ''}
            >
                <Quote size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? styles.active : ''}
            >
                <Code size={18} />
            </button>

            <div className={styles.divider} />
            <button
                className={styles.acceptButton}
                onClick={() => {
                    // Primitive accept: remove deletions, keep insertions (rm class)
                    // This requires a custom extension or DOM manipulation.
                    // For now, we will just use basic regex on HTML (hacky but works for demo)
                    const html = editor.getHTML();
                    const accepted = html
                        .replace(/<span class="suggestion-deletion">.*?<\/span>/g, '')
                        .replace(/<span class="suggestion-insertion">(.*?)<\/span>/g, '$1');
                    editor.commands.setContent(accepted);
                }}
            >
                Accept
            </button>
            <button
                className={styles.rejectButton}
                onClick={() => {
                    // Primitive reject: remove insertions, keep deletions text (rm tags)
                    const html = editor.getHTML();
                    const rejected = html
                        .replace(/<span class="suggestion-insertion">.*?<\/span>/g, '')
                        .replace(/<span class="suggestion-deletion">(.*?)<\/span>/g, '$1');
                    editor.commands.setContent(rejected);
                }}
            >
                Reject
            </button>
        </div>
    );
}
