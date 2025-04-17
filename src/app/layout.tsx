// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter as FontSans } from "next/font/google"; // Font setup likely added by shadcn
import { Providers } from './providers';
import './globals.css'; // Includes shadcn theme variables
import { cn } from "@/lib/utils"; // shadcn utility

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans", // Ensure this matches tailwind.config.ts if present
});

export const metadata: Metadata = {
  title: 'WikiLearn',
  description: 'Simplify Wikipedia Pages',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // Apply font variable, let globals.css handle base bg/text via CSS vars
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}