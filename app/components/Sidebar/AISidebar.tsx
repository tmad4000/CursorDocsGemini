"use client";

import React, { useState, useEffect } from 'react';
import styles from './AISidebar.module.css';
import { useEditorContext } from '@/context/EditorContext';
import { AVAILABLE_MODELS, DEFAULT_MODEL, ModelId } from '@/lib/models';
import {
    getStoredApiKey,
    setStoredApiKey,
    clearStoredApiKey,
    hasStoredApiKey,
    chatWithOpenAI,
    isStaticMode
} from '@/lib/openai-client';
import ApiKeyModal from '@/components/ApiKeyModal/ApiKeyModal';
import { Settings, Key, Send } from 'lucide-react';

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
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [useClientMode, setUseClientMode] = useState(false);

    // Check for stored API key and static mode on mount
    useEffect(() => {
        const staticMode = isStaticMode();
        setUseClientMode(staticMode);

        const stored = getStoredApiKey();
        setApiKey(stored);

        // Show modal if in static mode and no API key
        if (staticMode && !stored) {
            setShowApiKeyModal(true);
        }
    }, []);

    const handleApiKeySave = (key: string) => {
        setApiKey(key);
        setStoredApiKey(key);
    };

    const handleClearApiKey = () => {
        clearStoredApiKey();
        setApiKey(null);
        setShowSettings(false);
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        if (!editor) {
            alert("Editor is not ready yet.");
            return;
        }

        // Check if we need an API key for client mode
        if (useClientMode && !apiKey) {
            setShowApiKeyModal(true);
            return;
        }

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

            const allMessages = [
                { role: "system", content: systemPrompt },
                ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
                { role: userMsg.role, content: userMsg.content }
            ];

            let newHtml: string;

            if (useClientMode && apiKey) {
                // Client-side mode: call OpenAI directly
                newHtml = await chatWithOpenAI(allMessages, selectedModel, apiKey);
            } else {
                // Server mode: use API route
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: allMessages,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to get response');
                }

                const data = await response.json();
                newHtml = data.reply;

                // Show rate limit warning if present
                if (data.warning) {
                    console.warn('[Rate Limit]', data.warning);
                }
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: trackChanges ? "I've suggested some changes with diffs." : "I've updated the document.",
            };
            setMessages((prev) => [...prev, aiMsg]);

            editor.commands.setContent(newHtml);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Sorry, something went wrong: ${errorMessage}. Please check your API key and try again.`,
            };
            setMessages((prev) => [...prev, aiMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter without Shift sends the message
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Shift+Enter allows newline (default behavior)
    };

    return (
        <div className={styles.sidebarContent}>
            <div className={styles.header}>
                <h2>AI Assistant</h2>
                <div className={styles.headerButtons}>
                    <button
                        className={styles.settingsButton}
                        onClick={() => setShowSettings(!showSettings)}
                        title="Settings"
                    >
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className={styles.settingsPanel}>
                    <div className={styles.settingRow}>
                        <label>Model:</label>
                        <select
                            className={styles.modelSelector}
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                        >
                            {AVAILABLE_MODELS.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.settingRow}>
                        <label className={styles.toggleLabel}>
                            <input
                                type="checkbox"
                                checked={trackChanges}
                                onChange={(e) => setTrackChanges(e.target.checked)}
                            />
                            <span>Track Changes</span>
                        </label>
                    </div>
                    <div className={styles.settingRow}>
                        <label className={styles.toggleLabel}>
                            <input
                                type="checkbox"
                                checked={useClientMode}
                                onChange={(e) => {
                                    setUseClientMode(e.target.checked);
                                    if (e.target.checked && !apiKey) {
                                        setShowApiKeyModal(true);
                                    }
                                }}
                            />
                            <span>Use my own API key</span>
                        </label>
                    </div>
                    {useClientMode && (
                        <div className={styles.apiKeySection}>
                            {apiKey ? (
                                <div className={styles.apiKeyStatus}>
                                    <Key size={14} />
                                    <span>API key saved</span>
                                    <button
                                        className={styles.changeKeyButton}
                                        onClick={() => setShowApiKeyModal(true)}
                                    >
                                        Change
                                    </button>
                                    <button
                                        className={styles.clearKeyButton}
                                        onClick={handleClearApiKey}
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className={styles.addKeyButton}
                                    onClick={() => setShowApiKeyModal(true)}
                                >
                                    <Key size={14} />
                                    Add API Key
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

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
                <div className={styles.inputWrapper}>
                    <textarea
                        placeholder={trackChanges ? "Suggest changes... (Shift+Enter for new line)" : "Edit directly... (Shift+Enter for new line)"}
                        className={styles.textarea}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        className={styles.sendButton}
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        title="Send (Enter)"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>

            <ApiKeyModal
                isOpen={showApiKeyModal}
                onClose={() => setShowApiKeyModal(false)}
                onSave={handleApiKeySave}
            />
        </div>
    );
}
