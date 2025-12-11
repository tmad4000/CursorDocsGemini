"use client";

import React, { createContext, useContext, useState } from 'react';
import { Editor } from '@tiptap/react';

interface EditorContextType {
    editor: Editor | null;
    setEditor: (editor: Editor | null) => void;
    triggerAI: (prompt: string) => void;
    setTriggerAI: (fn: (prompt: string) => void) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const [triggerAI, setTriggerAI] = useState<(prompt: string) => void>(() => () => {});

    return (
        <EditorContext.Provider value={{ editor, setEditor, triggerAI, setTriggerAI }}>
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
