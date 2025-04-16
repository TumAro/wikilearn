// src/components/InputForm.tsx
'use client'; // This component needs state and browser interaction

import React, { useState } from 'react';
import ExplanationDisplay from './ExplanationDisplay'; // We'll display results here

// Define the structure of the data we expect back from our API
interface ExplanationData {
    simplifiedText: string;
    quizData: any; // Replace 'any' with a specific type for your quiz later
    originalUrl: string;
}

export default function InputForm() {
  // State hooks to manage the component's data and behavior
  const [url, setUrl] = useState(''); // Stores the text in the input field
  const [isLoading, setIsLoading] = useState(false); // Tracks if the API call is in progress
  const [error, setError] = useState<string | null>(null); // Stores any error message
  const [explanationData, setExplanationData] = useState<ExplanationData | null>(null); // Stores the result from the API

  // Function called when the form is submitted
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission (page reload)
    setIsLoading(true);     // Set loading state to true
    setError(null);         // Clear any previous error
    setExplanationData(null); // Clear previous results

    try {
      // Send a POST request to our API endpoint
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Tell the server we're sending JSON
        },
        body: JSON.stringify({ url: url }), // Send the URL in the request body as JSON
      });

      // Check if the request was successful (status code 2xx)
      if (!response.ok) {
        // If not okay, try to parse the error message from the response
        const errorData = await response.json();
        throw new Error(errorData.error || `Something went wrong (Status: ${response.status})`);
      }

      // If successful, parse the JSON data from the response
      const data: ExplanationData = await response.json();
      setExplanationData(data); // Store the received data in state

    } catch (err: any) { // Catch any errors during fetch or processing
      console.error("Fetch error:", err);
      setError(err.message || 'An unexpected error occurred.'); // Set the error message state
    } finally {
      setIsLoading(false); // Set loading state back to false, whether success or error
    }
  };

  return (
    <div className="w-full max-w-2xl"> {/* Container with max width */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-4"> {/* Form layout */}
         <input
           type="url"
           value={url}
           onChange={(e) => setUrl(e.target.value)} // Update state when input changes
           placeholder="Enter Wikipedia URL"
           required // Make input required
           disabled={isLoading} // Disable input while loading
           className="flex-grow p-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-blue-500" // Styling
         />
         <button
           type="submit"
           disabled={isLoading} // Disable button while loading
           className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out" // Styling
         >
           {isLoading ? 'Processing...' : 'Explain'} {/* Change button text based on loading state */}
         </button>
      </form>

      {/* Display error message if there is one */}
      {error && <p className="text-red-500 text-center mb-4">Error: {error}</p>}

      {/* Conditionally render the ExplanationDisplay component only when we have data */}
      {explanationData && (
        <ExplanationDisplay
          simplifiedText={explanationData.simplifiedText}
          quizData={explanationData.quizData}
          originalUrl={explanationData.originalUrl}
        />
      )}
    </div>
  );
}