import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { tmpdir } from 'os';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
    try {
        const { html, filename = 'document.docx' } = await req.json();

        if (!html) {
            return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 });
        }

        // Create temp files for input and output
        const tempId = randomUUID();
        const inputPath = path.join(tmpdir(), `input-${tempId}.html`);
        const outputPath = path.join(tmpdir(), `output-${tempId}.docx`);

        // Write HTML to temp file
        writeFileSync(inputPath, html);

        // Path to Python script
        const scriptPath = path.join(process.cwd(), 'scripts', 'html_to_docx.py');

        // Run Python script
        const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
            const python = spawn('python3', [scriptPath, '--input', inputPath, '--output', outputPath]);

            let stderr = '';
            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true });
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
                { error: result.error || 'Failed to convert to DOCX' },
                { status: 500 }
            );
        }

        // Read the output file
        let docxBuffer: Buffer;
        try {
            docxBuffer = readFileSync(outputPath);
            unlinkSync(outputPath);
        } catch (err) {
            return NextResponse.json(
                { error: 'Failed to read generated DOCX file' },
                { status: 500 }
            );
        }

        // Return the DOCX file
        return new NextResponse(docxBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('Export DOCX error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
