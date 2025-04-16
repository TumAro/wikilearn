// src/app/api/explain/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
// Import the prompt generator and response types
import { generateExplainPrompt, GeminiResponseJson, QuizData } from '@/prompts/explainPrompt'; // Use path alias '@'

// Define the structure for the request body
interface RequestBody {
  url?: string;
}

// Define the structure for the data returned by this API route
// Uses QuizData imported from the prompt file
type ResponseData = {
  simplifiedText?: string;
  quizData?: QuizData;
  originalUrl?: string;
  error?: string;
};

// --- Initialize Google AI ---
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    console.error("CRITICAL ERROR: GOOGLE_API_KEY environment variable not set.");
    // In a real app, you might prevent startup or throw a fatal error here.
}
// Initialize SDK - provide empty string if key is missing to avoid early crash,
// but requests will fail later if key is truly absent.
const genAI = new GoogleGenerativeAI(API_KEY || "");

const generationConfig = {
    // Configuration options for Gemini - adjust as needed
    // temperature: 0.7,
    // maxOutputTokens: 4096,
};

const safetySettings = [
    // Configure safety settings - adjust thresholds as necessary
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- API Route Handler ---
export async function POST(request: Request): Promise<NextResponse<ResponseData>> {
  console.log("API route /api/explain hit (POST)");

  // Re-check API key availability for each request for robustness
  if (!API_KEY) {
      console.error("Google API Key is not configured in environment variables.");
      return NextResponse.json({ error: "Server configuration error: Missing API Key." }, { status: 500 });
  }

  try {
    // 1. Parse Request Body
    const body: RequestBody = await request.json();
    const url = body.url;
    console.log("Received URL:", url);

    // 2. Validate Input URL
    if (!url || typeof url !== 'string' || !url.trim()) {
       console.error("Validation Error: URL is missing or invalid");
       return NextResponse.json({ error: 'URL parameter is required and must be a non-empty string' }, { status: 400 });
    }

    // 3. Fetch Wikipedia Content
    let pageTitle = '';
    let wikipediaContent = '';
    let actualWikipediaUrl = '';
    try {
        const urlObject = new URL(url);
        const pathSegments = urlObject.pathname.split('/');
        pageTitle = decodeURIComponent(pathSegments[pathSegments.length - 1]);
        if (!pageTitle) throw new Error("Could not extract page title from URL");

        console.log(`Fetching content directly for Wikipedia page title: ${pageTitle}`);
        const params = new URLSearchParams({
            action: 'query', format: 'json', titles: pageTitle,
            prop: 'extracts|info', inprop: 'url', explaintext: 'true',
            redirects: 'true', origin: '*'
        });
        const wikiApiUrl = `https://en.wikipedia.org/w/api.php?${params.toString()}`;
        console.log(`Calling Wikipedia API: ${wikiApiUrl}`);

        const response = await fetch(wikiApiUrl);
        if (!response.ok) throw new Error(`Wikipedia API request failed with status: ${response.status}`);
        const data = await response.json();
        console.log("Wikipedia API Response (Snippet):", JSON.stringify(data).substring(0, 300) + '...');

        if (!data.query?.pages) throw new Error('Invalid response structure from Wikipedia API');
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];

        if (!pageId || pageId === '-1') {
            const potentialTitle = data.query.normalized?.[0]?.to || data.query.redirects?.[0]?.to || pageTitle;
            console.error(`Page not found for ID: ${pageId}. Original title: ${pageTitle}, Potential resolved title: ${potentialTitle}`);
            throw new Error(`Wikipedia page not found for title: "${potentialTitle}"`);
        }

        const pageData = pages[pageId];
        wikipediaContent = pageData.extract;
        actualWikipediaUrl = pageData.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`;
        pageTitle = pageData.title; // Use title from response (handles redirects/normalization)

        if (!wikipediaContent) {
            console.warn(`No content extract found for page: ${pageTitle}. It might be a disambiguation page.`);
            throw new Error(`No text content found for page: "${pageTitle}". It might be a disambiguation page.`);
        }

        console.log(`Successfully fetched content for: ${pageTitle} (Length: ${wikipediaContent.length})`);
        console.log(`Actual Wikipedia URL: ${actualWikipediaUrl}`);

    } catch (wikiError: any) {
        console.error("Wikipedia Fetch Error:", wikiError);
        let errorMessage = wikiError.message || 'Failed to fetch content from Wikipedia.';
        const status = (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('no text content')) ? 404 : 500;
        return NextResponse.json({ error: errorMessage }, { status: status });
    }

    // 4. Call Google Gemini API
    console.log("Calling Google Gemini API...");
    let simplifiedText = '';
    let quizData: QuizData | null = null;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro-exp-03-25", // Or "gemini-1.5-flash", "gemini-1.5-pro-latest" etc.
            generationConfig,
            safetySettings
        });

        // Generate the prompt using the imported function
        const prompt = generateExplainPrompt(pageTitle, wikipediaContent);
        console.log("Generated Prompt (Snippet):", prompt.substring(0, 400) + '...'); // Log start of prompt

        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text();

        console.log("Gemini Raw Response Text (Snippet):", responseText.substring(0, 500) + '...');

        // Attempt to parse the JSON response from Gemini
        try {
            // Clean potential markdown formatting
            const cleanedResponseText = responseText.replace(/^```json\s*|```$/g, '').trim();

            // Check if response is empty after cleaning
             if (!cleanedResponseText) {
                throw new Error("Received empty response from Gemini after cleaning.");
            }

            const parsedJson: GeminiResponseJson = JSON.parse(cleanedResponseText);

            // Validate parsed structure (basic)
            if (!parsedJson.simplifiedText || !parsedJson.quizData || !Array.isArray(parsedJson.quizData.questions)) {
                console.error("Parsed JSON structure mismatch:", parsedJson);
                throw new Error("Invalid JSON structure received from Gemini.");
            }

            simplifiedText = parsedJson.simplifiedText;
            quizData = parsedJson.quizData;
            console.log("Successfully parsed Gemini response.");

        } catch (parseError: any) {
            console.error("Failed to parse JSON response from Gemini:", parseError);
            console.error("Gemini raw response was:", responseText); // Log the full raw response on parse error
            // Set error message for frontend, keep quizData null
            simplifiedText = `Error: AI failed to provide explanation in the expected format. Details: ${parseError.message}`;
            // Optionally return an error response immediately
            // return NextResponse.json({ error: `AI response parsing failed: ${parseError.message}` }, { status: 502 });
        }

    } catch (aiError: any) {
        console.error("Google Gemini API Error:", aiError);
        // Provide a user-friendly error for the frontend
        simplifiedText = `Error: Could not retrieve explanation from AI service. ${aiError.message || ''}`;
        // quizData remains null
        // Optionally return an error response immediately
        // return NextResponse.json({ error: `AI service request failed: ${aiError.message}` }, { status: 502 });
    }

    // 5. Prepare and Send Final Response
    const responsePayload: ResponseData = {
        simplifiedText: simplifiedText, // Contains either success or error message from AI step
        quizData: quizData ?? undefined, // Include quizData only if it was successfully parsed
        originalUrl: actualWikipediaUrl || url,
    };

    // Determine status code based on whether we have valid simplifiedText and potentially quizData
    // If simplifiedText contains "Error:", maybe return 500 or 502? For now, let's return 200 but frontend can check text.
    const finalStatus = simplifiedText.startsWith("Error:") ? 500 : 200; // Example: Set status based on outcome

    console.log(`Sending final response with status ${finalStatus}`);
    // Return status 200 even if AI failed, but include error in simplifiedText
    // Or adjust status based on `finalStatus` if preferred
    return NextResponse.json(responsePayload, { status: 200 });


  } catch (error: any) {
    // Catch unexpected errors in the overall process
    console.error("API Error (Outer Catch):", error);
    const message = error.message || 'An unexpected server error occurred.';
    return NextResponse.json({ error: `Failed to process request: ${message}` }, { status: 500 });
  }
}