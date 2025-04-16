// src/prompts/explainPrompt.ts

// Define the structure we expect Gemini to return in JSON format
interface QuizQuestion {
    id: number;
    text: string;
    options: string[];
    answer: string;
}

interface QuizData {
    questions: QuizQuestion[];
}

interface GeminiResponseJson {
    simplifiedText: string;
    quizData: QuizData;
}

/**
 * Generates the prompt for the Google Gemini API.
 * @param pageTitle - The title of the Wikipedia page.
 * @param wikipediaContent - The text content fetched from Wikipedia.
 * @param maxContentLength - Optional maximum character length for the Wikipedia content included in the prompt.
 * @returns The formatted prompt string.
 */
export function generateExplainPrompt(
    pageTitle: string,
    wikipediaContent: string,
    maxContentLength: number = 15000 // Default max length
): string {

    const truncatedContent = wikipediaContent.substring(0, maxContentLength);

    // Using a template literal for the prompt structure.
    // Backticks allow multi-line strings.
    const prompt = `
You are an expert educator, mimicking the style of Khan Academy. Your goal is to make complex topics easily digestible.

Analyze the following Wikipedia article content about "${pageTitle}". Perform these two tasks:

1.  **ELI5 Simplification:** Rewrite the main points and core concepts of the provided text in a simple, clear, "Explain Like I'm Five" style. Focus on clarity and ease of understanding. Use analogies if helpful. Avoid jargon or explain it very simply. Keep the explanation concise but informative.

2.  **Quiz Generation:** Based *only* on the key information within the provided Wikipedia article content, create a multiple-choice quiz with 3-5 questions. Each question should test understanding of a distinct key fact or concept from the text.

**Output Format Constraint:**
You MUST provide the output ONLY as a single, valid JSON object. Do NOT include any text, commentary, or markdown formatting (like \`\`\`json) before or after the JSON object. The JSON object must strictly follow this structure:

\`\`\`json
{
  "simplifiedText": "string",
  "quizData": {
    "questions": [
      {
        "id": "number",
        "text": "string",
        "options": ["string", "string", "string", "string?"],
        "answer": "string"
      }
    ]
  }
}
\`\`\`

- \`simplifiedText\`: Your ELI5 explanation.
- \`quizData.questions\`: An array of question objects.
- \`id\`: A unique number for each question (e.g., 1, 2, 3).
- \`text\`: The question itself.
- \`options\`: An array of 3 or 4 possible answer strings.
- \`answer\`: The string that exactly matches the correct option.

**Wikipedia Article Content to Analyze:**
---
${truncatedContent}
---
`; // End of prompt template literal

    return prompt;
}

// Export the interfaces if needed elsewhere, though often just used internally for the prompt structure
export type { GeminiResponseJson, QuizData, QuizQuestion };