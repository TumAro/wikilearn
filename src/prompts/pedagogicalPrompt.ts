// src/prompts/pedagogicalPrompt.ts

// Interfaces remain the same...
export interface QuizQuestion { /* ... */ }
export interface QuizData { /* ... */ }
export interface PedagogicalSectionData { /* ... */ }
export interface PedagogicalDataError { /* ... */ }

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
    maxContentLength: number = 7000 // Adjust as needed
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

1.  **Inquiry/Problem Formulation (Optional):** If appropriate, formulate 1 engaging *inquiry question* or a concise *problem statement* related to this section. Omit the \`inquiryQuestion\` field if not applicable.

2.  **Structured Explanation:** Explain the core concepts presented in the input text. Structure this explanation clearly:
    *   \`introduction\`: A brief (1-2 sentence) introduction.
    *   \`coreConcepts\`: A clear, logical explanation suitable for the target audience.

3.  **Scaffolding Quiz:** Generate a \`scaffoldedQuiz\` with 2-4 multiple-choice questions derived strictly from the input text, checking comprehension and potentially application/analysis. Ensure \`id\`, \`text\`, \`options\`, and \`answer\` are present.

**OUTPUT FORMAT CONSTRAINT:**
You MUST provide the output ONLY as a single, valid JSON object. Do NOT include any text, commentary, or markdown formatting (like \`\`\`json) before or after the JSON object.

**JSON CONTENT RULES:**
*   Inside the JSON string values (like "simplifiedText", "introduction", "coreConcepts", question "text", "options", "answer"), ensure that:
    *   All double quotes (\") are properly escaped (\\\").
    *   All backslashes (\\) are properly escaped (\\\\).
    *   All literal newline characters are represented as "\\\\n". Do not include raw newlines within the strings.

Adhere strictly to this JSON structure (omit \`inquiryQuestion\` if not generated):

\`\`\`json
{
  "inquiryQuestion": "string (optional, properly escaped)",
  "explanation": {
    "introduction": "string (properly escaped)",
    "coreConcepts": "string (properly escaped, use \\\\n for newlines)"
  },
  "scaffoldedQuiz": {
    "questions": [
      {
        "id": "number or string",
        "text": "string (properly escaped)",
        "options": ["string (properly escaped)", "..."],
        "answer": "string (properly escaped, matching one option)"
      }
    ]
  }
}
\`\`\`
`; // End of prompt template literal

    return prompt;
}