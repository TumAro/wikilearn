// src/app/api/explain/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
// Import the prompt generator and types
import {
    generatePedagogicalSectionPrompt,
    PedagogicalSectionData,
    PedagogicalDataError,
    QuizData
} from '@/prompts/pedagogicalPrompt'; // Ensure this path is correct

// --- Interfaces ---
interface WikiSection { title: string; level: number; content: string; }
interface ProcessedSection { sectionTitle: string; pedagogicalData: PedagogicalSectionData | PedagogicalDataError; }
type ResponseData = { pageTitle?: string; mainImageUrl?: string | null; sections?: ProcessedSection[]; originalUrl?: string; error?: string; };
interface WikiPageInfo { pageid: number; title: string; fullurl: string; thumbnail?: { source: string; width: number; height: number; }; pageimage?: string; }
interface WikiSectionData { toclevel: number; level: string; line: string; number: string; index: string; fromtitle: string; byteoffset: number; anchor: string; }
interface WikiParseData { title: string; pageid: number; sections: WikiSectionData[]; text?: { '*': string }; wikitext?: { '*': string }; }
interface WikiQueryPage { [pageid: string]: WikiPageInfo; }
interface WikiQueryData { pages: WikiQueryPage; }
interface WikiApiResponse<T> { batchcomplete?: string; query?: WikiQueryData; parse?: T; error?: { code: string; info: string; }; }

// --- Google AI Initialization ---
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    console.error("CRITICAL ERROR: GOOGLE_API_KEY environment variable not set.");
    // Consider throwing an error during server startup in a real application
}
const genAI = new GoogleGenerativeAI(API_KEY || ""); // Initialize even if key is missing, requests will fail later
const generationConfig = {
    // temperature: 0.7, // Example config
};
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// Select appropriate model (Flash is faster/cheaper, Pro might be better quality)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings });


