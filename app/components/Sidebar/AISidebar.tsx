"use client";

import React, { useState } from 'react';
import styles from './AISidebar.module.css';
import { useEditorContext } from '@/context/EditorContext';
import { AVAILABLE_MODELS, DEFAULT_MODEL, ModelId } from '@/lib/models';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export default function AISidebar() {
    const { editor } = useEditorContext();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I can help you edit this document. Try asking me "Make the tone more professional" or "Fix grammar".',
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [trackChanges, setTrackChanges] = useState(true);
    const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);

    const handleSend = async () => {
        if (!input.trim()) return;

        if (!editor) {
            alert("Editor is not ready yet.");
            return;
        }

        // Capture current selection or full document
        // For this iteration, we send the full HTML to ensure context and structure are preserved.
        const currentContent = editor.getHTML();

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const systemPrompt = `You are an expert intelligent document editor. 
      The user wants you to edit the document provided in HTML format.
      
      RULES:
      1. PRESERVE existing HTML structure (headers, lists, bold, etc.) unless explicitly asked to change it.
      2. Return ONLY the fully updated HTML content. Do NOT include markdown blocks (like \`\`\`html).
      3. Do NOT include explanations.
      
      MODE: ${trackChanges ? 'TRACK CHANGES' : 'DIRECT EDIT'}
      
      IF TRACK CHANGES IS ON:
      - Wrap ANY deleted text in <span class="suggestion-deletion">...</span>
      - Wrap ANY added text in <span class="suggestion-insertion">...</span>
      - Do NOT simply replace text; show the diff.
      
      IF DIRECT EDIT IS ON:
      - Just apply the changes cleanly without extra tags.
      
      Current Content:
      ${currentContent}`;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        ...messages.filter(m => m.role !== 'system'),
                        userMsg
                    ].map(m => ({ role: m.role, content: m.content })),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            const newHtml = data.reply;

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: trackChanges ? "I've suggested some changes with diffs." : "I've updated the document.",
            };
            setMessages((prev) => [...prev, aiMsg]);

            // Apply the HTML directly
            editor.commands.setContent(newHtml);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, something went wrong. Please try again.",
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div className={styles.sidebarContent}>
            <div className={styles.header}>
                <h2>AI Assistant</h2>
                <div className={styles.controls}>
                    <select
                        className={styles.modelSelector}
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                        title="Select AI Model"
                    >
                        {AVAILABLE_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                    <label className={styles.toggleLabel}>
                        <input
                            type="checkbox"
                            checked={trackChanges}
                            onChange={(e) => setTrackChanges(e.target.checked)}
                        />
                        <span>Track Changes</span>
                    </label>
                </div>
            </div>
            <div className={styles.messages}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.aiMessage} ${msg.role === 'user' ? styles.userMessage : ''}`}
                    >
                        {msg.content}
                    </div>
                ))}
                {isTyping && <div className={styles.typingIndicator}>AI is thinking...</div>}
            </div>
            <div className={styles.inputArea}>
                <input
                    type="text"
                    placeholder={trackChanges ? "Suggest changes..." : "Edit directly..."}
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>
        </div>
    );
}
