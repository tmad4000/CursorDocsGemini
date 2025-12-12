import React, { useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Editor } from '@tiptap/react';
import { Wand2, Edit3, ArrowRight } from 'lucide-react';
import styles from './SelectionBubbleMenu.module.css';
import { useEditorContext } from '@/context/EditorContext';

interface SelectionBubbleMenuProps {
    editor: Editor | null;
}

export default function SelectionBubbleMenu({ editor }: SelectionBubbleMenuProps) {
    const { triggerAI } = useEditorContext();
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState('');

    // Reset input state when selection is lost
    // This hook must be called before any early returns to satisfy Rules of Hooks
    React.useEffect(() => {
        if (!editor) return;

        const handleSelectionUpdate = () => {
            if (editor.state.selection.empty) {
                setShowInput(false);
            }
        };

        editor.on('selectionUpdate', handleSelectionUpdate);
        return () => {
            editor.off('selectionUpdate', handleSelectionUpdate);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    const handleImprove = () => {
        triggerAI("Make this better");
        setShowInput(false);
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        triggerAI(inputValue);
        setInputValue('');
        setShowInput(false);
    };

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="selection-menu"
            shouldShow={({ editor }) => {
                const { selection } = editor.state;
                if (selection.empty) return false;
                if (editor.isActive('insertion') || editor.isActive('deletion')) {
                    return false;
                }
                return true;
            }}
            className={styles.bubbleMenu}
        >
            {showInput ? (
                <form onSubmit={handleCustomSubmit} className={styles.inputForm}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask AI..."
                        className={styles.input}
                        autoFocus
                    />
                    <button type="submit" className={styles.submitButton}>
                        <ArrowRight size={14} />
                    </button>
                </form>
            ) : (
                <div className={styles.buttonGroup}>
                    <button
                        onClick={handleImprove}
                        onMouseDown={(e) => e.preventDefault()}
                        className={styles.actionButton}
                    >
                        <Wand2 size={16} />
                        <span>Improve</span>
                    </button>
                    <div className={styles.separator} />
                    <button
                        onClick={() => setShowInput(true)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={styles.actionButton}
                    >
                        <Edit3 size={16} />
                        <span>Edit...</span>
                    </button>
                </div>
            )}
        </BubbleMenu>
    );
}
