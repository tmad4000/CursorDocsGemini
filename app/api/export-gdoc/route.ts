import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
    try {
        const { html, title = 'AI Docs Export' } = await req.json();

        if (!html) {
            return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 });
        }

        // Create temp file for input
        const tempId = randomUUID();
        const inputPath = path.join(tmpdir(), `input-${tempId}.html`);

        // Write HTML to temp file
        writeFileSync(inputPath, html);

        // Path to Python script and credentials
        const scriptPath = path.join(process.cwd(), 'scripts', 'html_to_gdoc.py');
        const credentialsPath = path.join(process.cwd(), 'service-account.json');

        // Run Python script
        const result = await new Promise<{ success: boolean; url?: string; error?: string }>((resolve) => {
            const python = spawn('python3', [
                scriptPath,
                '--input', inputPath,
                '--title', title,
                '--credentials', credentialsPath,
                '--json'
            ]);

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout.trim());
                        if (result.error) {
                            resolve({ success: false, error: result.error });
                        } else {
                            resolve({ success: true, url: result.url });
                        }
                    } catch {
                        resolve({ success: false, error: 'Failed to parse response' });
                    }
                } else {
                    resolve({ success: false, error: stderr || `Process exited with code ${code}` });
                }
            });

            python.on('error', (err) => {
                resolve({ success: false, error: `Failed to start Python: ${err.message}` });
            });
        });

        // Clean up input file
        try {
            unlinkSync(inputPath);
        } catch { /* ignore */ }

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to create Google Doc' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            url: result.url,
            message: 'Google Doc created successfully'
        });
    } catch (error) {
        console.error('Export Google Doc error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
