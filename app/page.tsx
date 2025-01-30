import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-6">AI for Private Equity</h1>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Alphy for PE empowers private equity funds with advanced AI tools to analyze and manage fund and company data efficiently.
          </p>
          <Link
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}