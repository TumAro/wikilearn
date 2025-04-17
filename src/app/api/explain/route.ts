// src/app/api/explain/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import {
    generatePedagogicalSectionPrompt,
    PedagogicalSectionData,
    PedagogicalDataError,
    QuizData
} from '@/prompts/pedagogicalPrompt';

// --- Types ---
interface WikiSection { title: string; level: number; content: string; }
interface ProcessedSection { sectionTitle: string; pedagogicalData: PedagogicalSectionData | PedagogicalDataError; }
interface WikiPageInfo { pageid: number; title: string; fullurl: string; thumbnail?: { source: string; width: number; height: number; }; pageimage?: string; }
interface WikiSectionData { toclevel: number; level: string; line: string; number: string; index: string; fromtitle: string; byteoffset: number; anchor: string; }
interface WikiParseData { title: string; pageid: number; sections: WikiSectionData[]; text?: { '*': string }; wikitext?: { '*': string }; }
interface WikiQueryPage { [pageid: string]: WikiPageInfo; }
interface WikiQueryData { pages: WikiQueryPage; }
interface WikiApiResponse<T> { batchcomplete?: string; query?: WikiQueryData; parse?: T; error?: { code: string; info: string; }; }

// --- Google AI Config (NO DEFAULT KEY HERE) ---
const generationConfig = { /* Your config */ };
const safetySettings = [ /* Your settings */ ];
// Model is initialized inside stream start using user key

