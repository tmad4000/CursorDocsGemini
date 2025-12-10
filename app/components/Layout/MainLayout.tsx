import React from 'react';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    sidebar: React.ReactNode;
    editor: React.ReactNode;
}

export default function MainLayout({ sidebar, editor }: MainLayoutProps) {
    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>{sidebar}</aside>
            <main className={styles.editorArea}>{editor}</main>
        </div>
    );
}
