import React from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { getMarkRange, type Editor } from '@tiptap/core';
import { Check, X } from 'lucide-react';
import styles from './SuggestionBubbleMenu.module.css';

interface SuggestionBubbleMenuProps {
    editor: Editor | null;
}

export default function SuggestionBubbleMenu({ editor }: SuggestionBubbleMenuProps) {
    if (!editor) {
        return null;
    }

    type Range = { from: number; to: number };

    const selectMarkRange = (markName: string) => {
        const { state } = editor;
        const markType = state.schema.marks[markName];
        if (!markType) return null;

        const { $anchor } = state.selection;
        return getMarkRange($anchor, markType);
    };

    const removeAdjacentDeletions = (range: Range) => {
        const { state, view } = editor;
        const markType = state.schema.marks.deletion;
        if (!markType) return;

        const ranges: Range[] = [];
        const tryAddRange = (pos: number) => {
            if (pos < 0 || pos > state.doc.content.size) return;
            const resolved = state.doc.resolve(pos);
            const found = getMarkRange(resolved, markType);
            if (found) {
                ranges.push(found);
            }
        };

        // Check around the insertion to catch paired deletion marks.
        tryAddRange(range.from);
        tryAddRange(range.from - 1);
        tryAddRange(range.to);

        const uniqueRanges = ranges.filter((r, idx, arr) => {
            return arr.findIndex(other => other.from === r.from && other.to === r.to) === idx;
        });

        if (!uniqueRanges.length) return;

        let tr = state.tr;
        uniqueRanges
            .sort((a, b) => b.from - a.from)
            .forEach(r => {
                tr = tr.delete(r.from, r.to);
            });

        view.dispatch(tr);
    };

    const handleAccept = () => {
        const isInsertion = editor.isActive('insertion');
        const isDeletion = editor.isActive('deletion');

        if (isInsertion) {
            const range = selectMarkRange('insertion');
            if (range) {
                editor
                    .chain()
                    .focus()
                    .setTextSelection(range)
                    .unsetMark('insertion')
                    .run();
                removeAdjacentDeletions(range);
            }
            // Accept insertion: just remove the mark, keeping the text
        } else if (isDeletion) {
            const range = selectMarkRange('deletion');
            if (range) {
                editor
                    .chain()
                    .focus()
                    .setTextSelection(range)
                    .deleteSelection()
                    .run();
            }
            // Accept deletion: delete the selection
        }
    };

    const handleReject = () => {
        const isInsertion = editor.isActive('insertion');
        const isDeletion = editor.isActive('deletion');

        if (isInsertion) {
            const range = selectMarkRange('insertion');
            if (range) {
                editor
                    .chain()
                    .focus()
                    .setTextSelection(range)
                    .deleteSelection()
                    .run();
            }
            // Reject insertion: delete the text
        } else if (isDeletion) {
            const range = selectMarkRange('deletion');
            if (range) {
                editor
                    .chain()
                    .focus()
                    .setTextSelection(range)
                    .unsetMark('deletion')
                    .run();
            }
            // Reject deletion: just remove the mark, keeping the text (restoring it)
        }
    };

    return (
        <BubbleMenu
            editor={editor}
            // @ts-expect-error tippyOptions is supported at runtime but missing from current type defs
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
