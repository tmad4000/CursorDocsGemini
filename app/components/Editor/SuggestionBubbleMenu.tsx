import React from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Editor } from '@tiptap/core';
import { Check, X } from 'lucide-react';
import styles from './SuggestionBubbleMenu.module.css';
import { useSuggestionActions } from '@/components/Editor/hooks/useSuggestionActions';

interface SuggestionBubbleMenuProps {
    editor: Editor | null;
}

export default function SuggestionBubbleMenu({ editor }: SuggestionBubbleMenuProps) {
    if (!editor) {
        return null;
    }

    const { acceptSuggestion, rejectSuggestion } = useSuggestionActions(editor);

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({ editor }: { editor: Editor }) => {
                return editor.isActive('insertion') || editor.isActive('deletion');
            }}
            className={styles.bubbleMenu}
        >
            <button
                onClick={() => acceptSuggestion()}
                onMouseDown={(e) => e.preventDefault()}
                className={styles.acceptButton}
                aria-label="Accept change"
                title="Accept change"
            >
                <Check size={16} />
                <span>Accept</span>
            </button>
            <button
                onClick={() => rejectSuggestion()}
                onMouseDown={(e) => e.preventDefault()}
                className={styles.rejectButton}
                aria-label="Reject change"
                title="Reject change"
            >
                <X size={16} />
                <span>Reject</span>
            </button>
        </BubbleMenu>
    );
}

