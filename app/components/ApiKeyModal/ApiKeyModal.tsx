"use client";

import React, { useState, useEffect } from 'react';
import styles from './ApiKeyModal.module.css';
import { getStoredApiKey, setStoredApiKey } from '@/lib/openai-client';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string) => void;
}

export default function ApiKeyModal({ isOpen, onClose, onSave }: ApiKeyModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const stored = getStoredApiKey();
            if (stored) {
                setApiKey(stored);
            }
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!apiKey.trim()) {
            setError('Please enter an API key');
            return;
        }
        if (!apiKey.startsWith('sk-')) {
            setError('API key should start with "sk-"');
            return;
        }
        setStoredApiKey(apiKey.trim());
        onSave(apiKey.trim());
        setError('');
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <h2 className={styles.title}>OpenAI API Key</h2>
                <p className={styles.description}>
                    Enter your OpenAI API key to use the AI editor. Your key is stored locally in your browser and never sent to any server except OpenAI.
                </p>
                <input
                    type="password"
                    className={styles.input}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => {
                        setApiKey(e.target.value);
                        setError('');
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.buttons}>
                    <button className={styles.cancelButton} onClick={onClose}>
                        Cancel
                    </button>
                    <button className={styles.saveButton} onClick={handleSave}>
                        Save Key
                    </button>
                </div>
                <p className={styles.hint}>
                    Get your API key from{' '}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                        platform.openai.com/api-keys
                    </a>
                </p>
            </div>
        </div>
    );
}