// --- Helper Function fetchWikipediaData ---
// *** Using the section splitting logic from BEFORE the byte-offset attempt ***
async function fetchWikipediaData(pageTitle: string): Promise<{ pageInfo: WikiPageInfo; sections: WikiSection[]; originalUrl: string }> {
    console.log(`Helper: Fetching parsed data for: ${pageTitle}`);
    const commonParams = { action: 'query', format: 'json', redirects: 'true', origin: '*' };
    // 1. Get Page Info
    const infoParams = new URLSearchParams({ ...commonParams, prop: 'info|pageimages', inprop: 'url', piprop: 'thumbnail', pithumbsize: '500', titles: pageTitle });
    const infoUrl = `https://en.wikipedia.org/w/api.php?${infoParams.toString()}`;
    const infoRes = await fetch(infoUrl); if (!infoRes.ok) { let e = `Wiki API (info) failed: ${infoRes.status}`; try { const t = await infoRes.text(); e += ` - ${t.substring(0,150)}`; } catch {} throw new Error(e); }
    if (typeof infoRes.json !== 'function') throw new Error(`Fetch response (info) missing .json`);
    const infoData = await infoRes.json(); const queryPages = infoData.query?.pages; if (!queryPages) throw new Error('Wiki API (info) invalid structure');
    const pageId = Object.keys(queryPages)[0]; if (!pageId || pageId === '-1') throw new Error(`Wikipedia page not found: "${pageTitle}"`);
    const pageInfo = queryPages[pageId]; const confirmedTitle = pageInfo.title; const originalUrl = pageInfo.fullurl;
    // 2. Get Sections and Wikitext
    const parseParams = new URLSearchParams({ action: 'parse', format: 'json', page: confirmedTitle, prop: 'sections|wikitext', origin: '*' });
    const parseUrl = `https://en.wikipedia.org/w/api.php?${parseParams.toString()}`;
    const parseRes = await fetch(parseUrl); if (!parseRes.ok) throw new Error(`Wiki API (parse) failed`);
    if (typeof parseRes.json !== 'function') throw new Error(`Fetch response (parse) missing .json`);
    const parseData = await parseRes.json(); const parseResult = parseData.parse; const rawWikiText = parseResult?.wikitext?.['*']; const apiSections = parseResult?.sections;
    if (!parseResult || !rawWikiText || !apiSections) throw new Error('Wiki API (parse) invalid structure');
    // 3. Split Wikitext
    console.log("Helper: Starting REVERTED section splitting logic...");
    const sections: WikiSection[] = []; let currentCharacterIndex = 0;
    function cleanWikiTextMinimal(t: string): string { let c = t.replace(/<ref[^>]*>.*?<\/ref>/gs, '').replace(/<ref[^>]*\/>/gs, '').replace(/<!--.*?-->/gs, ''); return c.trim(); }
    const firstHeadingMatch = rawWikiText.match(/^={2,6}.*?={2,6}/m); const introEndIndex = firstHeadingMatch ? (firstHeadingMatch.index ?? rawWikiText.length) : rawWikiText.length;
    if (introEndIndex > 0) { const introRaw = rawWikiText.substring(0, introEndIndex); const introClean = cleanWikiTextMinimal(introRaw); if (introClean) sections.push({ title: 'Introduction', level: 1, content: introClean }); currentCharacterIndex = introEndIndex; }
    for (let i = 0; i < apiSections.length; i++) { const cur = apiSections[i]; const next = apiSections[i + 1]; const title = cur.line; const lvl = parseInt(cur.level,10); if(isNaN(lvl)||lvl<1) continue; const marker="=".repeat(lvl); const escaped=title.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'); const pattern=new RegExp(`^${marker}\\s*${escaped}\\s*${marker}`,"m"); const search=rawWikiText.substring(currentCharacterIndex); const match=search.match(pattern); if(!match||match.index===undefined){ console.warn(`Helper: Cannot find heading "${title}"`); if(next&&next.byteoffset>currentCharacterIndex){const nextEsc=next.line.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');const nextLvl=parseInt(next.level,10);if(!isNaN(nextLvl)&&nextLvl>0){const nextPat=new RegExp(`^${"=".repeat(nextLvl)}\\s*${nextEsc}\\s*${"=".repeat(nextLvl)}`,"m");const nextMatch=search.match(nextPat);if(nextMatch?.index!==undefined)currentCharacterIndex+=nextMatch.index;}}continue;} const contentStart=currentCharacterIndex+match.index+match[0].length; let contentEnd=rawWikiText.length; let nextHFound=false; if(next){const nextTitle=next.line;const nextLvl=parseInt(next.level,10);if(!isNaN(nextLvl)&&nextLvl>0){const nextMarker="=".repeat(nextLvl);const nextEsc=nextTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');const nextPat=new RegExp(`^${nextMarker}\\s*${nextEsc}\\s*${nextMarker}`,"m");const nextSearch=rawWikiText.substring(contentStart);const nextMatch=nextSearch.match(nextPat);if(nextMatch?.index!==undefined){contentEnd=contentStart+nextMatch.index;nextHFound=true;}}} if(!nextHFound){const anyHMatch=rawWikiText.substring(contentStart).match(/^={2,6}.*?={2,6}/m);if(anyHMatch?.index!==undefined)contentEnd=contentStart+anyHMatch.index;} const rawContent=rawWikiText.substring(contentStart,contentEnd); const cleanContent=cleanWikiTextMinimal(rawContent); if(cleanContent)sections.push({title,level:lvl,content:cleanContent}); currentCharacterIndex=contentEnd;}
    console.log(`Helper: Extracted ${sections.length} sections FINAL.`);
    sections.forEach((s, index) => { console.log(`  [Final Section ${index}] Title: "${s.title}", Len: ${s.content?.length}`); });
    return { pageInfo, sections, originalUrl }; // Ensure correct return
} // --- End of fetchWikipediaData ---


// --- API Route Handler - STREAMING - REQUIRES USER KEY ---
export async function POST(request: Request): Promise<Response> {
    console.log("API route /api/explain hit (POST) - User Key Required");
    const ERROR_MESSAGES = { /* ... Keep error messages object ... */ };

    // *** Declare variables first ***
    let originalInputUrl: string | undefined;
    let validatedInitialPageTitle = '';
    let userApiKey: string | null = null;

    try {
        // 1. Parse Request Body
        let body: any;
        try { body = await request.json(); } catch (e:any) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.INVALID_JSON(e.message) }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

        // *** Assign variables AFTER parsing body ***
        originalInputUrl = body?.url?.trim();
        userApiKey = body?.userApiKey || null; // Extract userApiKey

        // *** Check variables AFTER assignment ***
        if (!userApiKey) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.MISSING_USER_KEY }), { status: 401, headers: { 'Content-Type': 'application/json' } }); }
        if (!originalInputUrl) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.MISSING_URL }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

        // 2. Validate URL Format and Extract Title
        try { if (!originalInputUrl.startsWith('http')) throw new Error("URL must start with http/https"); const urlObj = new URL(originalInputUrl); if (!urlObj.hostname.endsWith('wikipedia.org')) console.warn("Non-Wiki host"); validatedInitialPageTitle = decodeURIComponent(urlObj.pathname.split('/').filter(Boolean).pop() || ''); if (!validatedInitialPageTitle) throw new Error("Could not extract title"); } catch (e:any) { return new Response(JSON.stringify({ error: ERROR_MESSAGES.INVALID_URL_FORMAT(e.message) }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
        console.log("Initial title guess:", validatedInitialPageTitle);

        // --- Setup Stream ---
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                let pageTitleFromWiki = validatedInitialPageTitle;
                let currentModel: any;
                const enqueueJson = (data: object) => { try { controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')); } catch (e) { console.error("Stream enqueue failed:", e); throw e; } };

                try {
                    // Init Gemini SDK WITH USER KEY
                    try { const currentGenAI = new GoogleGenerativeAI(userApiKey as string); currentModel = currentGenAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings }); console.log("Stream: Initialized Gemini."); }
                    catch(initError: any) { throw new Error(ERROR_MESSAGES.INVALID_USER_KEY('Initialization failed')); }

                    // Fetch Wikipedia Data (Uses reverted helper)
                    console.log("Stream: Fetching Wikipedia data for:", pageTitleFromWiki);
                    enqueueJson({ type: 'status', message: 'Fetching Wikipedia article info...' });
                    const wikiData = await fetchWikipediaData(pageTitleFromWiki);
                    const { pageInfo, sections, originalUrl } = wikiData;
                    pageTitleFromWiki = pageInfo.title; const mainImageUrl = pageInfo.thumbnail?.source || null;

                    // Filter Sections
                    const validSections = sections.filter(s => s.content && s.content.length > 20); // Use lower threshold
                    const totalSectionsToProcess = validSections.length;
                    console.log(`Stream: Found ${totalSectionsToProcess} valid sections.`);

                    // Send Initial Page Info
                    enqueueJson({ type: 'initial', data: { pageTitle: pageTitleFromWiki, mainImageUrl, originalUrl, totalSections: totalSectionsToProcess } });
                    if (totalSectionsToProcess === 0) { enqueueJson({ type: 'status', message: 'No substantial content sections found.' }); controller.close(); return; }

                    // Process Sections Sequentially
                    for (const [index, section] of validSections.entries()) {
                         const currentIndex = index;
                         const statusMessage = `Processing section ${currentIndex + 1} of ${totalSectionsToProcess}: "${section.title}"...`;
                         enqueueJson({ type: 'status', message: statusMessage });
                         let pedagogicalDataResult: PedagogicalSectionData | PedagogicalDataError;
                         try {
                             if (!currentModel) throw new Error("Gemini model not initialized.");
                             const prompt = generatePedagogicalSectionPrompt(section.title, section.content, pageTitleFromWiki);
                             const result = await currentModel.generateContent(prompt);
                             const response = result.response; const candidate = response?.candidates?.[0]; if (!candidate) { /* ... handle blocked ... */ } const responseText = candidate.content.parts[0].text ?? ''; const jsonStart = responseText.indexOf('{'); const jsonEnd = responseText.lastIndexOf('}'); if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) throw new Error("Response bad format."); const jsonString = responseText.substring(jsonStart, jsonEnd + 1); let parsedJson: PedagogicalSectionData; try { parsedJson = JSON.parse(jsonString); } catch (e:any) { throw new Error(`Failed to parse AI JSON: ${e.message}`); } if (!parsedJson.explanation?.coreConcepts || !parsedJson.scaffoldedQuiz?.questions) throw new Error("Response invalid structure.");
                             pedagogicalDataResult = parsedJson;
                         } catch (error: any) { if (error.message?.toLowerCase().includes('permission denied') || error.message?.toLowerCase().includes('api key not valid')) { pedagogicalDataResult = { error: ERROR_MESSAGES.INVALID_USER_KEY(error.message) }; } else { pedagogicalDataResult = { error: ERROR_MESSAGES.AI_ERROR(error.message || 'Unknown AI error') }; } }
                         enqueueJson({ type: 'section', data: { sectionTitle: section.title, pedagogicalData: pedagogicalDataResult, currentIndex: currentIndex, totalSections: totalSectionsToProcess } });
                    } // End for loop

                    enqueueJson({ type: 'status', message: 'Processing complete!' }); controller.close();
                } catch (error: any) { // Catch errors DURING stream generation
                    console.error("Stream Error (inside start catch block):", error);
                    try { enqueueJson({ type: 'error', message: error.message || ERROR_MESSAGES.STREAM_ERROR('Unknown error') }); } catch {}
                    controller.close();
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