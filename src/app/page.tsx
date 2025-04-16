// src/app/page.tsx
import InputForm from '@/components/InputForm'; // Use the '@' alias configured by Next.js

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 md:p-24 bg-gray-50">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-2">
          WikiLearn
        </h1>
        <p className="text-gray-600 text-md sm:text-lg">
          Turn complex articles into simple lessons.
        </p>
      </div>

      {/* Render the InputForm component */}
      {/* It handles its own state and fetches data */}
      <InputForm />

    </main>
  );
}