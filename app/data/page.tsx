"use client";

import { useState } from "react";
import { SearchForm } from "@/components/ui/search-form";
import { SearchResults } from "@/components/ui/search-results";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";

// If you have a Navbar component like in HistoryPage, import it:
// import Navbar from "@/components/Navbar";

export default function DataPage() {
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(params: { name: string; ticker: string; cik: string }) {
    console.log("Searching with:", params); // <-- Debug log
    setIsSearching(true);
    try {
      // Construct a query string with name, ticker, cik
      const searchParams = new URLSearchParams({
        name: params.name.trim(),
        ticker: params.ticker.trim(),
        cik: params.cik.trim(),
      });

      const response = await fetch(`/api/financial-data?${searchParams.toString()}`);
      const data = await response.json();
      console.log("Data received:", data); // <-- Debug log
      setResults(data || []);
    } catch (error) {
      console.error("Error fetching financial data:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
     
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">
          SEC Financial Data Explorer
        </h1>

        {/* Our new SearchForm component */}
        <SearchForm onSearch={handleSearch} />

        {/* Results or loading skeletons */}
        {isSearching ? (
          <div className="mt-8 space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <SearchResults results={results} />
          </div>
        )}
      </main>
    </div>
  );
}
