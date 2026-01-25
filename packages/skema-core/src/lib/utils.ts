// =============================================================================
// Skema Utility Functions
// =============================================================================

/**
 * Convert a Blob to a base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Add a labeled grid overlay to an SVG string
 * Grid uses A/B/C column labels and 0/1/2 row numbers for positioning reference
 * @param svgString - The SVG markup to add grid to
 * @param opts - Grid options (color, cell size, whether to show labels)
 * @returns SVG string with grid overlay added
 */
export function addGridToSvg(
    svgString: string,
    opts: { color?: string; size?: number; labels?: boolean } = {}
): string {
    const { color = '#0066FF', size = 100, labels = true } = opts;

    // Parse SVG to get dimensions
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);
    if (!viewBoxMatch) return svgString;

    const [x, y, w, h] = viewBoxMatch[1].split(' ').map(Number);

    // Build grid lines and labels
    const gridElements: string[] = [];

    // Vertical lines
    for (let i = 0; i <= Math.ceil(w / size); i++) {
        const xPos = i * size;
        if (i > 0) {
            gridElements.push(
                `<line x1="${xPos}" y1="0" x2="${xPos}" y2="${h}" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>`
            );
        }
        if (labels) {
            // Column labels (A, B, C, ...)
            const colLabel = String.fromCharCode(65 + i); // 65 = 'A'
            gridElements.push(
                `<text x="${xPos + size / 2}" y="16" fill="${color}" font-size="12" font-family="sans-serif" text-anchor="middle">${colLabel}</text>`
            );
        }
    }

    // Horizontal lines
    for (let i = 0; i <= Math.ceil(h / size); i++) {
        const yPos = i * size;
        gridElements.push(
            `<line x1="0" y1="${yPos}" x2="${w}" y2="${yPos}" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>`
        );
        if (labels && i < Math.ceil(h / size)) {
            // Row labels (0, 1, 2, ...)
            gridElements.push(
                `<text x="8" y="${yPos + size / 2 + 4}" fill="${color}" font-size="12" font-family="sans-serif">${i}</text>`
            );
        }
    }

    // Create grid group
    const gridGroup = `<g id="skema-grid" transform="translate(${x}, ${y})">${gridElements.join('')}</g>`;

    // Insert grid before closing </svg> tag
    return svgString.replace('</svg>', `${gridGroup}</svg>`);
}

/**
 * Get the grid cell reference (e.g., "B2") for a given position
 * @param x - X coordinate in pixels
 * @param y - Y coordinate in pixels
 * @param gridSize - Size of each grid cell (default 100px)
 * @returns Grid cell reference string (e.g., "B2")
 */
export function getGridCellReference(x: number, y: number, gridSize: number = 100): string {
    const col = Math.floor(x / gridSize);
    const row = Math.floor(y / gridSize);
    const colLabel = String.fromCharCode(65 + col); // 65 = 'A'
    return `${colLabel}${row}`;
}

/**
 * Extract text content from tldraw shapes
 * @param shapes - Array of tldraw shapes
 * @returns Combined text content from text and note shapes
 */
export function extractTextFromShapes(shapes: unknown[]): string {
    const textContent: string[] = [];

    for (const shape of shapes) {
        const s = shape as { type?: string; props?: { text?: string; richText?: unknown } };

        if (s.type === 'text' || s.type === 'note') {
            // Handle plain text
            if (s.props?.text) {
                textContent.push(s.props.text);
            }
            // Handle rich text (newer tldraw versions)
            if (s.props?.richText && typeof s.props.richText === 'object') {
                const rt = s.props.richText as { content?: Array<{ content?: Array<{ text?: string }> }> };
                if (rt.content) {
                    for (const block of rt.content) {
                        if (block.content) {
                            for (const inline of block.content) {
                                if (inline.text) {
                                    textContent.push(inline.text);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return textContent.filter(Boolean).join('\n');
}
