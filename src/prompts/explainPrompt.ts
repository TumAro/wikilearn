// src/prompts/explainPrompt.ts

// Interfaces remain the same (QuizQuestion, QuizData, GeminiResponseJson)
// ...

/**
 * Generates the prompt for the Google Gemini API for a single section.
 * @param sectionTitle - The title of the Wikipedia section.
 * @param sectionContent - The text content of the section.
 * @param pageTitle - The title of the overall Wikipedia page (for context).
 * @param maxContentLength - Optional maximum character length for the section content.
 * @returns The formatted prompt string.
 */
export function generateSectionExplainPrompt(
  sectionTitle: string,
  sectionContent: string,
  pageTitle: string, // Add overall page title for context
  maxContentLength: number = 5000 // Reduce max length per section if needed
): string {

  const truncatedContent = sectionContent.substring(0, maxContentLength);

  const prompt = `
You are an expert educator (like Khan Academy) explaining a specific section of a Wikipedia article about "${pageTitle}".

The current section is titled: "${sectionTitle || 'Introduction'}"

Analyze ONLY the following text content from this specific section:
---
${truncatedContent}
---

Perform these two tasks based ONLY on the text provided above:

1.  **Section ELI5 Summary:** Rewrite the main points of THIS SECTION in a simple, clear, "Explain Like I'm Five" style. Focus on the key information presented in this section.

2.  **Section Quiz:** Create a short multiple-choice quiz (1-3 questions) testing understanding of the key facts presented ONLY in THIS SECTION's text.

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
      "options": ["string", "string", "string"],
      "answer": "string"
    }
  ]
}
}
\`\`\`

- \`simplifiedText\`: Your ELI5 summary for this section.
- \`quizData.questions\`: An array of 1-3 question objects about this section.
- \`id\`: A unique number for each question (can be simple like 1, 2, 3 within this section).
- \`text\`: The question itself.
- \`options\`: An array of 3 answer strings.
- \`answer\`: The string that exactly matches the correct option.
`; // End of prompt template literal

  return prompt;
}

export type { GeminiResponseJson, QuizData, QuizQuestion }; // Keep exports