// --- Helper Function fetchWikipediaData ---
async function fetchWikipediaData(pageTitle: string): Promise<{ pageInfo: WikiPageInfo; sections: WikiSection[]; originalUrl: string }> {
    console.log(`Fetching parsed data for: ${pageTitle}`);
    const commonParams = { action: 'query', format: 'json', redirects: 'true', origin: '*' };

    // 1. Get Page Info, Main Image, and confirm title/redirects
    const infoParams = new URLSearchParams({
        ...commonParams,
        prop: 'info|pageimages', inprop: 'url', piprop: 'thumbnail', pithumbsize: '500', titles: pageTitle,
    });
    const infoUrl = `https://en.wikipedia.org/w/api.php?${infoParams.toString()}`;
    console.log("Calling Wiki API (Info):", infoUrl);

    const infoRes = await fetch(infoUrl); // Use global fetch
    console.log(`Wiki API (Info) Status: ${infoRes.status}, OK: ${infoRes.ok}`);
    if (!infoRes.ok) {
        let errorText = `Wikipedia API (info) request failed: ${infoRes.status}`;
        try { const text = await infoRes.text(); errorText += ` - ${text.substring(0, 150)}`; } catch { /* Ignore */ }
        throw new Error(errorText);
    }
    if (typeof infoRes.json !== 'function') throw new Error(`Fetch response (info) missing .json. Status: ${infoRes.status}.`);
    const infoData: WikiApiResponse<never> = await infoRes.json();
    const queryPages = infoData.query?.pages;
    if (!queryPages) throw new Error('Invalid response structure from Wikipedia API (info - no pages)');
    const pageId = Object.keys(queryPages)[0];
    if (!pageId || pageId === '-1') throw new Error(`Wikipedia page not found: "${pageTitle}"`);
    const pageInfo = queryPages[pageId];
    const confirmedTitle = pageInfo.title; const originalUrl = pageInfo.fullurl; const mainImageUrl = pageInfo.thumbnail?.source || null;
    console.log(`Confirmed Page Title: ${confirmedTitle}, Image URL: ${mainImageUrl}`);


    // 2. Get Page Sections and Content (using action=parse)
    const parseParams = new URLSearchParams({
        action: 'parse', format: 'json', page: confirmedTitle, prop: 'sections|wikitext', origin: '*'
    });
    const parseUrl = `https://en.wikipedia.org/w/api.php?${parseParams.toString()}`;
    console.log("Calling Wiki API (Parse):", parseUrl);
    const parseRes = await fetch(parseUrl);
    if (!parseRes.ok) throw new Error(`Wikipedia API (parse) request failed: ${parseRes.status}`);
    if (typeof parseRes.json !== 'function') throw new Error(`Fetch response (parse) missing .json. Status: ${parseRes.status}.`);
    const parseData: WikiApiResponse<WikiParseData> = await parseRes.json();
    const parseResult = parseData.parse;
    const rawWikiText = parseResult?.wikitext?.['*'];
    const apiSections = parseResult?.sections;
    if (!parseResult || !rawWikiText || !apiSections) throw new Error('Invalid response structure from Wikipedia API (parse - missing data)');


    // --- Start NEW Section Splitting Logic (Part 3) ---
    console.log("Starting section splitting...");
    const sections: WikiSection[] = [];
    let currentCharacterIndex = 0; // Use character index tracking

    // Function to clean wikitext (basic removal of templates, refs, etc.) - customize as needed
    function cleanWikiText(text: string): string {
        // Remove simple templates {{...}} (non-greedy)
        let cleaned = text.replace(/\{\{.*?\}\}/gs, '');
        // Remove <ref> tags and their content
        cleaned = cleaned.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
        cleaned = cleaned.replace(/<ref[^>]*\/>/gs, '');
        // Remove HTML comments
        cleaned = cleaned.replace(/<!--.*?-->/gs, '');
        // Remove file/image links [[File:...]] or [[Image:...]]
        cleaned = cleaned.replace(/\[\[(?:File|Image):.*?\]\]/gs, '');
        // Remove simple category links [[Category:...]]
        cleaned = cleaned.replace(/\[\[Category:.*?\]\]/gs, '');
        // Convert remaining wiki links [[Article|Display Text]] or [[Article]] to Display Text or Article
        cleaned = cleaned.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/gs, '$1');
        // Remove bold/italic markers
        cleaned = cleaned.replace(/'''?/g, '');
        // Basic list markers (*, #) - keep for now, maybe handle later
        // Collapse multiple blank lines
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        return cleaned.trim();
    }

    // Add Introduction (text before the first heading offset provided by API)
    // Estimate character index - byte offset isn't reliable for JS strings
    // Refine this by finding the first *actual* heading in the text
    const firstHeadingMatch = rawWikiText.match(/^={2,6}.*?={2,6}/m); // Find first heading anywhere
    const introEndIndex = firstHeadingMatch ? (firstHeadingMatch.index ?? rawWikiText.length) : rawWikiText.length; // End intro at first heading's start

    if (introEndIndex > 0) {
        const introContentRaw = rawWikiText.substring(0, introEndIndex);
        const introContentClean = cleanWikiText(introContentRaw);
        if (introContentClean) {
             sections.push({ title: 'Introduction', level: 1, content: introContentClean });
             console.log(`  Added Introduction, Clean Length: ${introContentClean.length}`);
        }
        currentCharacterIndex = introEndIndex; // Start next section search from here
    }


    // Process API-defined sections
    for (let i = 0; i < apiSections.length; i++) {
        const currentSectionInfo = apiSections[i];
        const nextSectionInfo = apiSections[i + 1];

        // Find the start of the current section's heading *text* in the raw wikitext
        // Search *after* the previous section's content ended
        const headingTextToFind = currentSectionInfo.line;
        const headingLevel = parseInt(currentSectionInfo.level, 10);
        if (isNaN(headingLevel) || headingLevel < 1) {
             console.warn(`  Invalid heading level for "${headingTextToFind}". Skipping.`);
             continue;
        }
        const headingMarker = "=".repeat(headingLevel);
        // Escape regex special characters in the title text
        const escapedHeadingText = headingTextToFind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const headingPattern = new RegExp(`^${headingMarker}\\s*${escapedHeadingText}\\s*${headingMarker}`, "m");

        const searchArea = rawWikiText.substring(currentCharacterIndex);
        const headingMatch = searchArea.match(headingPattern);

        if (!headingMatch || headingMatch.index === undefined) {
            console.warn(`  Could not find heading "${headingTextToFind}" (Level ${headingLevel}) after index ${currentCharacterIndex}.`);
            // Try to advance index based on byte offset as a fallback if heading not found by text match
             const expectedStart = currentSectionInfo.byteoffset;
             if (expectedStart > currentCharacterIndex) {
                 console.warn(`    Advancing index based on byte offset to ${expectedStart}`);
                 currentCharacterIndex = expectedStart;
             } else {
                  // Cannot reliably find start, might need to skip or use next section's info
                   if (nextSectionInfo) {
                       const nextExpectedStart = nextSectionInfo.byteoffset;
                       if (nextExpectedStart > currentCharacterIndex) {
                             currentCharacterIndex = nextExpectedStart; // Jump to next known offset
                             console.warn(`    Jumping index to next section's byte offset ${nextExpectedStart}`);
                       }
                   }
                   // If still stuck, might indicate major parsing issue
             }
            continue; // Skip this section if heading not reliably found
        }

        // Start of content is after the found heading line
        const contentStartIndex = currentCharacterIndex + headingMatch.index + headingMatch[0].length;

        // End of content is the start of the *next* section's heading, or end of text
        let contentEndIndex = rawWikiText.length;
        if (nextSectionInfo) {
             // Find the start of the *next* heading to delimit the current section's content
             const nextHeadingText = nextSectionInfo.line;
             const nextLevel = parseInt(nextSectionInfo.level, 10);
             if (!isNaN(nextLevel) && nextLevel > 0) {
                 const nextMarker = "=".repeat(nextLevel);
                 const nextEscapedHeadingText = nextHeadingText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                 const nextPattern = new RegExp(`^${nextMarker}\\s*${nextEscapedHeadingText}\\s*${nextMarker}`, "m");

                 // Search for the next heading *after* the current content starts
                 const nextSearchArea = rawWikiText.substring(contentStartIndex);
                 const nextMatch = nextSearchArea.match(nextPattern);

                 if (nextMatch && nextMatch.index !== undefined) {
                    contentEndIndex = contentStartIndex + nextMatch.index; // End content just before next heading starts
                 }
             }
        }

        // Extract and clean the content for this section
        const sectionContentRaw = rawWikiText.substring(contentStartIndex, contentEndIndex);
        const sectionContentClean = cleanWikiText(sectionContentRaw);

        if (sectionContentClean) {
            sections.push({
                title: currentSectionInfo.line,
                level: headingLevel,
                content: sectionContentClean
            });
             console.log(`  Added Section "${currentSectionInfo.line}", Clean Length: ${sectionContentClean.length}`);
        } else {
             console.log(`  Section "${currentSectionInfo.line}" has no content after cleaning.`);
        }

        // Update the index for the next search to where this section ended
        currentCharacterIndex = contentEndIndex;
    }
    // --- End NEW Section Splitting Logic ---


    console.log(`Extracted ${sections.length} sections after splitting and cleaning.`);
    sections.forEach((s, index) => {
        console.log(`  [Final Section ${index}] Title: "${s.title}", Level: ${s.level}, Content Length: ${s.content?.length}, Content Snippet: "${s.content?.substring(0, 70).replace(/\n/g, '\\n')}..."`);
    });

    return { pageInfo, sections, originalUrl };
}


// --- API Route Handler (Main POST function) ---
export async function POST(request: Request): Promise<NextResponse<ResponseData>> {
    console.log("API route /api/explain hit (POST) - Pedagogical");
    if (!API_KEY) return NextResponse.json({ error: "Server configuration error: Missing API Key." }, { status: 500 });

    let originalInputUrl: string | undefined;

    try {
        // 1. Parse & Validate Request
        let body: any;
        try { body = await request.json(); } catch (e:any) { return NextResponse.json({ error: `Invalid JSON: ${e.message}` }, { status: 400 }); }
        originalInputUrl = body?.url?.trim();
        if (!originalInputUrl) return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
        let initialPageTitle = '';
        try {
            if (!originalInputUrl.startsWith('http')) throw new Error("Invalid URL start");
            const urlObject = new URL(originalInputUrl);
            if (!urlObject.hostname.endsWith('wikipedia.org')) console.warn("Non-Wikipedia host:", urlObject.hostname);
            initialPageTitle = decodeURIComponent(urlObject.pathname.split('/').filter(Boolean).pop() || '');
            if (!initialPageTitle) throw new Error("Could not extract title");
        } catch (e:any) { return NextResponse.json({ error: `Invalid URL format: ${e.message}` }, { status: 400 }); }
        console.log("Initial title guess:", initialPageTitle);

        // 2. Fetch Wikipedia Data (Calls the updated helper)
        const { pageInfo, sections, originalUrl } = await fetchWikipediaData(initialPageTitle);
        const pageTitle = pageInfo.title;
        const mainImageUrl = pageInfo.thumbnail?.source || null;

        // 3. Filter Sections
    const validSections = sections.filter(s => s.content && s.content.length > 50); // Filter for meaningful content
    if (validSections.length === 0) {
        // THIS BLOCK IS EXECUTING
        console.log(`No substantial content sections found for "${pageTitle}" after filtering.`);
        // IT SHOULD RETURN A 404 ERROR HERE
        return NextResponse.json({ error: `No substantial content sections found for "${pageTitle}". The page might be too short or primarily composed of lists/templates.` }, { status: 404 });
    }
    // Code should only continue here if validSections.length > 0
    console.log(`Processing ${validSections.length} valid sections for AI (Pedagogical).`);

        // 4. Process Each Section with Gemini API
        const processedSectionsPromises = validSections.map(async (section, index): Promise<ProcessedSection> => {
            console.log(`[${index+1}/${validSections.length}] Processing section: "${section.title}" (Pedagogical)`);
            try {
                // Generate the pedagogical prompt using cleaned content
                const prompt = generatePedagogicalSectionPrompt(section.title, section.content, pageTitle);

                const result = await model.generateContent(prompt);
                const response = result.response;
                const responseText = response.text();

                // Robust JSON extraction
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}');
                if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
                    console.error(`[${index+1}] No JSON boundaries found for "${section.title}". Raw:\n${responseText}`);
                    throw new Error("AI response did not contain recognizable JSON.");
                }
                const jsonString = responseText.substring(jsonStart, jsonEnd + 1);

                // Parse using the NEW expected structure
                const parsedJson: PedagogicalSectionData = JSON.parse(jsonString);

                // Validate the NEW structure
                if (!parsedJson.explanation?.coreConcepts || !parsedJson.scaffoldedQuiz?.questions) {
                     console.error(`[${index+1}] Invalid Pedagogical JSON structure for "${section.title}":`, parsedJson);
                    throw new Error("Invalid/incomplete JSON structure received from AI.");
                }

                console.log(`[${index+1}/${validSections.length}] Successfully processed section: "${section.title}" (Pedagogical)`);
                return { sectionTitle: section.title, pedagogicalData: parsedJson };
            } catch (error: any) {
                console.error(`Error processing section "${section.title}" (Pedagogical):`, error.message);
                return { sectionTitle: section.title, pedagogicalData: { error: error.message || 'Unknown AI processing error' } };
            }
        }); // End of validSections.map

        // 5. Wait for all sections
        const finalProcessedSections = await Promise.all(processedSectionsPromises);

        // 6. Prepare and Send Final Response
        const responsePayload: ResponseData = {
            pageTitle: pageTitle, mainImageUrl: mainImageUrl, sections: finalProcessedSections, originalUrl: originalUrl,
        };
        console.log("Sending final successful response with processed pedagogical sections.");
        return NextResponse.json(responsePayload);

    } catch (error: any) {
        // Outer Catch Block
        console.error("API Error (Outer Catch):", error);
        const message = error.message || 'An unexpected server error occurred.';
        const status = error.message?.toLowerCase().includes('not found') ? 404 : 500;
        return NextResponse.json({ error: `Failed to process request: ${message}`, originalUrl: originalInputUrl }, { status: status });
    }
}