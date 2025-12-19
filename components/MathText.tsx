'use client';

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * MathText component renders text with LaTeX math expressions.
 * Inline math: $...$ 
 * Display math: $$...$$
 */
export default function MathText({ text, className = '' }: { text: string; className?: string }) {
    const renderedHtml = useMemo(() => {
        if (!text) return '';

        // Split by display math first ($$...$$), then inline math ($...$)
        let html = text;

        // Handle display math ($$...$$) - render as block
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
            try {
                return `<div class="math-display my-2">${katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })}</div>`;
            } catch {
                return `<code class="text-red-500">[Math error: ${latex}]</code>`;
            }
        });

        // Handle inline math ($...$) - but not $$
        html = html.replace(/\$([^$]+)\$/g, (_, latex) => {
            try {
                return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
            } catch {
                return `<code class="text-red-500">[${latex}]</code>`;
            }
        });

        return html;
    }, [text]);

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
}
