// src/components/InputForm.tsx
'use client';
import React, { useState } from 'react';
import ExplanationDisplay from './ExplanationDisplay';
// Import shadcn components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Import icon for loading state
import { Loader2 } from 'lucide-react';
// Import types (ensure path is correct)
import type { PedagogicalSectionData, PedagogicalDataError } from '@/prompts/pedagogicalPrompt';

// Define types
interface ProcessedSection {
    sectionTitle: string;
    pedagogicalData: PedagogicalSectionData | PedagogicalDataError;
}
interface ApiExplainerResponse {
    pageTitle?: string;
    mainImageUrl?: string | null;
    sections?: ProcessedSection[];
    originalUrl?: string;
    error?: string; // For top-level errors
}

export default function InputForm() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResponseData, setApiResponseData] = useState<ApiExplainerResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setApiResponseData(null);
    const trimmedUrl = url.trim();
    if (!trimmedUrl) { setError("Please enter a Wikipedia URL."); setIsLoading(false); return; }
    if (!trimmedUrl.startsWith('http')) { setError("URL must start with http:// or https://"); setIsLoading(false); return; }

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const data: ApiExplainerResponse = await response.json();
      if (!response.ok || data.error) {
         throw new Error(data.error || `Request failed: ${response.statusText || response.status}`);
      }
      setApiResponseData(data);
    } catch (err: any) {
      console.error("Form submission error:", err);
      setError(err.message || 'An unexpected error occurred.');
      setApiResponseData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Use max-width for responsiveness
    <div className="w-full max-w-3xl px-2 sm:px-0">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 mb-8"> {/* Slightly smaller gap */}
         <Input
           type="url" value={url} onChange={(e) => setUrl(e.target.value)}
           placeholder="Enter Wikipedia URL..."
           required disabled={isLoading}
           className="flex-grow h-11 text-base px-4" // Adjusted height
           aria-label="Wikipedia URL Input"
         />
         <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full sm:w-auto px-6"> {/* Adjusted height */}
           {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {/* Adjusted icon size */}
                    Processing...
                </>
           ) : (
                'Explain'
           )}
         </Button>
      </form>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center p-8 text-muted-foreground flex justify-center items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Fetching and processing sections...</span>
        </div>
       )}

      {/* Error Message - Consider using shadcn Alert */}
      {error && (
        <div className="text-center p-4 mb-6 bg-destructive/10 border border-destructive/30 text-destructive-foreground dark:text-destructive rounded-lg">
            <p><strong className="font-medium">Error:</strong> {error}</p>
        </div>
       )}

      {/* Explanation Display - Rendered conditionally */}
      {apiResponseData && !error && (
        <ExplanationDisplay
          pageTitle={apiResponseData.pageTitle}
          mainImageUrl={apiResponseData.mainImageUrl}
          sections={apiResponseData.sections}
          originalUrl={apiResponseData.originalUrl}
        />
      )}
    </div>
  );
}