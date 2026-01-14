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

import logger from '@/lib/logger';

import ApiKeyModal from '@/components/ApiKeyModal/ApiKeyModal';

import ReviewTab from './ReviewTab';
import { Wand2, FileCheck, ShieldCheck, Settings, Key, Send, Database, RefreshCw, Copy, Check, ArrowRight, Zap, Trash2, Info, X, Download } from 'lucide-react';

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

    const {
        editor,
        setTriggerAI,
        getNotesContent,
        getFinalContent,
        activePane,
        applyToFinal,
        notesVisible,
        setNotesVisible,
    } = useEditorContext();

    const [activeTab, setActiveTab] = useState<'chat' | 'review'>('chat');

    const [input, setInput] = useState('');

    // Messages state - initialized empty to avoid hydration mismatch
    const [messages, setMessages] = useState<Message[]>([]);

    // Load chat history from localStorage after hydration
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ai-docs-chat-history');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    return;
                }
            }
        } catch { /* ignore */ }
        // Default greeting if no saved history
        setMessages([{
            id: '1',
            role: 'assistant',
            content: 'Hello! I can help you edit this document. Try asking me "Make the tone more professional" or "Fix grammar".',
        }]);
    }, []);

    const [isTyping, setIsTyping] = useState(false);

    const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

    const copyToClipboard = async (text: string, msgId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMsgId(msgId);
            setTimeout(() => setCopiedMsgId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const clearChat = () => {
        setMessages([{
            id: '1',
            role: 'assistant',
            content: 'Hello! I can help you edit this document. Try asking me "Make the tone more professional" or "Fix grammar".',
        }]);
        // Also clear from localStorage
        try {
            localStorage.removeItem('ai-docs-chat-history');
        } catch { /* ignore */ }
    };

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
    const [showMeetingInfo, setShowMeetingInfo] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Export document to Word with track changes
    const handleExportToWord = async () => {
        const content = getFinalContent();
        if (!content) {
            alert('No document content to export');
            return;
        }

        setIsExporting(true);
        try {
            const response = await fetch('/api/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: content,
                    filename: 'document-with-changes.docx'
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Export failed');
            }

            // Download the file
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document-with-changes.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure Python dependencies are installed:\npip install python-docx beautifulsoup4 lxml`);
        } finally {
            setIsExporting(false);
        }
    };

    // Export document to Google Docs with track changes visualization
    const [isExportingGDoc, setIsExportingGDoc] = useState(false);
    const handleExportToGoogleDoc = async () => {
        const content = getFinalContent();
        if (!content) {
            alert('No document content to export');
            return;
        }

        setIsExportingGDoc(true);
        try {
            const response = await fetch('/api/export-gdoc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: content,
                    title: 'AI Docs Export - ' + new Date().toLocaleDateString()
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Export failed');
            }

            const result = await response.json();
            // Open the Google Doc in a new tab
            window.open(result.url, '_blank');
        } catch (error) {
            console.error('Google Docs export error:', error);
            alert(`Google Docs export failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure:\n1. service-account.json exists in project root\n2. Google Docs & Drive APIs are enabled\n3. Python deps installed: pip install google-auth google-api-python-client beautifulsoup4`);
        } finally {
            setIsExportingGDoc(false);
        }
    };

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

    // Save chat history to localStorage when messages change
    useEffect(() => {
        if (typeof window === 'undefined') return;
        // Only save if we have more than the default welcome message
        if (messages.length > 1 || (messages.length === 1 && messages[0].id !== '1')) {
            try {
                // Keep last 50 messages to avoid localStorage limits
                const toSave = messages.slice(-50);
                localStorage.setItem('ai-docs-chat-history', JSON.stringify(toSave));
            } catch { /* ignore quota errors */ }
        }
    }, [messages]);

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
                alert('Could not fetch meeting context.\n\nTo start RealtimeMeetingOutline:\n1. cd ~/code/RealtimeMeetingOutline\n2. docker-compose up -d\n3. cd backend && npm run dev\n\nOr set NEXT_PUBLIC_RMO_API_URL if using a different port.');
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
            const editKeywords = /\b(edit|change|fix|improve|rewrite|revise|update|make|add|remove|delete|insert|replace|proofread|correct|shorten|expand|summarize|rephrase|write|create|generate|draft|compose|incorporate|move|transfer|put|based on the notes|from the notes|into the doc|to the doc)\b/i;
            const looksLikeEditRequest = alwaysSuggestChanges || editKeywords.test(textToSend);

            if (looksLikeEditRequest) {
                // Edit mode - return HTML changes
                if (isSelectionMode) {
                    systemPrompt = `You are an expert intelligent document editor working on a SELECTED SNIPPET.

## TASK
Edit the selected text below. Return ONLY the updated HTML for this selection.

## SELECTED TEXT:
${currentContent}

## OUTPUT RULES
1. Return ONLY the updated HTML for the selection (not the whole document)
2. PRESERVE existing HTML tags (bold, italic, etc.) unless asked to change
3. Do NOT include markdown code blocks

## EDIT MODE: ${trackChanges ? 'TRACK CHANGES' : 'DIRECT EDIT'}
${trackChanges ? `- Wrap DELETED text in: <span class="suggestion-deletion">deleted text</span>
- Wrap INSERTED text in: <span class="suggestion-insertion">new text</span>
- For replacements: show BOTH deletion and insertion spans` : `- Apply changes cleanly without tracking spans`}`;
                } else {
                    // Build context with both panes if notes are visible
                    const notesContent = notesVisible ? getNotesContent() : '';
                    const finalContent = currentContent;

                    systemPrompt = `You are an expert intelligent document editor with access to a dual-pane editing system.

## WORKSPACE STRUCTURE
${notesVisible ? `**NOTES PANE** (left side - reference material, scratchpad):
${notesContent}

**FINAL DOCUMENT PANE** (right side - the document being edited):
${finalContent}` : `**DOCUMENT**:
${finalContent}`}

## YOUR CAPABILITIES
1. **Edit the Final Document**: Return updated HTML and it will replace the final document content
2. **Transfer from Notes to Final**: When asked, incorporate content from Notes into the Final Document
3. **Track Changes Mode**: Currently ${trackChanges ? 'ON - show insertions/deletions as tracked changes' : 'OFF - make clean edits without tracking'}
${notesVisible ? `4. **Read Notes**: You can reference the Notes pane content to inform your edits` : ''}

## OUTPUT RULES
1. Return ONLY the fully updated HTML for the FINAL DOCUMENT
2. PRESERVE existing HTML structure (headers, lists, bold, etc.) unless asked to change
3. Do NOT include markdown code blocks or explanations
4. If asked to "incorporate", "move", "transfer", or "use" content from Notes → add it to Final Document
5. If asked to "start fresh based on notes" → create new Final Document content using Notes as source

## EDIT MODE: ${trackChanges ? 'TRACK CHANGES' : 'DIRECT EDIT'}
${trackChanges ? `- Wrap DELETED text in: <span class="suggestion-deletion">deleted text</span>
- Wrap INSERTED text in: <span class="suggestion-insertion">new text</span>
- Show the diff, don't just replace` : `- Apply changes cleanly without tracking spans
- User explicitly requested direct edits without tracking`}`;
                }
            } else {
                // Conversational mode - respond naturally without forcing edits
                const notesContent = notesVisible ? getNotesContent() : '';

                systemPrompt = `You are a helpful AI assistant for document editing with access to a dual-pane workspace.

## YOUR CAPABILITIES
1. **Answer questions** about the document or notes content
2. **Discuss ideas** and provide suggestions
3. **Edit documents** when explicitly asked (use keywords like "edit", "change", "fix", "improve", "put this in the final doc")
4. **Transfer content** from Notes to Final Document when asked
5. **Toggle edit modes**: Track Changes (show diffs) vs Direct Edit (clean changes)
${notesVisible ? `6. **Reference Notes**: Access scratch notes as context for your responses` : ''}

## RESPONSE MODE
This message does NOT appear to be an edit request, so:
- Respond conversationally in plain text (NOT HTML)
- Answer questions, discuss ideas, provide information
- If they want document changes, they'll say "edit", "change", "put in the final doc", etc.

${notesVisible ? `## NOTES PANE (reference material):
${notesContent.slice(0, 1500)}...

## FINAL DOCUMENT:
${isSelectionMode ? `Selected text: ${currentContent}` : currentContent.slice(0, 1500)}...` :
`${isSelectionMode ? `Selected text:\n${currentContent}` : `Document:\n${currentContent.slice(0, 1500)}...`}`}`;
            }

            // Inject meeting context if enabled
            if (useMeetingContext && meetingContext) {
                systemPrompt += `\n\n## MEETING CONTEXT (from RealtimeMeetingOutline)
${meetingContext}

**Available Meeting Data:**
- Recent meetings with titles, dates, and transcript excerpts (2KB each)
- Meeting outlines: topics, participants, decisions, action items
- Known people and organizations across all meetings
- Knowledge base entries (Slack, personal notes, tags)

**Deep-Dive Tools** (if you need more than the excerpt):
- Full transcripts available via API for specific meetings
- Full meeting details (outline, entities, complete transcript) available on request

Use this meeting context to inform your document edits when relevant.`;
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

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Chat failed', error instanceof Error ? error : undefined, {
                model: selectedModel,
                isSelectionMode,
                useMeetingContext,
            });

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
                    {/* Chat header with sources and clear button */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderBottom: '1px solid #e5e5e5',
                        background: '#fafafa',
                        position: 'relative',
                    }}>
                        {/* Active sources indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                            <span style={{ color: '#999' }}>Sources:</span>
                            <button
                                onClick={() => setNotesVisible(!notesVisible)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    background: notesVisible ? '#e8f0fe' : '#f0f0f0',
                                    border: `1px solid ${notesVisible ? '#4285f4' : '#ddd'}`,
                                    borderRadius: '10px',
                                    color: notesVisible ? '#1a73e8' : '#888',
                                    cursor: 'pointer',
                                }}
                                title={notesVisible
                                    ? 'Notes pane included as AI context - your scratch notes are sent with each message. Click to disable.'
                                    : 'Include Notes pane as AI context - add reference material the AI can use. Click to enable.'}
                            >
                                📝 Notes {notesVisible ? '✓' : ''}
                            </button>
                            <button
                                onClick={() => {
                                    if (useMeetingContext && meetingContext) {
                                        handleClearMeetingContext();
                                    } else {
                                        setUseMeetingContext(true);
                                        if (!meetingContext) handleFetchMeetingContext();
                                    }
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    background: (useMeetingContext && meetingContext) ? '#e8f0fe' : '#f0f0f0',
                                    border: `1px solid ${(useMeetingContext && meetingContext) ? '#4285f4' : '#ddd'}`,
                                    borderRadius: '10px',
                                    color: (useMeetingContext && meetingContext) ? '#1a73e8' : '#888',
                                    cursor: 'pointer',
                                }}
                                title={(useMeetingContext && meetingContext)
                                    ? 'Meeting transcripts & entities from RealtimeMeetingOutline included. Click to clear.'
                                    : 'Fetch meetings from RealtimeMeetingOutline. To start: cd ~/code/RealtimeMeetingOutline && docker-compose up -d && cd backend && npm run dev'}
                            >
                                📅 Meetings {(useMeetingContext && meetingContext) ? '✓' : ''}
                            </button>
                            <button
                                onClick={() => setShowMeetingInfo(!showMeetingInfo)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#888',
                                    cursor: 'pointer',
                                }}
                                title="View meeting integration capabilities"
                            >
                                <Info size={12} />
                            </button>
                        </div>
                        {/* Meeting Info Panel */}
                        {showMeetingInfo && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'white',
                                border: '1px solid #e5e5e5',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                padding: '12px',
                                zIndex: 100,
                                fontSize: '11px',
                                maxHeight: '400px',
                                overflowY: 'auto',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <strong style={{ fontSize: '12px' }}>📅 Meeting Integration</strong>
                                    <button
                                        onClick={() => setShowMeetingInfo(false)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: '#333' }}>What&apos;s Included:</div>
                                    <ul style={{ margin: 0, paddingLeft: '16px', color: '#555' }}>
                                        <li>Recent meetings (titles, dates, 2KB transcript excerpts)</li>
                                        <li>Meeting outlines (topics, participants, decisions)</li>
                                        <li>Known people &amp; organizations from all meetings</li>
                                        <li>Knowledge base entries (Slack, notes, tags)</li>
                                        <li>User files from your data folder</li>
                                    </ul>
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: '#333' }}>Deep Dive Tools:</div>
                                    <ul style={{ margin: 0, paddingLeft: '16px', color: '#555' }}>
                                        <li><code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: '3px' }}>fetchFullTranscript(meetingId)</code> - Get complete transcript</li>
                                        <li><code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: '3px' }}>fetchFullMeeting(meetingId)</code> - Get all meeting data</li>
                                    </ul>
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: '#333' }}>Entity Types:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {['People', 'Organizations', 'VCs', 'Action Items', 'Ideas', 'Technologies', 'Decisions'].map(type => (
                                            <span key={type} style={{
                                                background: '#e8f0fe',
                                                color: '#1a73e8',
                                                padding: '2px 6px',
                                                borderRadius: '10px',
                                                fontSize: '10px',
                                            }}>{type}</span>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '8px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: '#333' }}>Start RMO Backend:</div>
                                    <code style={{
                                        display: 'block',
                                        background: '#1e1e1e',
                                        color: '#d4d4d4',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        whiteSpace: 'pre-wrap',
                                    }}>cd ~/code/RealtimeMeetingOutline{'\n'}docker-compose up -d{'\n'}cd backend &amp;&amp; npm run dev</code>
                                </div>

                                <div style={{ marginTop: '8px', color: '#888', fontSize: '10px' }}>
                                    API: <code>localhost:3848</code> •
                                    Frontend: <code>localhost:5847</code>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={handleExportToWord}
                                disabled={isExporting}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    background: 'transparent',
                                    border: '1px solid #e5e5e5',
                                    borderRadius: '4px',
                                    color: isExporting ? '#999' : '#666',
                                    cursor: isExporting ? 'wait' : 'pointer',
                                }}
                                title="Export to Word (.docx) with track changes"
                            >
                                <Download size={12} />
                                {isExporting ? '...' : 'Word'}
                            </button>
                            <button
                                onClick={handleExportToGoogleDoc}
                                disabled={isExportingGDoc}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    background: 'transparent',
                                    border: '1px solid #e5e5e5',
                                    borderRadius: '4px',
                                    color: isExportingGDoc ? '#999' : '#666',
                                    cursor: isExportingGDoc ? 'wait' : 'pointer',
                                }}
                                title="Export to Google Docs (opens in new tab)"
                            >
                                <Download size={12} />
                                {isExportingGDoc ? '...' : 'GDoc'}
                            </button>
                            <button
                                onClick={clearChat}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    background: 'transparent',
                                    border: '1px solid #e5e5e5',
                                    borderRadius: '4px',
                                    color: '#666',
                                    cursor: 'pointer',
                                }}
                                title="Clear chat history"
                            >
                                <Trash2 size={12} />
                                Clear
                            </button>
                        </div>
                    </div>
                    <div className={styles.messages}>
                        {messages.map((msg) => {
                            // Check if this AI message looks like HTML content that could be applied
                            const isApplyable = msg.role === 'assistant' &&
                                (msg.content.includes('<') || msg.content.includes('</'));

                            return (
                                <div key={msg.id} style={{ marginBottom: '8px' }}>
                                    <div
                                        className={`${styles.aiMessage} ${msg.role === 'user' ? styles.userMessage : ''}`}
                                        style={{ position: 'relative', paddingRight: '28px' }}
                                    >
                                        {msg.content}
                                        <button
                                            onClick={() => copyToClipboard(msg.content, msg.id)}
                                            className={styles.copyButton}
                                            style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                padding: '4px',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                opacity: 0.5,
                                                transition: 'opacity 0.2s',
                                                borderRadius: '4px',
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                                            title="Copy to clipboard"
                                        >
                                            {copiedMsgId === msg.id ? (
                                                <Check size={14} style={{ color: '#22c55e' }} />
                                            ) : (
                                                <Copy size={14} style={{ color: '#6b7280' }} />
                                            )}
                                        </button>
                                    </div>

                                    {/* Apply to Final buttons for AI HTML responses */}
                                    {isApplyable && (
                                        <div style={{
                                            display: 'flex',
                                            gap: '6px',
                                            marginTop: '6px',
                                            paddingLeft: '8px',
                                        }}>
                                            <button
                                                onClick={() => applyToFinal(msg.content, true)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 8px',
                                                    fontSize: '11px',
                                                    background: '#e8f0fe',
                                                    border: '1px solid #4285f4',
                                                    borderRadius: '4px',
                                                    color: '#1a73e8',
                                                    cursor: 'pointer',
                                                }}
                                                title="Apply with track changes"
                                            >
                                                <ArrowRight size={12} />
                                                Apply to Final
                                            </button>
                                            <button
                                                onClick={() => applyToFinal(msg.content, false)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 8px',
                                                    fontSize: '11px',
                                                    background: '#fef3c7',
                                                    border: '1px solid #f59e0b',
                                                    borderRadius: '4px',
                                                    color: '#b45309',
                                                    cursor: 'pointer',
                                                }}
                                                title="Apply directly without track changes"
                                            >
                                                <Zap size={12} />
                                                Direct Apply
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
