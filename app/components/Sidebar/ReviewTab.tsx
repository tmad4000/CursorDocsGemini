"use client";

import React, { useEffect, useState } from 'react';
import { useEditorContext } from '@/context/EditorContext';
import styles from './ReviewTab.module.css';
import { Check, X, Plus, Minus } from 'lucide-react';
import { useSuggestionActions } from '@/components/Editor/hooks/useSuggestionActions';

interface Suggestion {
    id: string; // Unique ID based on position
    type: 'insertion' | 'deletion';
    text: string;
    from: number;
    to: number;
}

export default function ReviewTab() {
    const { editor } = useEditorContext();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const { acceptSuggestion, rejectSuggestion } = useSuggestionActions(editor);

    const scanSuggestions = () => {
        if (!editor) return;

        const found: Suggestion[] = [];
        const { doc } = editor.state;

        doc.descendants((node, pos) => {
            if (!node.isText) return;

            const marks = node.marks;
            marks.forEach(mark => {
                if (mark.type.name === 'insertion' || mark.type.name === 'deletion') {
                    // Check if we already have this suggestion (part of the same continuous mark)
                    const last = found[found.length - 1];
                    const isContinuation = last && 
                                           last.type === mark.type.name && 
                                           last.to === pos;

                    if (isContinuation) {
                        last.text += node.text;
                        last.to += node.nodeSize;
                    } else {
                        found.push({
                            id: `${mark.type.name}-${pos}`,
                            type: mark.type.name as 'insertion' | 'deletion',
                            text: node.text || '',
                            from: pos,
                            to: pos + node.nodeSize
                        });
                    }
                }
            });
        });

        setSuggestions(found);
    };

    // Scan on mount and update whenever editor content changes
    useEffect(() => {
        if (!editor) return;
        
        scanSuggestions();

        const handleUpdate = () => {
            scanSuggestions();
        };

        editor.on('update', handleUpdate);
        
        return () => {
            editor.off('update', handleUpdate);
        };
    }, [editor]);

    // Handle selection sync (highlight sidebar card when text is clicked)
    useEffect(() => {
        if (!editor) return;

        const handleSelectionUpdate = () => {
            const { from } = editor.state.selection;
            // Find suggestion containing the cursor
            const active = suggestions.find(s => from >= s.from && from <= s.to);
            
            if (active) {
                setActiveId(active.id);
                // Scroll card into view
                const el = document.getElementById(`suggestion-card-${active.id}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                setActiveId(null);
            }
        };

        editor.on('selectionUpdate', handleSelectionUpdate);
        // Also run immediately in case we switched tabs to Review
        handleSelectionUpdate();

        return () => {
            editor.off('selectionUpdate', handleSelectionUpdate);
        };
    }, [editor, suggestions]);

    const scrollToSuggestion = (s: Suggestion) => {
        if (!editor) return;
        editor.chain().focus().setTextSelection({ from: s.from, to: s.to }).run();
        // Set active immediately for responsiveness
        setActiveId(s.id);
        
        // Scroll into view logic is built into setTextSelection usually, but sometimes needs help
        const dom = editor.view.domAtPos(s.from).node as HTMLElement;
        if (dom && dom.scrollIntoView) {
             dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleAccept = (s: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        acceptSuggestion({ from: s.from, to: s.to }, s.type);
    };

    const handleReject = (s: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        rejectSuggestion({ from: s.from, to: s.to }, s.type);
    };

    if (suggestions.length === 0) {
        return (
            <div className={styles.emptyState}>
                <Check size={48} className={styles.emptyIcon} />
                <p>No pending changes.</p>
                <p className={styles.subtext}>Great job!</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Review ({suggestions.length})</h3>
            </div>
            <div className={styles.list}>
                {suggestions.map((s) => (
                    <div 
                        key={s.id}
                        id={`suggestion-card-${s.id}`}
                        className={`${styles.card} ${styles[s.type]} ${activeId === s.id ? styles.active : ''}`}
                        onClick={() => scrollToSuggestion(s)}
                    >
                        <div className={styles.cardContent}>
                            <span className={styles.typeIcon}>
                                {s.type === 'insertion' ? <Plus size={14} /> : <Minus size={14} />}
                            </span>
                            <span className={`${styles.preview} ${styles[s.type + 'Text']}`}>
                                {s.text}
                            </span>
                        </div>
                        <div className={styles.actions}>
                            <button
                                className={styles.acceptBtn}
                                onClick={(e) => handleAccept(s, e)}
                                title="Accept"
                            >
                                <Check size={14} />
                            </button>
                            <button
                                className={styles.rejectBtn}
                                onClick={(e) => handleReject(s, e)}
                                title="Reject"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}