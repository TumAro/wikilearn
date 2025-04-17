// src/app/api/explain/route.ts
import { NextResponse } from 'next/server'; // Keep for potential error responses BEFORE streaming starts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import {
    generatePedagogicalSectionPrompt,
    PedagogicalSectionData,
    PedagogicalDataError,
    QuizData
} from '@/prompts/pedagogicalPrompt'; // Ensure this path is correct

// --- Define Section & Response Structures ---
interface WikiSection { title: string; level: number; content: string; }
// Structure for each processed section (used internally and for streaming chunks)
interface ProcessedSection {
    sectionTitle: string;
    pedagogicalData: PedagogicalSectionData | PedagogicalDataError;
}
// --- Interfaces for Wikipedia API Responses ---
interface WikiPageInfo { pageid: number; title: string; fullurl: string; thumbnail?: { source: string; width: number; height: number; }; pageimage?: string; }
interface WikiSectionData { toclevel: number; level: string; line: string; number: string; index: string; fromtitle: string; byteoffset: number; anchor: string; }
interface WikiParseData { title: string; pageid: number; sections: WikiSectionData[]; text?: { '*': string }; wikitext?: { '*': string }; }
interface WikiQueryPage { [pageid: string]: WikiPageInfo; }
interface WikiQueryData { pages: WikiQueryPage; }
interface WikiApiResponse<T> { batchcomplete?: string; query?: WikiQueryData; parse?: T; error?: { code: string; info: string; }; }

// --- Google AI Initialization ---
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) console.error("CRITICAL ERROR: GOOGLE_API_KEY environment variable not set.");
const genAI = new GoogleGenerativeAI(API_KEY || "");
const generationConfig = {
    // temperature: 0.7, // Example config
};
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings });


