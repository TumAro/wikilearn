// src/components/ExplanationDisplay.tsx
'use client';
import React from 'react';
import Image from 'next/image';
import Quiz from './Quiz';
// Import shadcn Card components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// Import ReactMarkdown and necessary plugins
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw'; // To handle raw HTML like <sub>
// Import types
import type { PedagogicalSectionData, PedagogicalDataError } from '@/prompts/pedagogicalPrompt';

// Define the structure for each section received as a prop
interface ProcessedSection {
    sectionTitle: string;
    pedagogicalData: PedagogicalSectionData | PedagogicalDataError;
}

// Define the props for this component
interface ExplanationDisplayProps {
  pageTitle?: string;
  mainImageUrl?: string | null;
  sections?: ProcessedSection[] | null;
  originalUrl?: string | null;
}

// Type guard function to check if the pedagogicalData is an error
function isPedagogicalError(data: PedagogicalSectionData | PedagogicalDataError): data is PedagogicalDataError {
  return typeof data === 'object' && data !== null && 'error' in data;
}

export default function ExplanationDisplay({ pageTitle, mainImageUrl, sections, originalUrl }: ExplanationDisplayProps) {

  // Handle missing/empty sections array
  if (!sections || sections.length === 0) {
    return (
        <Card className="mt-6 border-yellow-500/50 dark:border-yellow-600/60 bg-yellow-50/50 dark:bg-yellow-900/20">
             <CardHeader>
                  <CardTitle className="text-yellow-800 dark:text-yellow-300">Processing Note</CardTitle>
             </CardHeader>
             <CardContent>
                  <p className="text-yellow-700 dark:text-yellow-400">No substantial content sections were found or could be processed for this page.</p>
             </CardContent>
        </Card>
    );
  }

  return (
    <div className="mt-8 space-y-8 md:space-y-10">
      {/* Page Title */}
      {pageTitle && <h1 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-8 tracking-tight">{pageTitle}</h1>}

      {/* Main Image */}
      {mainImageUrl && (
         <div className="mb-8 flex justify-center items-center bg-muted/50 rounded-lg overflow-hidden shadow-inner max-w-2xl mx-auto">
            <Image
               src={mainImageUrl} alt={`Main image for ${pageTitle || 'article'}`}
               width={600} height={400}
               className="object-contain max-h-[450px] w-auto"
               priority={true}
               unoptimized={mainImageUrl.endsWith('.svg')}
            />
         </div>
      )}

      {/* Sections */}
      {sections.map((section, index) => (
        <Card key={section.sectionTitle || index} className="overflow-hidden shadow-sm dark:shadow-none border border-border">
           <CardHeader className="pb-4 bg-muted/30 dark:bg-muted/10">
                <CardTitle className="text-xl md:text-2xl font-semibold">
                     {section.sectionTitle || `Section ${index + 1}`}
                </CardTitle>
                {/* Render introduction only if data is not an error */}
                {!isPedagogicalError(section.pedagogicalData) && section.pedagogicalData.explanation?.introduction && (
                    <CardDescription className="pt-2 text-sm">
                        {section.pedagogicalData.explanation.introduction}
                    </CardDescription>
                )}
           </CardHeader>

           <CardContent className="p-4 md:p-6 pt-4 space-y-5">
              {isPedagogicalError(section.pedagogicalData) ? (
                // Render error state for this section
                <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive-foreground dark:text-destructive rounded-md text-sm">
                    <p><strong className="font-medium">Error processing section:</strong> {section.pedagogicalData.error}</p>
                </div>
              ) : (
                // Render normal content for this section
                <>
                    {/* Inquiry Question */}
                    {section.pedagogicalData.inquiryQuestion && (
                        <blockquote className="mt-2 border-l-4 border-primary pl-4 italic text-muted-foreground">
                            <p className="font-medium text-primary/90 dark:text-primary/80">
                               <span className="text-lg mr-2">🤔</span>{section.pedagogicalData.inquiryQuestion}
                            </p>
                        </blockquote>
                    )}

                    {/* Explanation */}
                    <div className="explanation-content space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Explanation</h3>
                        {/* Render coreConcepts using ReactMarkdown with ALL plugins */}
                        {section.pedagogicalData.explanation?.coreConcepts && (
                            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground leading-relaxed">
                                <ReactMarkdown
                                     remarkPlugins={[remarkMath]}
                                     // rehypeRaw MUST come before rehypeKatex
                                     rehypePlugins={[rehypeRaw, rehypeKatex]}
                                >
                                     {section.pedagogicalData.explanation.coreConcepts}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>

                    {/* Quiz */}
                    {section.pedagogicalData.scaffoldedQuiz?.questions?.length > 0 && (
                        <div className="mt-6 border-t border-border pt-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quiz</h3>
                            <Quiz questions={section.pedagogicalData.scaffoldedQuiz.questions} />
                        </div>
                    )}
                </> // <-- Closing fragment for normal content
              )} {/* <-- Closing ternary */}
           </CardContent> {/* <-- Closing CardContent */}
        </Card> // <-- Closing Card
      ))} {/* <-- Closing sections.map */}

      {/* Original Article Link */}
      {originalUrl && (
         <p className="mt-10 text-center text-sm">
            <a href={originalUrl} target="_blank" rel="noopener noreferrer"
               className="text-primary hover:underline transition-colors duration-200"
            >
               View Original Wikipedia Article
            </a>
         </p>
       )}

    </div> // <-- Closing main return div
  ); // <-- Closing return statement
} // <-- Closing Component function