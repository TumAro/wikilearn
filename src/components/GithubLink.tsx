// src/components/GithubLink.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react"; // GitHub icon

const GITHUB_REPO_URL = "https://github.com/TumAro/wikilearn";

export const GithubLink = () => {
  return (
    <Button
      variant="ghost" // Use ghost variant
      size="icon" // Use icon size
      aria-label="View source on GitHub"
      asChild // Use asChild to make the Button render as an anchor tag
    >
      <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
        <Github className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">GitHub</span>
      </a>
    </Button>
  );
};