// src/app/page.tsx
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { GithubLink } from '@/components/GithubLink';
import InputForm from '@/components/InputForm'; // <-- Import InputForm

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center p-4 pt-20 sm:p-8 sm:pt-24 md:p-16 md:pt-28"> {/* Added more top padding */}
      {/* Header section for buttons */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <GithubLink />
        <ThemeSwitcher />
      </div>

      {/* Main content area */}
      <div className="w-full max-w-4xl flex flex-col items-center"> {/* Container for centering */}
          {/* Title Area */}
          <div className="text-center mb-10 md:mb-12 w-full">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-3">
              WikiLearn
              </h1>
              <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              Turn complex articles into simple lessons.
              </p>
          </div>

          {/* === Add InputForm Component Here === */}
          <InputForm />

          {/* The ExplanationDisplay will be rendered inside InputForm based on state */}
      </div>
    </div>
  );
}