// src/prompts/pedagogicalPrompt.ts

// Define the structure for quiz data (can be reused)
export interface QuizQuestion {
    id: number | string; // Allow string IDs if needed
    text: string;
    options: string[];
    answer: string;
}

export interface QuizData {
    questions: QuizQuestion[];
}

// Define the structure for the pedagogical data expected from Gemini
export interface PedagogicalSectionData {
  inquiryQuestion?: string; // Optional IBL/PBL question
  explanation: {
    introduction: string; // Section introduction/hook
    coreConcepts: string; // Main explanation (deeper than ELI5)
    // workedExample?: string; // Optional field for worked examples if applicable
  };
  scaffoldedQuiz: QuizData; // Quiz focused on scaffolding understanding
}

// Define the structure for an error within the pedagogical data
export interface PedagogicalDataError {
    error: string;
}

/**
 * Generates the prompt for the Google Gemini API for a single section, focusing on pedagogical methods.
 * @param sectionTitle - The title of the Wikipedia section.
 * @param sectionContent - The text content of the section.
 * @param pageTitle - The title of the overall Wikipedia page (for context).
 * @param maxContentLength - Optional maximum character length for the section content.
 * @returns The formatted prompt string.
 */
export function generatePedagogicalSectionPrompt(
    sectionTitle: string,
    sectionContent: string,
    pageTitle: string,
    maxContentLength: number = 7000 // Adjust based on model token limits and desired detail
): string {

    const truncatedContent = sectionContent.substring(0, maxContentLength);

    const prompt = `
ROLE: You are an expert instructional designer and educator creating interactive learning modules from Wikipedia content for motivated high-school or university-level students. Apply Inquiry-Based Learning (IBL) or Problem-Based Learning (PBL) principles, explain concepts clearly using structured explanations, and design quizzes for scaffolding understanding.

CONTEXT: You are processing a section titled "${sectionTitle || 'Introduction'}" from the Wikipedia page about "${pageTitle}".

INPUT TEXT (Analyze ONLY this text):
---
${truncatedContent}
---

TASKS: Based *only* on the INPUT TEXT provided above, perform the following:

1.  **Inquiry/Problem Formulation (Optional):** If the text naturally lends itself to it, formulate 1 engaging *inquiry question* or a concise *problem statement* that this section helps to answer or solve. This should stimulate curiosity and active learning. If not applicable or forced, OMIT the \`inquiryQuestion\` field entirely from the JSON output.

2.  **Structured Explanation:** Explain the core concepts presented in the input text. Structure this explanation clearly:
    *   \`introduction\`: Start with a brief (1-2 sentence) introduction to orient the learner to this section's topic and purpose.
    *   \`coreConcepts\`: Provide a clear, logical explanation of the main ideas, definitions, processes, or arguments presented in the text. Aim for depth suitable for the target audience (beyond ELI5). Use formatting like bullet points within the string if it enhances clarity.

3.  **Scaffolding Quiz:** Generate a \`scaffoldedQuiz\` with 2-4 multiple-choice questions derived strictly from the input text. The questions should progressively check understanding:
    *   Start with basic comprehension (e.g., definitions, key facts).
    *   If possible, include questions requiring application or analysis based *directly* on information *within the provided text* (e.g., comparing concepts mentioned, identifying the purpose of something described).
    *   Ensure each question has an \`id\`, \`text\`, an array of 3-4 \`options\`, and the correct \`answer\` string matching one option exactly.

OUTPUT FORMAT CONSTRAINT:
You MUST provide the output ONLY as a single, valid JSON object. Do NOT include any descriptive text, commentary, apologies, or markdown formatting (like \`\`\`json) before or after the JSON object. Adhere strictly to this structure (omit \`inquiryQuestion\` if not generated):

\`\`\`json
{
  "inquiryQuestion": "string",
  "explanation": {
    "introduction": "string",
    "coreConcepts": "string"
  },
  "scaffoldedQuiz": {
    "questions": [
      {
        "id": "number or string",
        "text": "string",
        "options": ["string", "string", "string", "string?"],
        "answer": "string"
      }
    ]
  }
}
\`\`\`
`; // End of prompt template literal

    return prompt;
}