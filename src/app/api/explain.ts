// src/app/api/explain/route.ts
import { NextResponse } from 'next/server';

// Define types for better code safety
interface RequestBody {
  url?: string; // Make URL optional to handle cases where it might be missing
}

type ResponseData = {
  simplifiedText?: string;
  quizData?: any;
  originalUrl?: string;
  error?: string;
};

// This function handles POST requests to /api/explain
export async function POST(request: Request): Promise<NextResponse<ResponseData>> {
  console.log("API route /api/explain hit (POST)"); // Log when the route is called

  try {
    // 1. Get the request body as JSON
    const body: RequestBody = await request.json();
    const url = body.url; // Extract the URL

    console.log("Received URL:", url); // Log the received URL

    // 2. Validate the URL
    if (!url || typeof url !== 'string' || !url.trim()) {
       console.error("Validation Error: URL is missing or invalid");
       return NextResponse.json({ error: 'URL parameter is required and must be a non-empty string' }, { status: 400 }); // Bad Request
    }

    // --- Placeholder for your core logic ---
    console.log("Fetching Wikipedia content for:", url);
    // TODO: Step 1: Fetch content from Wikipedia API using 'url'
    // Example: const wikipediaContent = await fetchWikipedia(url);

    console.log("Calling AI API...");
    // TODO: Step 2: Call your chosen AI API with the fetched content
    // Example: const aiResponse = await callAI(wikipediaContent);

    // TODO: Step 3: Process the AI response
    // Example: const simplifiedText = aiResponse.simplified;
    // Example: const quizData = aiResponse.quiz;
    // --- ---

    // **Temporary Placeholder Response** (Replace with actual data)
    const simplifiedText = `This is a placeholder explanation for the page: ${url}. The real AI processing needs to be implemented.`;
    const quizData = {
        questions: [
            { id: 1, text: "Placeholder Question 1?", options: ["A", "B", "C"], answer: "A" },
            { id: 2, text: "Placeholder Question 2?", options: ["X", "Y", "Z"], answer: "Y" }
        ]
    };
    const originalUrl = url;
    // --- ---

    console.log("Sending successful response");
    // 4. Return the successful response
    return NextResponse.json({ simplifiedText, quizData, originalUrl });

  } catch (error: any) { // Catch any errors during the process
    console.error("API Error:", error);

    // Handle potential JSON parsing errors from request.json()
    if (error instanceof SyntaxError) {
         return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }

    // Return a generic server error response
    return NextResponse.json({ error: 'Failed to process request on the server.' }, { status: 500 }); // Internal Server Error
  }
}