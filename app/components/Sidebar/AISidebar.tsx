"use client";

import React, { useState, useEffect, useRef } from 'react';

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

import {
    fetchMeetingContext,
    getStoredMeetingContext,
    setStoredMeetingContext,
    clearStoredMeetingContext,
    parsePastedContext,
} from '@/lib/meeting-context';

import ApiKeyModal from '@/components/ApiKeyModal/ApiKeyModal';

import ReviewTab from './ReviewTab';
import { Wand2, FileCheck, ShieldCheck, Settings, Key, Send, Database, RefreshCw } from 'lucide-react';

const QUICK_ACTIONS = [
    { label: 'Improve', prompt: 'Make this better.', icon: <Wand2 size={14} /> },
    { label: 'Proofread', prompt: 'Proofread this for grammar and spelling errors only.', icon: <FileCheck size={14} /> },
    { label: 'Sanity Check', prompt: 'Sanity check and proofread this before I send it. Is it clear, professional, and logical?', icon: <ShieldCheck size={14} /> },
];



interface Message {

    id: string;

    role: 'user' | 'assistant' | 'system';

    content: string;

}



export default function AISidebar() {

    const { editor, setTriggerAI } = useEditorContext();

    const [activeTab, setActiveTab] = useState<'chat' | 'review'>('chat');

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

    const [useMeetingContext, setUseMeetingContext] = useState(false);
    const [meetingContext, setMeetingContext] = useState<string | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [alwaysSuggestChanges, setAlwaysSuggestChanges] = useState(false);

    // Ref pattern to allow external triggering without stale closures
    const handleSendRef = useRef<(prompt?: string) => Promise<void>>(async () => { });
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content
    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 200); // Max 200px
            textarea.style.height = `${newHeight}px`;
        }
    };



    // Check for stored API key and static mode on mount

    useEffect(() => {

        const staticMode = isStaticMode();

        setUseClientMode(staticMode);



        const stored = getStoredApiKey();

        setApiKey(stored);

        // Load stored meeting context
        const storedContext = getStoredMeetingContext();
        if (storedContext) {
            setMeetingContext(storedContext);
            setUseMeetingContext(true);
        }

        // Show modal if in static mode and no API key

        if (staticMode && !stored) {

            setShowApiKeyModal(true);

        }



        // Register triggerAI
        setTriggerAI(() => (prompt: string) => {
            handleSendRef.current(prompt);
        });

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

    const handleFetchMeetingContext = async () => {
        setIsLoadingContext(true);
        try {
            const context = await fetchMeetingContext();
            if (context?.summary) {
                setMeetingContext(context.summary);
                setStoredMeetingContext(context.summary);
                setUseMeetingContext(true);
            } else {
                alert('Could not fetch meeting context. Make sure RealtimeMeetingOutline is running on localhost:3002');
            }
        } catch (error) {
            console.error('Failed to fetch meeting context:', error);
            alert('Failed to fetch meeting context');
        } finally {
            setIsLoadingContext(false);
        }
    };

    const handleClearMeetingContext = () => {
        clearStoredMeetingContext();
        setMeetingContext(null);
        setUseMeetingContext(false);
    };

    const handleSend = async (overrideInput?: string) => {

        const textToSend = overrideInput ?? input ?? '';

        if (typeof textToSend !== 'string' || !textToSend.trim()) return;



        if (!editor) {

            alert("Editor is not ready yet.");

            return;

        }



        // Switch to chat tab if we are triggering a new request

        setActiveTab('chat');



        // Check if we need an API key for client mode

        if (useClientMode && !apiKey) {

            setShowApiKeyModal(true);

            return;

        }



        const { from, to, empty } = editor.state.selection;

        const isSelectionMode = !empty;



        let currentContent = "";

        let selectionRange = { from, to };



        if (isSelectionMode) {

            currentContent = editor.state.doc.textBetween(from, to, ' ', ' ');

        } else {

            currentContent = editor.getHTML();

        }



        const userMsg: Message = {

            id: Date.now().toString(),

            role: 'user',

            content: textToSend,

        };



        setMessages((prev) => [...prev, userMsg]);

        setInput('');
        // Reset textarea height after sending
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        setIsTyping(true);



        try {

            let systemPrompt = "";

            // Check if this looks like a request for document changes
            const editKeywords = /\b(edit|change|fix|improve|rewrite|revise|update|make|add|remove|delete|insert|replace|proofread|correct|shorten|expand|summarize|rephrase)\b/i;
            const looksLikeEditRequest = alwaysSuggestChanges || editKeywords.test(textToSend);

            if (looksLikeEditRequest) {
                // Edit mode - return HTML changes
                if (isSelectionMode) {
                    systemPrompt = `You are an expert intelligent document editor.
The user wants you to edit a SPECIFIC SNIPPET of text from the document.

RULES:
1. Return ONLY the updated HTML for the selected snippet.
2. Do NOT include existing surrounding text, just the replacement for the selection.
3. PRESERVE existing HTML tags within the selection (like bold, italic) unless asked to change.
4. Do NOT include markdown blocks.

MODE: ${trackChanges ? 'TRACK CHANGES' : 'DIRECT EDIT'}

IF TRACK CHANGES IS ON:
- Wrap ANY deleted text in <span class="suggestion-deletion">...</span>
- Wrap ANY added text in <span class="suggestion-insertion">...</span>
- For replacements, include BOTH the deleted text (wrapped in deletion span) and new text (wrapped in insertion span).

IF DIRECT EDIT IS ON:
- Just return the polished HTML.

Current Selection:
${currentContent}`;
                } else {
                    systemPrompt = `You are an expert intelligent document editor.
The user wants you to edit the document provided in HTML format.

RULES:
1. PRESERVE existing HTML structure (headers, lists, bold, etc.) unless explicitly asked to change it.
2. Return ONLY the fully updated HTML content. Do NOT include markdown blocks.
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
                }
            } else {
                // Conversational mode - respond naturally without forcing edits
                systemPrompt = `You are a helpful AI assistant for document editing.
The user is working on a document and may ask questions, discuss ideas, or request edits.

IMPORTANT: The user's message does NOT appear to be asking for document changes.
- Respond conversationally in plain text (not HTML)
- Answer questions, provide information, or discuss the topic
- If they DO want document changes, they will explicitly ask (e.g., "edit this", "fix the grammar", "make this shorter")
- Do NOT modify the document unless explicitly asked

${isSelectionMode ? `Selected text they may be asking about:\n${currentContent}` : `Document context:\n${currentContent.slice(0, 1500)}...`}`;
            }

            // Inject meeting context if enabled
            if (useMeetingContext && meetingContext) {
                systemPrompt += `\n\n## Additional Context from Recent Meetings:\n${meetingContext}\n\nUse this context to inform your edits if relevant.`;
            }

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



                const data = await response.json();

                if (!response.ok) {
                    const errorMsg = data.error || 'Failed to get response';
                    const suggestion = data.suggestion || '';
                    throw new Error(suggestion ? `${errorMsg}\n\n💡 ${suggestion}` : errorMsg);
                }

                newHtml = data.reply;

                if (data.warning) {
                    console.warn('[Rate Limit]', data.warning);
                }

            }



            // Handle response based on mode
            if (looksLikeEditRequest) {
                // Edit mode - apply changes to document
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: trackChanges ? "I've suggested some changes." : "I've updated the text.",
                };
                setMessages((prev) => [...prev, aiMsg]);

                if (isSelectionMode) {
                    // Replace only the selection
                    editor.chain().focus().setTextSelection(selectionRange).insertContent(newHtml).run();
                } else {
                    // Replace whole document
                    editor.commands.setContent(newHtml);
                }

                // Switch to review tab if changes were made and track changes is on
                if (trackChanges) {
                    setActiveTab('review');
                }
            } else {
                // Conversational mode - just show the response in chat
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: newHtml, // In conversational mode, this is plain text
                };
                setMessages((prev) => [...prev, aiMsg]);
            }



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



    // Update the ref whenever handleSend changes (which is... whenever state changes)

    useEffect(() => {

        handleSendRef.current = handleSend;

    });



    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) sends the message
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSend();
        }
        // Enter and Shift+Enter allow newline (default behavior)
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

            <div className={styles.tabBar}>
                <button
                    className={`${styles.tabButton} ${activeTab === 'chat' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    Chat
                </button>
                <button
                    className={`${styles.tabButton} ${activeTab === 'review' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('review')}
                >
                    Review
                </button>
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
                                checked={alwaysSuggestChanges}
                                onChange={(e) => setAlwaysSuggestChanges(e.target.checked)}
                            />
                            <span>Always suggest changes</span>
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
                    <div className={styles.settingRow}>
                        <label className={styles.toggleLabel}>
                            <input
                                type="checkbox"
                                checked={useMeetingContext}
                                onChange={(e) => setUseMeetingContext(e.target.checked)}
                            />
                            <span>Include meeting context</span>
                        </label>
                    </div>
                    {useMeetingContext && (
                        <div className={styles.apiKeySection}>
                            {meetingContext ? (
                                <div className={styles.apiKeyStatus}>
                                    <Database size={14} />
                                    <span>Context loaded</span>
                                    <button
                                        className={styles.changeKeyButton}
                                        onClick={handleFetchMeetingContext}
                                        disabled={isLoadingContext}
                                    >
                                        {isLoadingContext ? <RefreshCw size={14} className="animate-spin" /> : 'Refresh'}
                                    </button>
                                    <button
                                        className={styles.clearKeyButton}
                                        onClick={handleClearMeetingContext}
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className={styles.addKeyButton}
                                    onClick={handleFetchMeetingContext}
                                    disabled={isLoadingContext}
                                >
                                    {isLoadingContext ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
                                    {isLoadingContext ? 'Loading...' : 'Fetch from RMO'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'chat' ? (
                <>
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
                        <div className={styles.quickActionsContainer}>
                            {QUICK_ACTIONS.map((action) => (
                                <button
                                    key={action.label}
                                    className={styles.quickActionChip}
                                    onClick={() => handleSend(action.prompt)}
                                    disabled={isTyping}
                                >
                                    {action.icon}
                                    <span>{action.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className={styles.inputWrapper}>
                            <button
                                className={styles.magicButton}
                                onClick={() => handleSend("Make this better.")}
                                disabled={isTyping}
                                title="Make it better"
                            >
                                <Wand2 size={18} />
                            </button>
                            <textarea
                                ref={textareaRef}
                                placeholder={trackChanges ? "Suggest changes... (⌘+Enter to send)" : "Edit directly... (⌘+Enter to send)"}
                                className={styles.textarea}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    adjustTextareaHeight();
                                }}
                                onKeyDown={handleKeyDown}
                                rows={1}
                            />
                            <button
                                className={styles.sendButton}
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isTyping}
                                title="Send (⌘+Enter)"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <ReviewTab />
            )}

            <ApiKeyModal
                isOpen={showApiKeyModal}
                onClose={() => setShowApiKeyModal(false)}
                onSave={handleApiKeySave}
            />
        </div>
    );
}
