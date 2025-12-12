import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, List, ListOrdered, Quote, Columns2 } from 'lucide-react';
import styles from './EditorToolbar.module.css';
import { EditorWidth } from './RichTextEditor';

interface EditorToolbarProps {
    editor: Editor | null;
    editorWidth: EditorWidth;
    setEditorWidth: (width: EditorWidth) => void;
}

const widthOptions: { value: EditorWidth; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'default', label: 'Default' },
    { value: 'wide', label: 'Wide' },
    { value: 'full', label: 'Full' },
];

export default function EditorToolbar({ editor, editorWidth, setEditorWidth }: EditorToolbarProps) {
    const [showWidthMenu, setShowWidthMenu] = useState(false);

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
            <div className={styles.widthSelector}>
                <button
                    className={styles.widthButton}
                    onClick={() => setShowWidthMenu(!showWidthMenu)}
                    title="Page width"
                >
                    <Columns2 size={18} />
                </button>
                {showWidthMenu && (
                    <div className={styles.widthMenu}>
                        {widthOptions.map((option) => (
                            <button
                                key={option.value}
                                className={`${styles.widthOption} ${editorWidth === option.value ? styles.activeWidth : ''}`}
                                onClick={() => {
                                    setEditorWidth(option.value);
                                    setShowWidthMenu(false);
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className={styles.divider} />
            <button
                className={styles.acceptButton}
                onClick={() => {
                    // Accept all: remove deletions, keep insertions (rm class)
                    // This requires a custom extension or DOM manipulation.
                    // For now, we will just use basic regex on HTML (hacky but works for demo)
                    const html = editor.getHTML();
                    const accepted = html
                        .replace(/<span class="suggestion-deletion">.*?<\/span>/g, '')
                        .replace(/<span class="suggestion-insertion">(.*?)<\/span>/g, '$1');
                    editor.commands.setContent(accepted);
                }}
            >
                Accept All
            </button>
            <button
                className={styles.rejectButton}
                onClick={() => {
                    // Reject all: remove insertions, keep deletions text (rm tags)
                    const html = editor.getHTML();
                    const rejected = html
                        .replace(/<span class="suggestion-insertion">.*?<\/span>/g, '')
                        .replace(/<span class="suggestion-deletion">(.*?)<\/span>/g, '$1');
                    editor.commands.setContent(rejected);
                }}
            >
                Reject All
            </button>
        </div>
    );
}
