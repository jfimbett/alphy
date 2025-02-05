// components/ui/search-results.tsx
"use client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Company {
  cik: string;
  name: string;
  tickers?: string[];
}

interface SearchResultsProps {
  results: Company[];
}

export function SearchResults({ results }: SearchResultsProps) {
  const router = useRouter();
  return (
    <div className="grid gap-4 mt-8">
      {results.map((company) => (
        <Card key={company.cik} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-xl">{company.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-muted-foreground">
              <div>
                <p className="text-sm">CIK: {company.cik.padStart(10, '0')}</p>
                {(company.tickers?.length ?? 0) > 0 && (
                  <p className="text-sm">Tickers: {company.tickers?.join(', ')}</p>
                )}
                  <button
              onClick={() => router.push(`/data/${company.cik}`)}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              View Facts
            </button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}