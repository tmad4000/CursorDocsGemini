import React from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { type Editor } from '@tiptap/core';
import { Check, X } from 'lucide-react';
import styles from './SuggestionBubbleMenu.module.css';

interface SuggestionBubbleMenuProps {
    editor: Editor | null;
}

export default function SuggestionBubbleMenu({ editor }: SuggestionBubbleMenuProps) {
    if (!editor) {
        return null;
    }

    // Helper to check if selection is inside an insertion or deletion
    const isInsertion = editor.isActive('insertion');
    const isDeletion = editor.isActive('deletion');

    /* BubbleMenu handles its own visibility via shouldShow */

    const handleAccept = () => {
        if (isInsertion) {
            // Accept insertion: just remove the mark, keeping the text
            editor.chain().focus().unsetMark('insertion').run();
        } else if (isDeletion) {
            // Accept deletion: delete the selection
            editor.chain().focus().deleteSelection().run();
        }
    };

    const handleReject = () => {
        if (isInsertion) {
            // Reject insertion: delete the text
            editor.chain().focus().deleteSelection().run();
        } else if (isDeletion) {
            // Reject deletion: just remove the mark, keeping the text (restoring it)
            editor.chain().focus().unsetMark('deletion').run();
        }
    };

    return (
        <BubbleMenu
            editor={editor}
            // @ts-ignore - tippyOptions is valid at runtime but missing from current type def
            tippyOptions={{ duration: 100, interactive: true }}
            shouldShow={({ editor }: { editor: Editor }) => {
                return editor.isActive('insertion') || editor.isActive('deletion');
            }}
            className={styles.bubbleMenu}
        >
            <button
                onClick={handleAccept}
                onMouseDown={(e) => e.preventDefault()}
                className={styles.acceptButton}
                aria-label="Accept Change"
            >
                <Check size={16} />
            </button>
            <button
                onClick={handleReject}
                onMouseDown={(e) => e.preventDefault()}
                className={styles.rejectButton}
                aria-label="Reject Change"
            >
                <X size={16} />
            </button>
        </BubbleMenu>
    );
}