// --- Helper Function fetchWikipediaData ---
async function fetchWikipediaData(pageTitle: string): Promise<{ pageInfo: WikiPageInfo; sections: WikiSection[]; originalUrl: string }> {
    console.log(`Helper: Fetching parsed data for: ${pageTitle}`);
    const commonParams = { action: 'query', format: 'json', redirects: 'true', origin: '*' };

    // 1. Get Page Info, Main Image, and confirm title/redirects
    const infoParams = new URLSearchParams({ ...commonParams, prop: 'info|pageimages', inprop: 'url', piprop: 'thumbnail', pithumbsize: '500', titles: pageTitle });
    const infoUrl = `https://en.wikipedia.org/w/api.php?${infoParams.toString()}`;
    console.log("Helper: Calling Wiki API (Info):", infoUrl);
    const infoRes = await fetch(infoUrl);
    console.log(`Helper: Wiki API (Info) Status: ${infoRes.status}, OK: ${infoRes.ok}`);
    if (!infoRes.ok) { let e = `Wiki API (info) request failed: ${infoRes.status}`; try { const t = await infoRes.text(); e += ` - ${t.substring(0,150)}`; } catch {} throw new Error(e); }
    if (typeof infoRes.json !== 'function') throw new Error(`Fetch response (info) missing .json. Status: ${infoRes.status}.`);
    const infoData: WikiApiResponse<never> = await infoRes.json();
    const queryPages = infoData.query?.pages; if (!queryPages) throw new Error('Invalid response structure (info)');
    const pageId = Object.keys(queryPages)[0]; if (!pageId || pageId === '-1') throw new Error(`Wikipedia page not found: "${pageTitle}"`); // Specific error
    const pageInfo = queryPages[pageId]; const confirmedTitle = pageInfo.title; const originalUrl = pageInfo.fullurl;
    console.log(`Helper: Confirmed Page Title: ${confirmedTitle}`);

    // 2. Get Page Sections and Content (using action=parse)
    const parseParams = new URLSearchParams({ action: 'parse', format: 'json', page: confirmedTitle, prop: 'sections|wikitext', origin: '*' });
    const parseUrl = `https://en.wikipedia.org/w/api.php?${parseParams.toString()}`;
    console.log("Helper: Calling Wiki API (Parse):", parseUrl);
    const parseRes = await fetch(parseUrl); if (!parseRes.ok) throw new Error(`Wiki API (parse) failed: ${parseRes.status}`);
    if (typeof parseRes.json !== 'function') throw new Error(`Fetch response (parse) missing .json`);
    const parseData: WikiApiResponse<WikiParseData> = await parseRes.json();
    const parseResult = parseData.parse; const rawWikiText = parseResult?.wikitext?.['*']; const apiSections = parseResult?.sections;
    if (!parseResult || !rawWikiText || !apiSections) throw new Error('Invalid response structure (parse)');

    // 3. Split Wikitext into Sections
    console.log("Helper: Starting section splitting...");
    const sections: WikiSection[] = []; let currentCharacterIndex = 0;
    function cleanWikiText(t: string): string { let c=t.replace(/\{\{.*?\}\}/gs,'').replace(/<ref[^>]*>.*?<\/ref>/gs,'').replace(/<ref[^>]*\/>/gs,'').replace(/<!--.*?-->/gs,'').replace(/\[\[(?:File|Image|Category):.*?\]\]/gs,'').replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/gs,'$1').replace(/'''?/g,'').replace(/\n{3,}/g,'\n\n'); return c.trim();}
    const firstHeadingMatch = rawWikiText.match(/^={2,6}.*?={2,6}/m); const introEndIndex = firstHeadingMatch ? (firstHeadingMatch.index ?? rawWikiText.length) : rawWikiText.length;
    if (introEndIndex > 0) { const introRaw = rawWikiText.substring(0, introEndIndex); const introClean = cleanWikiText(introRaw); if (introClean) sections.push({ title: 'Introduction', level: 1, content: introClean }); currentCharacterIndex = introEndIndex; }
    for (let i = 0; i < apiSections.length; i++) { const cur = apiSections[i]; const next = apiSections[i+1]; const title = cur.line; const lvl = parseInt(cur.level,10); if(isNaN(lvl)||lvl<1) continue; const marker="=".repeat(lvl); const escaped=title.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'); const pattern=new RegExp(`^${marker}\\s*${escaped}\\s*${marker}`,"m"); const search=rawWikiText.substring(currentCharacterIndex); const match=search.match(pattern); if(!match||match.index===undefined){ console.warn(`Helper: No heading "${title}" L${lvl}`); const exp=cur.byteoffset; if(exp>currentCharacterIndex) currentCharacterIndex=exp; else if(next&&next.byteoffset>currentCharacterIndex) currentCharacterIndex=next.byteoffset; continue; } const contentStart=currentCharacterIndex+match.index+match[0].length; let contentEnd=rawWikiText.length; if(next){ const nextTitle=next.line; const nextLvl=parseInt(next.level,10); if(!isNaN(nextLvl)&&nextLvl>0){const nextMarker="=".repeat(nextLvl); const nextEsc=nextTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'); const nextPat=new RegExp(`^${nextMarker}\\s*${nextEsc}\\s*${nextMarker}`,"m"); const nextSearch=rawWikiText.substring(contentStart); const nextMatch=nextSearch.match(nextPat); if(nextMatch&&nextMatch.index!==undefined) contentEnd=contentStart+nextMatch.index;}} const rawContent=rawWikiText.substring(contentStart,contentEnd); const cleanContent=cleanWikiText(rawContent); if(cleanContent) sections.push({title, level:lvl, content:cleanContent}); currentCharacterIndex=contentEnd;}
    console.log(`Helper: Extracted ${sections.length} sections.`);

    // Final return of the helper function
    return { pageInfo, sections, originalUrl };
} // --- End of fetchWikipediaData ---


// --- API Route Handler - STREAMING ---
export async function POST(request: Request): Promise<Response> {
    console.log("API route /api/explain hit (POST) - STREAMING+INFO");
    const ERROR_MESSAGES = {
        MISSING_KEY: "CONFIG_ERROR: Missing API Key.",
        INVALID_JSON: (msg: string) => `INPUT_ERROR: Invalid JSON: ${msg}`,
        MISSING_URL: "INPUT_ERROR: URL parameter is required.",
        INVALID_URL_FORMAT: (msg: string) => `INPUT_ERROR: Invalid URL format: ${msg}`,
        WIKI_FETCH_FAILED: (msg: string) => `WIKI_FETCH_ERROR: ${msg}`,
        WIKI_PAGE_NOT_FOUND: (title: string) => `WIKI_NOT_FOUND_ERROR: Wikipedia page not found: "${title}"`,
        NO_SECTIONS: (title: string) => `PROCESSING_ERROR: No substantial content sections found for "${title}".`,
        AI_ERROR: (msg: string) => `AI_ERROR: ${msg}`,
        STREAM_ERROR: (msg: string) => `STREAM_ERROR: ${msg}`,
        UNKNOWN: "UNKNOWN_ERROR: An unexpected server error occurred.",
    };

    if (!API_KEY) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.MISSING_KEY }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }

    let originalInputUrl: string | undefined;
    let validatedInitialPageTitle = ''; // Renamed variable for clarity

    try {
        // 1. Parse & Validate Request (Define validatedInitialPageTitle here)
        let body: any;
        try { body = await request.json(); } catch (e:any) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.INVALID_JSON(e.message) }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
        originalInputUrl = body?.url?.trim();
        if (!originalInputUrl) return new Response(JSON.stringify({ error: ERROR_MESSAGES.MISSING_URL }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        try {
            if (!originalInputUrl.startsWith('http')) throw new Error("URL must start with http/https");
            const urlObj = new URL(originalInputUrl); if (!urlObj.hostname.endsWith('wikipedia.org')) console.warn("Non-Wiki host");
            // Assign to the variable in this scope
            validatedInitialPageTitle = decodeURIComponent(urlObj.pathname.split('/').filter(Boolean).pop() || '');
            if (!validatedInitialPageTitle) throw new Error("Could not extract title");
        } catch (e:any) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.INVALID_URL_FORMAT(e.message) }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
        console.log("Initial title guess:", validatedInitialPageTitle);

        // --- Setup Stream ---
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // Use the validated title from the outer scope
                let pageTitleFromWiki = validatedInitialPageTitle;
                try {
                    // Helper to enqueue JSON safely
                    const enqueueJson = (data: object) => {
                        try { controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')); }
                        catch (e) { console.error("Stream enqueue failed (likely closed):", e); throw e; } // Re-throw to stop processing
                    };

                    // 2. Fetch Initial Wikipedia Data
                    console.log("Stream: Fetching Wikipedia data for:", pageTitleFromWiki);
                    enqueueJson({ type: 'status', message: 'Fetching Wikipedia article info...' });
                    let wikiData;
                    try {
                        // Pass the correct title variable
                        wikiData = await fetchWikipediaData(pageTitleFromWiki);
                    } catch (wikiError: any) {
                         if (wikiError.message?.toLowerCase().includes('not found')) { throw new Error(ERROR_MESSAGES.WIKI_PAGE_NOT_FOUND(pageTitleFromWiki)); } // Use correct title var
                         throw new Error(ERROR_MESSAGES.WIKI_FETCH_FAILED(wikiError.message || 'Unknown fetch error'));
                    }
                    const { pageInfo, sections, originalUrl } = wikiData;
                    pageTitleFromWiki = pageInfo.title; // Update with confirmed title
                    const mainImageUrl = pageInfo.thumbnail?.source || null;

                    // 3. Filter Sections & Get Total Count
                    const validSections = sections.filter(s => s.content && s.content.length > 20); // Keep adjusted filter
                    const totalSectionsToProcess = validSections.length;
                    console.log(`Stream: Found ${totalSectionsToProcess} valid sections.`);

                    // 4. Send Initial Page Info
                    enqueueJson({ type: 'initial', data: { pageTitle: pageTitleFromWiki, mainImageUrl, originalUrl, totalSections: totalSectionsToProcess } });
                    if (totalSectionsToProcess === 0) { enqueueJson({ type: 'status', message: 'No substantial content sections found.' }); controller.close(); return; }

                    // 5. Process Sections Sequentially
                    for (const [index, section] of validSections.entries()) {
                        const currentIndex = index;
                        const statusMessage = `Processing section ${currentIndex + 1} of ${totalSectionsToProcess}: "${section.title}"...`;
                        console.log(`Stream: ${statusMessage}`);
                        enqueueJson({ type: 'status', message: statusMessage });

                        let pedagogicalDataResult: PedagogicalSectionData | PedagogicalDataError;
                        try {
                            // Pass the confirmed page title from wiki fetch
                            const prompt = generatePedagogicalSectionPrompt(section.title, section.content, pageTitleFromWiki);
                            const result = await model.generateContent(prompt);
                            const response = result.response; const candidate = response?.candidates?.[0];
                            if (!candidate) { const blockReason = response?.promptFeedback?.blockReason; throw new Error(`AI processing blocked. Reason: ${blockReason || 'Safety settings'}`); }
                            const responseText = candidate.content.parts[0].text ?? '';
                            const jsonStart = responseText.indexOf('{'); const jsonEnd = responseText.lastIndexOf('}');
                            if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) throw new Error("Response bad format.");
                            const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
                            let parsedJson: PedagogicalSectionData;
                            try { parsedJson = JSON.parse(jsonString); } catch (e:any) { throw new Error(`Failed to parse AI JSON: ${e.message}`); }
                            if (!parsedJson.explanation?.coreConcepts || !parsedJson.scaffoldedQuiz?.questions) throw new Error("Response invalid structure.");
                            pedagogicalDataResult = parsedJson;
                        } catch (error: any) {
                            console.error(`Stream Error processing section "${section.title}":`, error);
                            pedagogicalDataResult = { error: ERROR_MESSAGES.AI_ERROR(error.message || 'Unknown AI error') };
                        }
                        // Send processed section data chunk
                        enqueueJson({ type: 'section', data: { sectionTitle: section.title, pedagogicalData: pedagogicalDataResult, currentIndex: currentIndex, totalSections: totalSectionsToProcess } });
                        // Optional delay: await new Promise(resolve => setTimeout(resolve, 200));
                    } // End for loop

                    enqueueJson({ type: 'status', message: 'Processing complete!' });
                    console.log("Stream: All sections processed. Closing stream.");
                    controller.close(); // Close normally

                } catch (error: any) { // Catch errors DURING stream generation
                    console.error("Stream Error (inside start catch block):", error);
                    // Send the specific error message down the stream
                    try { enqueueJson({ type: 'error', message: error.message || ERROR_MESSAGES.STREAM_ERROR('Unknown error') }); }
                    catch (enqueueErr) { console.error("Failed to enqueue final error message:", enqueueErr); }
                    finally { controller.close(); } // Always close the stream on error
                }
            } // End start(controller)
        }); // End new ReadableStream
        return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' } });
    } catch (error: any) { // Catch errors BEFORE starting the stream
        console.error("API Error (Outer Catch - Pre-Stream):", error);
        const message = error.message || ERROR_MESSAGES.UNKNOWN;
        const status = message.toLowerCase().includes('not found') ? 404 : 500;
        return new Response(JSON.stringify({ error: message }), { status: status, headers: { 'Content-Type': 'application/json' } });
    }
} // --- End of POST Handler ---