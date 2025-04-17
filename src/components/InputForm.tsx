// src/components/InputForm.tsx
'use client';
import React, { useState, useEffect } from 'react'; // Add useEffect
import ExplanationDisplay from './ExplanationDisplay';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import type { PedagogicalSectionData, PedagogicalDataError } from '@/prompts/pedagogicalPrompt';

// Types
interface ProcessedSection {
    sectionTitle: string;
    pedagogicalData: PedagogicalSectionData | PedagogicalDataError;
}
// Type for initial data chunk
interface InitialData {
    pageTitle?: string;
    mainImageUrl?: string | null;
    originalUrl?: string;
}
// Type for section data chunk
interface SectionChunkData {
    sectionTitle: string;
    pedagogicalData: PedagogicalSectionData | PedagogicalDataError;
}
// Type for error chunk
interface ErrorChunkData {
    message: string;
    originalUrl?: string;
}

export default function InputForm() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State for initial page info (received first)
  const [pageInfo, setPageInfo] = useState<InitialData | null>(null);
  // State for incrementally loaded sections
  const [processedSections, setProcessedSections] = useState<ProcessedSection[]>([]);
  // Abort controller for fetch requests
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Cleanup function to abort fetch if component unmounts during streaming
   useEffect(() => {
    return () => {
      if (abortController) {
        console.log("InputForm unmounting, aborting fetch stream.");
        abortController.abort();
      }
    };
  }, [abortController]);


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Abort previous request if running
    if (abortController) {
         abortController.abort();
         console.log("Aborted previous request.");
    }
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    setIsLoading(true);
    setError(null);
    setPageInfo(null); // Clear previous results
    setProcessedSections([]); // Clear previous sections

    const trimmedUrl = url.trim();
    if (!trimmedUrl || !trimmedUrl.startsWith('http')) {
        setError("Please enter a valid Wikipedia URL starting with http:// or https://");
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
        signal: newAbortController.signal, // Pass abort signal
      });

      if (!response.ok) {
          // Handle immediate errors (like 400, 404, 500 before stream starts)
          const errorData = await response.json().catch(() => ({ error: `Request failed with status: ${response.status}` }));
          throw new Error(errorData.error || `Request failed: ${response.statusText || response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is missing.");
      }

      // --- Process the Stream ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; // Buffer to handle chunks potentially splitting JSON lines

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream finished.");
          break; // Exit loop when stream is done
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true }); // stream: true handles multi-byte chars across chunks

        // Process complete lines (NDJSON) from the buffer
        const lines = buffer.split('\n');

        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue; // Skip empty lines

          try {
            const chunk = JSON.parse(line);
            console.log("Received chunk:", chunk.type); // Log chunk type

            if (chunk.type === 'initial') {
              setPageInfo(chunk.data as InitialData);
            } else if (chunk.type === 'section') {
              // Add new section incrementally
              setProcessedSections(prevSections => [...prevSections, chunk.data as ProcessedSection]);
            } else if (chunk.type === 'error') {
                 // Handle error message sent via stream
                 console.error("Received stream error chunk:", chunk.message);
                 setError(`Error during processing: ${chunk.message}`);
                 // Optional: Abort further processing if needed
                 // reader.cancel(); // Or use abortController.abort()
                 // return;
            }
            // Ignore other chunk types like 'status' or 'done' if added

          } catch (parseError) {
            console.error("Failed to parse JSON chunk:", line, parseError);
            // Decide how to handle parse errors - maybe set a general error?
            // setError("Error reading data stream.");
            // break; // Stop processing if stream is corrupted?
          }
        } // End for loop processing lines
      } // End while(true) stream reading loop

      // Add final part of buffer if any (shouldn't happen with NDJSON if stream closed properly)
      if (buffer.trim()) {
          console.warn("Processing remaining buffer:", buffer);
          try {
              const chunk = JSON.parse(buffer);
              // Handle last chunk similarly to above...
          } catch (e) {
              console.error("Failed to parse final buffer:", buffer, e);
          }
      }


    } catch (err: any) {
      if (err.name === 'AbortError') {
         console.log("Fetch aborted.");
         // Don't set error state if intentionally aborted
      } else {
         console.error("Form submission/fetch error:", err);
         setError(err.message || 'An unexpected error occurred.');
         setPageInfo(null); // Clear data on error
         setProcessedSections([]);
      }
    } finally {
      setIsLoading(false);
       setAbortController(null); // Clear abort controller when done/error
    }
  };

  return (
    <div className="w-full max-w-4xl px-2 sm:px-0"> {/* Wider */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 mb-8">
         <Input
           type="url" value={url} onChange={(e) => setUrl(e.target.value)}
           placeholder="Enter Wikipedia URL..." required disabled={isLoading}
           className="flex-grow h-11 text-base px-4"
           aria-label="Wikipedia URL Input"
         />
         <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full sm:w-auto px-6">
           {isLoading ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> ) : ( 'Explain' )}
         </Button>
      </form>

      {/* Loading Indicator - Show during loading AND while sections might still be arriving */}
      {isLoading && <div className="text-center p-6 text-muted-foreground"><p>Fetching and processing...</p></div>}

      {/* Error Message */}
      {error && ( <div className="text-center p-4 mb-6 bg-destructive/10 border border-destructive/30 text-destructive-foreground dark:text-destructive rounded-lg"><p><strong className="font-medium">Error:</strong> {error}</p></div> )}

      {/* Explanation Display - Pass incrementally loaded data */}
      {/* Render ExplanationDisplay once pageInfo is available, even if sections are still loading */}
      {pageInfo && !error && (
        <ExplanationDisplay
          pageTitle={pageInfo.pageTitle}
          mainImageUrl={pageInfo.mainImageUrl}
          sections={processedSections} // Pass the array of sections loaded so far
          originalUrl={pageInfo.originalUrl}
        />
      )}
    </div>
  );
}