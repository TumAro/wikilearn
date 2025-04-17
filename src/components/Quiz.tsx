// src/components/Quiz.tsx
'use client';

import React, { useState, useId } from 'react';
// Import shadcn components
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Import types
import type { QuizQuestion } from '@/prompts/pedagogicalPrompt'; // Ensure path is correct
// Import icons
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid'; // Ensure installed
// Import ReactMarkdown and plugins
import ReactMarkdown from 'react-markdown'; // Ensure installed
import remarkMath from 'remark-math'; // Ensure installed
import rehypeKatex from 'rehype-katex'; // Ensure installed
import rehypeRaw from 'rehype-raw'; // Ensure installed

interface QuizProps {
  questions: QuizQuestion[];
}

export default function Quiz({ questions }: QuizProps) {
  // State hooks
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [results, setResults] = useState<{ [key: string]: boolean | null }>({});
  const [submitted, setSubmitted] = useState(false);
  const quizInstanceId = useId(); // Unique prefix for IDs/names

  // --- Helper Functions ---

  // Explicitly type the return value as string
  const getFeedbackClass = (isCorrect: boolean | null): string => {
     if (isCorrect === null || !submitted) return "";
     return isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400";
  };

  // Explicitly type the return value as string
  const getOptionClasses = (questionId: number | string, option: string, correctAnswer: string): string => {
    const base = "flex items-center space-x-3 p-3 border rounded-md transition-all duration-150 ease-in-out";
    const idle = "border-border bg-background hover:bg-accent cursor-pointer";
    const qIdStr = String(questionId); // Use string key for state access
    const selectedIdle = "border-primary ring-1 ring-primary bg-primary/5 cursor-pointer";

    if (!submitted) {
      return `${base} ${selectedAnswers[qIdStr] === option ? selectedIdle : idle}`;
    }

    const isSelected = selectedAnswers[qIdStr] === option;
    const isCorrect = option === correctAnswer;
    const correctStyle = "border-green-600 bg-green-500/10 text-green-800 dark:text-green-300 dark:border-green-500 dark:bg-green-500/15 cursor-default";
    const incorrectSelectedStyle = "border-red-600 bg-red-500/10 text-red-800 dark:text-red-300 dark:border-red-500 dark:bg-red-500/15 cursor-default";
    const incorrectUnselectedStyle = "border-border bg-background opacity-60 cursor-default";

    if (isCorrect) return `${base} ${correctStyle}`;
    if (isSelected && !isCorrect) return `${base} ${incorrectSelectedStyle}`;
    return `${base} ${incorrectUnselectedStyle}`; // Return value for incorrect, unselected
  };


  // --- Event Handlers ---

  const handleSelectAnswer = (questionId: number | string, answer: string) => {
    if (!submitted) {
      setSelectedAnswers(prev => ({ ...prev, [String(questionId)]: answer }));
    }
  };

  const checkAnswers = () => {
    const newResults: { [key: string]: boolean | null } = {};
    questions.forEach(q => {
      const qIdStr = String(q.id);
      newResults[qIdStr] = selectedAnswers[qIdStr] === q.answer;
    });
    setResults(newResults);
    setSubmitted(true);
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setResults({});
    setSubmitted(false);
  };


  // --- Render Logic ---

  const allAnswered = Object.keys(selectedAnswers).length === questions.length;

  return (
    <div className="space-y-8">
      {questions.map((q, index) => {
        const qIdStr = String(q.id); // Use string ID for state access
        return (
          <div key={q.id || index} className="space-y-3">
            {/* Question Text */}
            <Label className="font-medium text-base text-foreground">
                 {index + 1}. {q.text}
            </Label>
            {/* Radio Group */}
            <RadioGroup
               value={selectedAnswers[qIdStr] ?? ""}
               onValueChange={(value) => handleSelectAnswer(q.id, value)}
               disabled={submitted}
               className="space-y-2"
            >
              {q.options.map((option, optionIndex) => {
                const uniqueId = `${quizInstanceId}-q${q.id}-opt${optionIndex}`;
                const isCorrect = submitted ? q.answer === option : null;
                const isSelected = selectedAnswers[qIdStr] === option;

                return (
                    // Container applies the dynamic styling
                    <div key={uniqueId} className={getOptionClasses(q.id, option, q.answer)}>
                        <RadioGroupItem value={option} id={uniqueId} />
                        {/* Use ReactMarkdown for the Label content */}
                        <Label htmlFor={uniqueId} className={`flex-grow ${submitted ? 'cursor-default' : 'cursor-pointer'} text-sm leading-snug`}>
                             <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                // rehypeRaw first to handle HTML, then rehypeKatex
                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                disallowedElements={['p']} // Avoid <p> tags within label
                                unwrapDisallowed={true}
                             >
                                {option}
                             </ReactMarkdown>
                        </Label>
                        {/* Feedback Icons */}
                        {submitted && isCorrect && <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 ml-auto flex-shrink-0" />}
                        {submitted && isSelected && !isCorrect && <XCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400 ml-auto flex-shrink-0" />}
                    </div>
                );
              })}
            </RadioGroup>
             {/* Text Feedback */}
             {submitted && results[qIdStr] !== null && (
                  <p className={`mt-2 text-xs sm:text-sm font-medium ${getFeedbackClass(results[qIdStr])}`}>
                     {results[qIdStr] ? 'Correct!' : `Incorrect. Correct answer: "${q.answer}"`}
                  </p>
              )}
          </div>
        );
      })}

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-3">
         {submitted ? (
            <Button variant="outline" size="sm" onClick={resetQuiz}>
                Try Again
            </Button>
         ) : (
            <Button size="sm" onClick={checkAnswers} disabled={!allAnswered}>
                Check Answers
            </Button>
         )}
      </div>
    </div>
  );
}