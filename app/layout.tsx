// app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Components
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Alphy for PE',
  description: 'AI-powered Private Equity Analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Global NavBar (Client Component) */}
        
        
        {/* Page content */}
        {children}
        
        {/* Global Footer */}
        <Footer />
      </body>
    </html>
  );
}
