"use client";

import React, { useState, useEffect } from 'react';
import styles from './MainLayout.module.css';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

interface MainLayoutProps {
    sidebar: React.ReactNode;
    editor: React.ReactNode;
}

export default function MainLayout({ sidebar, editor }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

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
                <button
                    className={styles.toggleButton}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                    {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
                </button>
                <div className={styles.editorWrapper}>
                    {editor}
                </div>
            </main>
        </div>
    );
}
