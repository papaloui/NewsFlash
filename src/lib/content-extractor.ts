// Extracts text content from HTML, focusing on the main content area.
export function extractArticleContent(html: string): string {
    // Remove scripts, styles, and head for cleaner processing
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<head[^>]*>([\S\s]*?)<\/head>/gmi, '');

    // Try to find a main content container
    let mainContentHtml = '';
    const mainPatterns = [
        /<main[^>]*>([\s\S]*?)<\/main>/i,
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<div id="content"[^>]*>([\s\S]*?)<\/div>/i,
        /<div class="post-content"[^>]*>([\s\S]*?)<\/div>/i,
        /<div class="entry-content"[^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (const pattern of mainPatterns) {
        const match = cleanHtml.match(pattern);
        if (match && match[1]) {
            mainContentHtml = match[1];
            break;
        }
    }

    // If no main container is found, use the whole body content as a fallback
    if (!mainContentHtml) {
        const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        mainContentHtml = bodyMatch ? bodyMatch[1] : cleanHtml;
    }

    // Extract content from <p> tags within the main content
    const pTagRegex = /<p[^>]*>(.*?)<\/p>/g;
    let pMatch;
    const paragraphs: string[] = [];
    while ((pMatch = pTagRegex.exec(mainContentHtml)) !== null) {
        // Strip inner tags from paragraph and trim whitespace
        const paragraphText = pMatch[1].replace(/<[^>]+>/g, '').trim();
        // Only include paragraphs with meaningful content
        if (paragraphText.length > 20 && paragraphText.includes(' ')) {
            paragraphs.push(paragraphText);
        }
    }

    if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
    }

    // Fallback: strip all tags from the main content if no suitable <p> tags found
    return mainContentHtml.replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
}
