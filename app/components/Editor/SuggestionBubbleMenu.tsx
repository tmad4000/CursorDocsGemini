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

    const getAdjacentMarkRanges = (markName: string, range: Range) => {
        const { state } = editor;
        const markType = state.schema.marks[markName];
        if (!markType) return [];

        const ranges: Range[] = [];
        const positions = [range.from, range.from - 1, range.to, range.to - 1];

        positions.forEach((pos) => {
            if (pos < 0 || pos > state.doc.content.size) return;
            const resolved = state.doc.resolve(pos);
            const found = getMarkRange(resolved, markType);
            if (found) {
                ranges.push(found);
            }
        });

        return ranges.filter((r, idx, arr) => {
            return arr.findIndex((other) => other.from === r.from && other.to === r.to) === idx;
        });
    };

    const deleteRanges = (ranges: Range[]) => {
        if (!ranges.length) return;
        const { state, view } = editor;
        let tr = state.tr;

        ranges
            .sort((a, b) => b.from - a.from)
            .forEach((r) => {
                tr = tr.delete(r.from, r.to);
            });

        view.dispatch(tr);
    };

    const clearMarkRanges = (markName: string, ranges: Range[]) => {
        if (!ranges.length) return;
        const { state, view } = editor;
        const markType = state.schema.marks[markName];
        if (!markType) return;

        let tr = state.tr;
        ranges.forEach((r) => {
            tr = tr.removeMark(r.from, r.to, markType);
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
                const deletions = getAdjacentMarkRanges('deletion', range);
                deleteRanges(deletions);
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
                const deletions = getAdjacentMarkRanges('deletion', range);
                clearMarkRanges('deletion', deletions);
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
                const insertions = getAdjacentMarkRanges('insertion', range);
                deleteRanges(insertions);
            }
            // Reject deletion: just remove the mark, keeping the text (restoring it)
        }
    };

    return (
        <BubbleMenu
            editor={editor}
            options={{ tippyOptions: { duration: 100, interactive: true } }}
            shouldShow={({ editor }: { editor: Editor }) => {
                return editor.isActive('insertion') || editor.isActive('deletion');
            }}
            className={styles.bubbleMenu}
        >
            <button
                onClick={handleAccept}
                onMouseDown={(e) => e.preventDefault()}
                className={styles.acceptButton}
                aria-label="Accept change"
                title="Accept change"
            >
                <Check size={16} />
                <span>Accept</span>
            </button>
            <button
                onClick={handleReject}
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
