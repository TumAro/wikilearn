// src/components/Quiz.tsx
'use client';

import React, { useState, useId } from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from '@/prompts/pedagogicalPrompt';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';

interface QuizProps {
  questions: QuizQuestion[];
}

export default function Quiz({ questions }: QuizProps) {
  // *** Use string keys for state objects ***
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [results, setResults] = useState<{ [key: string]: boolean | null }>({});
  const [submitted, setSubmitted] = useState(false);
  const quizInstanceId = useId();

  const handleSelectAnswer = (questionId: number | string, answer: string) => {
    if (!submitted) {
      // *** Ensure questionId is treated as a string key ***
      setSelectedAnswers(prev => ({ ...prev, [String(questionId)]: answer }));
    }
  };

  const checkAnswers = () => {
    const newResults: { [key: string]: boolean | null } = {};
    questions.forEach(q => {
      // *** Use string keys when accessing/setting state ***
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

  const getFeedbackClass = (isCorrect: boolean | null) => {
     if (isCorrect === null || !submitted) return "";
     return isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400";
  };

  const getOptionClasses = (questionId: number | string, option: string, correctAnswer: string): string => {
    const base = "flex items-center space-x-3 p-3 border rounded-md transition-all duration-150 ease-in-out";
    const idle = "border-border bg-background hover:bg-accent cursor-pointer";
    // *** Use string keys for accessing state ***
    const qIdStr = String(questionId);
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
    return `${base} ${incorrectUnselectedStyle}`;
  };

  // *** Check length against questions array length ***
  const allAnswered = Object.keys(selectedAnswers).length === questions.length;

  return (
    <div className="space-y-8">
      {questions.map((q, index) => {
        // *** Convert q.id to string for consistent key usage ***
        const qIdStr = String(q.id);
        return (
          <div key={q.id || index} className="space-y-3">
            <Label className="font-medium text-base text-foreground">
              {index + 1}. {q.text}
            </Label>
            <RadioGroup
               value={selectedAnswers[qIdStr] ?? ""} // Use string key
               onValueChange={(value) => handleSelectAnswer(q.id, value)} // Pass original id here
               disabled={submitted}
               className="space-y-2"
            >
              {q.options.map((option, optionIndex) => {
                const uniqueId = `${quizInstanceId}-q${q.id}-opt${optionIndex}`; // Use original id for uniqueness
                const isCorrect = submitted ? q.answer === option : null;
                const isSelected = selectedAnswers[qIdStr] === option; // Use string key

                return (
                    <div key={uniqueId} className={getOptionClasses(q.id, option, q.answer)}> {/* Pass original id */}
                        <RadioGroupItem value={option} id={uniqueId} />
                        <Label htmlFor={uniqueId} className={`flex-grow ${submitted ? 'cursor-default' : 'cursor-pointer'} text-sm`}>
                            {option}
                        </Label>
                        {submitted && isCorrect && <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 ml-auto flex-shrink-0" />}
                        {submitted && isSelected && !isCorrect && <XCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400 ml-auto flex-shrink-0" />}
                    </div>
                );
              })}
            </RadioGroup>
             {/* Text Feedback */}
             {submitted && results[qIdStr] !== null && ( // Use string key
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