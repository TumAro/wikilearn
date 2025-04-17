// src/app/api/explain/route.ts
import { NextResponse } from 'next/server'; // Keep for potential error responses BEFORE streaming starts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import {
    generatePedagogicalSectionPrompt,
    PedagogicalSectionData,
    PedagogicalDataError,
    QuizData
} from '@/prompts/pedagogicalPrompt'; // Ensure path is correct

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
const generationConfig = { /* Your config */ };
const safetySettings = [ /* Your settings */ ];
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings });

// --- Helper Function fetchWikipediaData ---
async function fetchWikipediaData(pageTitle: string): Promise<{ pageInfo: WikiPageInfo; sections: WikiSection[]; originalUrl: string }> {
    console.log(`Fetching parsed data for: ${pageTitle}`);
    const commonParams = { action: 'query', format: 'json', redirects: 'true', origin: '*' };
    // 1. Get Page Info...
    const infoParams = new URLSearchParams({ ...commonParams, prop: 'info|pageimages', inprop: 'url', piprop: 'thumbnail', pithumbsize: '500', titles: pageTitle });
    const infoUrl = `https://en.wikipedia.org/w/api.php?${infoParams.toString()}`;
    console.log("Calling Wiki API (Info):", infoUrl);
    const infoRes = await fetch(infoUrl);
    console.log(`Wiki API (Info) Status: ${infoRes.status}, OK: ${infoRes.ok}`);
    if (!infoRes.ok) { let e = `Wiki API (info) request failed: ${infoRes.status}`; try { const t = await infoRes.text(); e += ` - ${t.substring(0,150)}`; } catch {} throw new Error(e); }
    if (typeof infoRes.json !== 'function') throw new Error(`Fetch response (info) missing .json. Status: ${infoRes.status}.`);
    const infoData: WikiApiResponse<never> = await infoRes.json();
    const queryPages = infoData.query?.pages; if (!queryPages) throw new Error('Invalid response structure (info)');
    const pageId = Object.keys(queryPages)[0]; if (!pageId || pageId === '-1') throw new Error(`Wikipedia page not found: "${pageTitle}"`);
    const pageInfo = queryPages[pageId]; const confirmedTitle = pageInfo.title; const originalUrl = pageInfo.fullurl; const mainImageUrl = pageInfo.thumbnail?.source || null;
    console.log(`Confirmed Page Title: ${confirmedTitle}, Image URL: ${mainImageUrl}`);
    // 2. Get Page Sections and Content...
    const parseParams = new URLSearchParams({ action: 'parse', format: 'json', page: confirmedTitle, prop: 'sections|wikitext', origin: '*' });
    const parseUrl = `https://en.wikipedia.org/w/api.php?${parseParams.toString()}`;
    console.log("Calling Wiki API (Parse):", parseUrl);
    const parseRes = await fetch(parseUrl); if (!parseRes.ok) throw new Error(`Wiki API (parse) failed: ${parseRes.status}`);
    if (typeof parseRes.json !== 'function') throw new Error(`Fetch response (parse) missing .json. Status: ${parseRes.status}.`);
    const parseData: WikiApiResponse<WikiParseData> = await parseRes.json();
    const parseResult = parseData.parse; const rawWikiText = parseResult?.wikitext?.['*']; const apiSections = parseResult?.sections;
    if (!parseResult || !rawWikiText || !apiSections) throw new Error('Invalid response structure (parse)');
    // 3. Split Wikitext into Sections...
    console.log("Starting section splitting..."); const sections: WikiSection[] = []; let currentCharacterIndex = 0;
    function cleanWikiText(t: string): string { let c=t.replace(/\{\{.*?\}\}/gs,'').replace(/<ref[^>]*>.*?<\/ref>/gs,'').replace(/<ref[^>]*\/>/gs,'').replace(/<!--.*?-->/gs,'').replace(/\[\[(?:File|Image):.*?\]\]/gs,'').replace(/\[\[Category:.*?\]\]/gs,'').replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/gs,'$1').replace(/'''?/g,'').replace(/\n{3,}/g,'\n\n'); return c.trim(); }
    const firstHeadingMatch = rawWikiText.match(/^={2,6}.*?={2,6}/m); const introEndIndex = firstHeadingMatch ? (firstHeadingMatch.index ?? rawWikiText.length) : rawWikiText.length;
    if (introEndIndex > 0) { const introRaw = rawWikiText.substring(0, introEndIndex); const introClean = cleanWikiText(introRaw); if (introClean) sections.push({ title: 'Introduction', level: 1, content: introClean }); currentCharacterIndex = introEndIndex; }
    for (let i = 0; i < apiSections.length; i++) { const cur = apiSections[i]; const next = apiSections[i+1]; const title = cur.line; const lvl = parseInt(cur.level,10); if(isNaN(lvl)||lvl<1) continue; const marker="=".repeat(lvl); const escaped=title.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'); const pattern=new RegExp(`^${marker}\\s*${escaped}\\s*${marker}`,"m"); const search=rawWikiText.substring(currentCharacterIndex); const match=search.match(pattern); if(!match||match.index===undefined){ console.warn(`No heading "${title}" L${lvl}`); const exp=cur.byteoffset; if(exp>currentCharacterIndex) currentCharacterIndex=exp; else if(next&&next.byteoffset>currentCharacterIndex) currentCharacterIndex=next.byteoffset; continue; } const contentStart=currentCharacterIndex+match.index+match[0].length; let contentEnd=rawWikiText.length; if(next){ const nextTitle=next.line; const nextLvl=parseInt(next.level,10); if(!isNaN(nextLvl)&&nextLvl>0){const nextMarker="=".repeat(nextLvl); const nextEsc=nextTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'); const nextPat=new RegExp(`^${nextMarker}\\s*${nextEsc}\\s*${nextMarker}`,"m"); const nextSearch=rawWikiText.substring(contentStart); const nextMatch=nextSearch.match(nextPat); if(nextMatch&&nextMatch.index!==undefined) contentEnd=contentStart+nextMatch.index;}} const rawContent=rawWikiText.substring(contentStart,contentEnd); const cleanContent=cleanWikiText(rawContent); if(cleanContent) sections.push({title, level:lvl, content:cleanContent}); currentCharacterIndex=contentEnd;}
    console.log(`Extracted ${sections.length} sections.`);
    return { pageInfo, sections, originalUrl };
} // --- End of fetchWikipediaData ---


// --- API Route Handler - STREAMING ---
export async function POST(request: Request): Promise<Response> {
    console.log("API route /api/explain hit (POST) - STREAMING");
    if (!API_KEY) { return new Response(JSON.stringify({ error: "Server config error: Missing API Key." }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }

    let originalInputUrl: string | undefined;
    let initialPageTitle = '';

    try {
        // 1. Parse & Validate Request (BEFORE stream starts)
        let body: any;
        try { body = await request.json(); } catch (e:any) { return new Response(JSON.stringify({ error: `Invalid JSON: ${e.message}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
        originalInputUrl = body?.url?.trim();
        if (!originalInputUrl) return new Response(JSON.stringify({ error: 'URL parameter is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        try { if (!originalInputUrl.startsWith('http')) throw new Error("Invalid URL start"); const urlObj = new URL(originalInputUrl); if (!urlObj.hostname.endsWith('wikipedia.org')) console.warn("Non-Wiki host"); initialPageTitle = decodeURIComponent(urlObj.pathname.split('/').filter(Boolean).pop() || ''); if (!initialPageTitle) throw new Error("Could not extract title"); } catch (e:any) { return new Response(JSON.stringify({ error: `Invalid URL format: ${e.message}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
        console.log("Initial title guess:", initialPageTitle);

        // --- Setup Stream ---
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // 2. Fetch Initial Wikipedia Data (inside stream)
                    console.log("Stream: Fetching Wikipedia data...");
                    const { pageInfo, sections, originalUrl } = await fetchWikipediaData(initialPageTitle);
                    const pageTitle = pageInfo.title; const mainImageUrl = pageInfo.thumbnail?.source || null;

                    // 3. Send Initial Page Info chunk
                    const initialData = { type: 'initial', data: { pageTitle, mainImageUrl, originalUrl } };
                    controller.enqueue(encoder.encode(JSON.stringify(initialData) + '\n'));
                    console.log("Stream: Sent initial data.");

                    // 4. Filter Sections
                    const validSections = sections.filter(s => s.content && s.content.length > 50);
                    if (validSections.length === 0) { console.log(`Stream: No substantial content sections found.`); controller.close(); return; }
                    console.log(`Stream: Processing ${validSections.length} valid sections sequentially.`);

                    // 5. Process Sections Sequentially and Stream Results
                    for (const [index, section] of validSections.entries()) {
                        console.log(`Stream: [${index + 1}/${validSections.length}] Processing section: "${section.title}"`);
                        let pedagogicalDataResult: PedagogicalSectionData | PedagogicalDataError;
                        try {
                            const prompt = generatePedagogicalSectionPrompt(section.title, section.content, pageTitle);
                            const result = await model.generateContent(prompt);
                            const response = result.response; const responseText = response.text();
                            const jsonStart = responseText.indexOf('{'); const jsonEnd = responseText.lastIndexOf('}');
                            if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) throw new Error("AI response bad format.");
                            const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
                            const parsedJson: PedagogicalSectionData = JSON.parse(jsonString);
                            if (!parsedJson.explanation?.coreConcepts || !parsedJson.scaffoldedQuiz?.questions) throw new Error("AI response invalid structure.");
                            pedagogicalDataResult = parsedJson;
                            console.log(`Stream: [${index + 1}/${validSections.length}] Success for section: "${section.title}"`);
                        } catch (error: any) {
                            console.error(`Stream Error processing section "${section.title}":`, error.message);
                            pedagogicalDataResult = { error: error.message || 'Unknown AI error' };
                        }
                        // Send processed section data chunk
                        const sectionData = { type: 'section', data: { sectionTitle: section.title, pedagogicalData: pedagogicalDataResult } };
                        controller.enqueue(encoder.encode(JSON.stringify(sectionData) + '\n'));
                        console.log(`Stream: Sent data for section "${section.title}"`);
                        // Optional delay: await new Promise(resolve => setTimeout(resolve, 200));
                    } // End for loop

                    console.log("Stream: All sections processed. Closing stream.");
                    controller.close(); // Close the stream when done

                } catch (error: any) { // Handle errors during stream generation
                    console.error("Stream Error (inside start):", error);
                    const errorData = { type: 'error', message: `Stream generation failed: ${error.message}`, originalUrl: originalInputUrl };
                    try { controller.enqueue(encoder.encode(JSON.stringify(errorData) + '\n')); } catch {}
                    controller.close();
                }
            } // End start(controller)
        }); // End new ReadableStream

        // Return the stream response
        return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' } });

    } catch (error: any) { // Catch errors BEFORE starting the stream
        console.error("API Error (Outer Catch - Pre-Stream):", error);
        const message = error.message || 'Unexpected server error.';
        return new Response(JSON.stringify({ error: `Failed to process request: ${message}`, originalUrl: originalInputUrl }), {
             status: error.message?.toLowerCase().includes('not found') ? 404 : 500, headers: { 'Content-Type': 'application/json' }
        });
    }
} // --- End of POST Handler ---