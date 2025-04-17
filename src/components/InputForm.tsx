// src/components/InputForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import ExplanationDisplay from './ExplanationDisplay';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import type { PedagogicalSectionData, PedagogicalDataError } from '@/prompts/pedagogicalPrompt';

// Types
interface ProcessedSection { sectionTitle: string; pedagogicalData: PedagogicalSectionData | PedagogicalDataError; }
interface InitialData { pageTitle?: string; mainImageUrl?: string | null; originalUrl?: string; totalSections?: number; } // Added totalSections
interface SectionChunkData extends ProcessedSection { currentIndex?: number; totalSections?: number; } // Added index/total
interface ErrorChunkData { message: string; originalUrl?: string; }
interface StatusChunkData { message: string; }

export default function InputForm() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<InitialData | null>(null);
  const [processedSections, setProcessedSections] = useState<ProcessedSection[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null); // Keep for status updates

  useEffect(() => { return () => { abortController?.abort(); }; }, [abortController]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    abortController?.abort();
    const newAbortController = new AbortController(); setAbortController(newAbortController);
    setIsLoading(true); setError(null); setPageInfo(null); setProcessedSections([]); setLoadingStatus("Initiating request...");
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !trimmedUrl.startsWith('http')) { setError("Please enter a valid Wikipedia URL."); setIsLoading(false); setLoadingStatus(null); return; }

    try {
      const response = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: trimmedUrl }), signal: newAbortController.signal });
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `Request failed: ${response.status}`); }
      if (!response.body) throw new Error("Response body missing.");

      setLoadingStatus("Waiting for response stream...");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === 'initial') { setPageInfo(chunk.data as InitialData); setLoadingStatus("Received initial data..."); }
            else if (chunk.type === 'section') { setProcessedSections(prev => [...prev, chunk.data as ProcessedSection]); /* Status updated by 'status' chunk */ }
            else if (chunk.type === 'status') { setLoadingStatus((chunk.message as string)); } // Updated property name
            else if (chunk.type === 'error') { console.error("Stream Error:", chunk.message); setError(`Processing Error: ${chunk.message}`); setLoadingStatus(null); reader.cancel(); return; }
          } catch (parseError) { console.error("Failed JSON chunk parse:", line, parseError); }
        }
      }
      if (buffer.trim()) { try { const chunk = JSON.parse(buffer); /* Handle last */ } catch (e) { console.error("Failed final buffer parse:", buffer, e); } }
      console.log("Stream finished.");

    } catch (err: any) {
      if (err.name !== 'AbortError') { console.error("Submit/Fetch Error:", err); setError(err.message || 'Unexpected error.'); setPageInfo(null); setProcessedSections([]); }
      else { console.log("Fetch aborted by user."); }
    } finally { setIsLoading(false); setLoadingStatus(null); setAbortController(null); }
  };

  return (
    <div className="w-full max-w-4xl px-2 sm:px-0">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 mb-8">
         <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter Wikipedia URL..." required disabled={isLoading} className="flex-grow h-11 text-base px-4" aria-label="Wikipedia URL Input" />
         <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full sm:w-auto px-6">
           {isLoading ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> ) : ( 'Explain' )}
         </Button>
      </form>
      {isLoading && ( <div className="text-center p-6 text-muted-foreground flex justify-center items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>{loadingStatus || 'Processing...'}</span></div> )}
      {!isLoading && error && ( <div className="text-center p-4 mb-6 bg-destructive/10 border border-destructive/30 text-destructive-foreground dark:text-destructive rounded-lg"><p><strong className="font-medium">Error:</strong> {error}</p></div> )}
      {pageInfo && !error && ( <ExplanationDisplay pageTitle={pageInfo.pageTitle} mainImageUrl={pageInfo.mainImageUrl} sections={processedSections} originalUrl={pageInfo.originalUrl} /> )}
    </div>
  );
}