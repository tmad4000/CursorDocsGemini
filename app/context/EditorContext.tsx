"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';

type EditorPane = 'notes' | 'final';

interface EditorContextType {
    // Legacy single editor support (points to active editor)
    editor: Editor | null;
    setEditor: (editor: Editor | null) => void;

    // Dual editor support
    notesEditor: Editor | null;
    setNotesEditor: (editor: Editor | null) => void;
    finalEditor: Editor | null;
    setFinalEditor: (editor: Editor | null) => void;

    // Which editor is active/focused
    activePane: EditorPane;
    setActivePane: (pane: EditorPane) => void;

    // Get content from both editors for AI context
    getNotesContent: () => string;
    getFinalContent: () => string;

    // Apply content to final doc (with or without track changes)
    applyToFinal: (html: string, withTrackChanges?: boolean) => void;

    // AI trigger
    triggerAI: (prompt: string) => void;
    setTriggerAI: (fn: (prompt: string) => void) => void;

    // Show/hide notes pane
    notesVisible: boolean;
    setNotesVisible: (visible: boolean) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
    const [finalEditor, setFinalEditor] = useState<Editor | null>(null);
    const [activePane, setActivePane] = useState<EditorPane>('final');
    const [triggerAI, setTriggerAI] = useState<(prompt: string) => void>(() => () => {});
    const [notesVisible, setNotesVisible] = useState(false);

    // Legacy editor getter - returns the active editor
    const editor = activePane === 'notes' ? notesEditor : finalEditor;
    const setEditor = activePane === 'notes' ? setNotesEditor : setFinalEditor;

    const getNotesContent = useCallback(() => {
        return notesEditor?.getHTML() || '';
    }, [notesEditor]);

    const getFinalContent = useCallback(() => {
        return finalEditor?.getHTML() || '';
    }, [finalEditor]);

    const applyToFinal = useCallback((html: string, withTrackChanges = true) => {
        if (!finalEditor) return;

        if (withTrackChanges) {
            // Insert with track changes spans (handled by AI)
            finalEditor.commands.setContent(html);
        } else {
            // Direct apply - strip any track change spans first
            const cleanHtml = html
                .replace(/<span class="suggestion-deletion">.*?<\/span>/g, '')
                .replace(/<span class="suggestion-insertion">(.*?)<\/span>/g, '$1');
            finalEditor.commands.setContent(cleanHtml);
        }
    }, [finalEditor]);

    return (
        <EditorContext.Provider value={{
            editor,
            setEditor,
            notesEditor,
            setNotesEditor,
            finalEditor,
            setFinalEditor,
            activePane,
            setActivePane,
            getNotesContent,
            getFinalContent,
            applyToFinal,
            triggerAI,
            setTriggerAI,
            notesVisible,
            setNotesVisible,
        }}>
            {children}
        </EditorContext.Provider>
    );
}

export function useEditorContext() {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditorContext must be used within an EditorProvider');
    }
    return context;
}
