// components/ui/search-input.tsx
"use client";

import { useState, useCallback, useEffect } from 'react';
import React from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { debounce } from 'lodash';
import { Skeleton } from '@/components/ui/skeleton';
interface SearchInputProps {
  onSearch: (company: { cik: string; searchTerm: string; name: string; tickers?: string[] }) => void;
}

export function SearchInput({ onSearch }: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ cik: string; searchTerm: string; name: string; tickers?: string[] }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetchSuggestions = useCallback((searchQuery: string) => {
    debounce(() => fetchSuggestions(searchQuery), 300)();
  }, [fetchSuggestions]);

  useEffect(() => {
    if (query.length > 0) {
      debouncedFetchSuggestions(query);
      setLoading(true);
      fetchSuggestions(query);
    } else {
      setSuggestions([]);
    }
  }, [query, fetchSuggestions, debouncedFetchSuggestions]);

  return (
    <div className="w-full max-w-2xl mx-auto text-gray-600">
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search company by name, CIK, or ticker..."
          value={query}
          onValueChange={setQuery}
        />
        {loading && <div className="p-2"><Skeleton className="h-4 w-full" /></div>}
        <CommandList>
          {suggestions.length > 0 && (
            <CommandGroup heading="Suggestions">
              {suggestions.map((company) => (
                <CommandItem
                  key={company.cik}
                  value={company.cik}
                  onSelect={() => {
                    setQuery(company.searchTerm);
                    onSearch(company);
                    setSuggestions([]);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{company.name}</span>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      {company.tickers?.map(t => <span key={t}>Ticker: {t}</span>)}
                      <span>CIK: {company.cik.padStart(10, '0')}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!loading && suggestions.length === 0 && query.length > 1 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </div>
  );
}