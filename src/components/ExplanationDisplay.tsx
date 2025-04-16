// src/components/ExplanationDisplay.tsx
// No 'use client' needed yet if just displaying props
import React from 'react';

interface ExplanationDisplayProps {
  simplifiedText: string | null;
  quizData: any | null; // Use proper quiz type later
  originalUrl: string | null;
}

export default function ExplanationDisplay({ simplifiedText, quizData, originalUrl }: ExplanationDisplayProps) {
  // Don't render anything if there's no text (or data)
  if (!simplifiedText) return null;

  return (
    <div className="mt-6 p-6 border border-gray-200 rounded-lg shadow-sm bg-white">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Simplified Explanation</h2>
      <p className="mb-4 text-gray-700 leading-relaxed">{simplifiedText}</p>

      {/* Placeholder for where the quiz will go */}
      {quizData && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-xl font-semibold mb-3 text-gray-800">Quiz</h3>
          {/* TODO: Implement Quiz rendering logic here */}
          <pre className="bg-gray-100 p-2 rounded text-sm text-gray-600">
            <code>{JSON.stringify(quizData, null, 2)}</code>
          </pre>
        </div>
      )}

      {/* Link to the original article */}
      {originalUrl && (
        <p className="mt-6 text-sm">
          <a
            href={originalUrl}
            target="_blank" // Open in new tab
            rel="noopener noreferrer" // Security best practice
            className="text-blue-600 hover:underline"
          >
            View Original Wikipedia Article
          </a>
        </p>
      )}
    </div>
  );
}