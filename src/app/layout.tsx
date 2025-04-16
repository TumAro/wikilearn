import './globals.css' // Import global styles
import type { Metadata } from 'next'
import { Inter } from 'next/font/google' // Example font

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WikiLearn',
  description: 'Simplify Wikipedia Pages',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}