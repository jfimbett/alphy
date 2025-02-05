"use client";

import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchFormProps {
  // You can adapt the shape as needed in your handleSearch logic
  onSearch: (params: {
    name: string;
    ticker: string;
    cik: string;
  }) => Promise<void>;
}

export function SearchForm({ onSearch }: SearchFormProps) {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [cik, setCik] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Form submitted"); // <-- Debug log
    setLoading(true);
    try {
      await onSearch({ name, ticker, cik });
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white p-4 rounded shadow-sm"
    >
      {/* Name Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          placeholder="e.g. Apple Inc"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md
                     shadow-sm focus:border-blue-500 focus:ring-blue-500
                     text-sm px-3 py-2 text-gray-900"
        />
      </div>

      {/* Ticker Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Ticker
        </label>
        <input
          type="text"
          placeholder="e.g. AAPL"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md
                     shadow-sm focus:border-blue-500 focus:ring-blue-500
                     text-sm px-3 py-2 text-gray-900"
        />
      </div>

      {/* CIK Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          CIK
        </label>
        <input
          type="text"
          placeholder="e.g. 0000320193"
          value={cik}
          onChange={(e) => setCik(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md
                     shadow-sm focus:border-blue-500 focus:ring-blue-500
                     text-sm px-3 py-2"
        />
      </div>

      {/* Search Button */}
      <div className="text-right">
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2
                     bg-blue-600 text-white rounded
                     hover:bg-blue-700 text-sm font-medium
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Search
        </button>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="pt-2">
          <Skeleton className="h-4 w-full" />
        </div>
      )}
    </form>
  );
}
