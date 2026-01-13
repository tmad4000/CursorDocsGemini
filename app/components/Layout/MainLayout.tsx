"use client";

import React, { useState, useEffect } from 'react';
import styles from './MainLayout.module.css';
import { PanelLeftClose, PanelLeft, FileText, StickyNote, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEditorContext } from '@/context/EditorContext';

interface MainLayoutProps {
    sidebar: React.ReactNode;
    editor: React.ReactNode;
    notesEditor?: React.ReactNode;
}

export default function MainLayout({ sidebar, editor, notesEditor }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const { notesVisible, setNotesVisible, activePane, setActivePane } = useEditorContext();
    const [notesPaneWidth, setNotesPaneWidth] = useState(40); // percentage

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // Auto-close sidebar on mobile
            if (mobile) {
                setSidebarOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className={styles.container}>
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
                {sidebarOpen && sidebar}
            </aside>

            {/* Mobile overlay when sidebar is open */}
            {isMobile && sidebarOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <main className={styles.editorArea}>
                {/* Top toolbar */}
                <div className={styles.topToolbar}>
                    <button
                        className={styles.toggleButton}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
                    </button>

                    {/* Notes toggle button */}
                    {notesEditor && (
                        <button
                            className={`${styles.notesToggle} ${notesVisible ? styles.notesToggleActive : ''}`}
                            onClick={() => setNotesVisible(!notesVisible)}
                            title={notesVisible ? "Hide notes" : "Show notes"}
                        >
                            <StickyNote size={18} />
                            <span>Notes</span>
                            {notesVisible ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                        </button>
                    )}
                </div>

                {/* Split editor area */}
                <div className={styles.splitContainer}>
                    {/* Notes pane */}
                    {notesEditor && notesVisible && (
                        <div
                            className={`${styles.editorPane} ${styles.notesPane} ${activePane === 'notes' ? styles.activePane : ''}`}
                            style={{ width: `${notesPaneWidth}%` }}
                            onClick={() => setActivePane('notes')}
                        >
                            <div className={styles.paneHeader}>
                                <StickyNote size={16} />
                                <span>Notes & Scratch</span>
                            </div>
                            <div className={styles.paneContent}>
                                {notesEditor}
                            </div>
                        </div>
                    )}

                    {/* Resizer */}
                    {notesEditor && notesVisible && (
                        <div
                            className={styles.resizer}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = notesPaneWidth;
                                const container = e.currentTarget.parentElement;
                                if (!container) return;

                                const onMouseMove = (moveEvent: MouseEvent) => {
                                    const containerWidth = container.clientWidth;
                                    const delta = moveEvent.clientX - startX;
                                    const newWidth = Math.min(70, Math.max(20, startWidth + (delta / containerWidth) * 100));
                                    setNotesPaneWidth(newWidth);
                                };

                                const onMouseUp = () => {
                                    document.removeEventListener('mousemove', onMouseMove);
                                    document.removeEventListener('mouseup', onMouseUp);
                                };

                                document.addEventListener('mousemove', onMouseMove);
                                document.addEventListener('mouseup', onMouseUp);
                            }}
                        />
                    )}

                    {/* Final document pane */}
                    <div
                        className={`${styles.editorPane} ${styles.finalPane} ${activePane === 'final' ? styles.activePane : ''}`}
                        style={{ width: notesVisible ? `${100 - notesPaneWidth}%` : '100%' }}
                        onClick={() => setActivePane('final')}
                    >
                        <div className={styles.paneHeader}>
                            <FileText size={16} />
                            <span>Final Document</span>
                        </div>
                        <div className={styles.paneContent}>
                            {editor}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
