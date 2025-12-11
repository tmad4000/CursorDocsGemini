import { Editor, getMarkRange } from '@tiptap/core';
import { useCallback } from 'react';

type Range = { from: number; to: number };

export function useSuggestionActions(editor: Editor | null) {
    const getAdjacentMarkRanges = useCallback((markName: string, range: Range) => {
        if (!editor) return [];
        const { state } = editor;
        const markType = state.schema.marks[markName];
        if (!markType) return [];

        const ranges: Range[] = [];
        // Check immediate boundaries
        const positions = [range.from, range.from - 1, range.to, range.to - 1];

        positions.forEach((pos) => {
            if (pos < 0 || pos > state.doc.content.size) return;
            const resolved = state.doc.resolve(pos);
            const found = getMarkRange(resolved, markType);
            if (found) {
                ranges.push(found);
            }
        });

        // Deduplicate
        return ranges.filter((r, idx, arr) => {
            return arr.findIndex((other) => other.from === r.from && other.to === r.to) === idx;
        });
    }, [editor]);

    const acceptSuggestion = useCallback((range?: Range, type?: 'insertion' | 'deletion') => {
        if (!editor) return;
        const { state, view } = editor;
        let tr = state.tr;

        // If no specific range provided, try to find one from selection
        if (!range || !type) {
            const isInsertion = editor.isActive('insertion');
            const isDeletion = editor.isActive('deletion');
            
            if (isInsertion) {
                type = 'insertion';
                const { $anchor } = state.selection;
                range = getMarkRange($anchor, state.schema.marks.insertion) || undefined;
            } else if (isDeletion) {
                type = 'deletion';
                const { $anchor } = state.selection;
                range = getMarkRange($anchor, state.schema.marks.deletion) || undefined;
            }
        }

        if (!range || !type) return;

        if (type === 'insertion') {
            // 1. Unset the insertion mark (keep the new text)
            tr.removeMark(range.from, range.to, state.schema.marks.insertion);

            // 2. Find and delete adjacent deletions (the old text being replaced)
            const deletions = getAdjacentMarkRanges('deletion', range);
            deletions.sort((a, b) => b.from - a.from).forEach((d) => {
                tr.delete(d.from, d.to);
            });
        } else if (type === 'deletion') {
            // Accept deletion: delete the selection
            tr.delete(range.from, range.to);
        }

        view.dispatch(tr);
    }, [editor, getAdjacentMarkRanges]);

    const rejectSuggestion = useCallback((range?: Range, type?: 'insertion' | 'deletion') => {
        if (!editor) return;
        const { state, view } = editor;
        let tr = state.tr;

        // If no specific range provided, try to find one from selection
        if (!range || !type) {
            const isInsertion = editor.isActive('insertion');
            const isDeletion = editor.isActive('deletion');
            
            if (isInsertion) {
                type = 'insertion';
                const { $anchor } = state.selection;
                range = getMarkRange($anchor, state.schema.marks.insertion) || undefined;
            } else if (isDeletion) {
                type = 'deletion';
                const { $anchor } = state.selection;
                range = getMarkRange($anchor, state.schema.marks.deletion) || undefined;
            }
        }

        if (!range || !type) return;

        if (type === 'insertion') {
            // Reject insertion: delete the new text
            tr.delete(range.from, range.to);

            // Restore adjacent deletions
            const deletions = getAdjacentMarkRanges('deletion', range);
            deletions.forEach((d) => {
                 tr.removeMark(d.from, d.to, state.schema.marks.deletion);
            });

        } else if (type === 'deletion') {
            // Reject deletion: just remove the mark, keeping the text (restoring it)
            tr.removeMark(range.from, range.to, state.schema.marks.deletion);

            // If there were adjacent insertions associated with this replacement, remove them too
            const insertions = getAdjacentMarkRanges('insertion', range);
            insertions.sort((a, b) => b.from - a.from).forEach((i) => {
                tr.delete(i.from, i.to);
            });
        }

        view.dispatch(tr);
    }, [editor, getAdjacentMarkRanges]);

    return {
        acceptSuggestion,
        rejectSuggestion
    };
}
