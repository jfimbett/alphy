// app/companies/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface VariableData {
  value?: number | string; // can be numeric or string fallback
  currency?: string;
  unit?: string;
}

interface ConsolidatedCompany {
  name: string;
  variables: Record<string, Record<number, VariableData>>; 
  dates: string[];
}

export default function CompaniesPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [companies, setCompanies] = useState<ConsolidatedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchConsolidatedData = async () => {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/store-heavy-data?sessionId=${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();

        console.log('Loaded consolidated data:', data.consolidatedCompanies); // Add debug log

        // If consolidatedCompanies is absent, fallback to empty array
        if (data.consolidatedCompanies) {
          setCompanies(data.consolidatedCompanies);
        } else {
          setCompanies([]);
        }
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConsolidatedData();
  }, [sessionId]);
  
  useEffect(() => {
    if (companies.length > 0) {
      const years = new Set<number>();
      companies.forEach(company => {
        Object.values(company.variables).forEach(variable => {
          Object.keys(variable).forEach(year => years.add(parseInt(year)));
        });
      });
      setAvailableYears(Array.from(years).sort((a, b) => b - a));
      if (availableYears.length > 0) setSelectedYear(availableYears[0]);
    }
  }, [companies]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6 text-gray-800">
          <h1 className="text-2xl font-bold">Consolidated Company Data</h1>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        {/* Render variables for selected year */}
        {companies.map(company => (
          <div key={company.name} className="bg-white p-6 rounded-lg shadow-sm mb-4 text-gray-600">
            <h2 className="text-xl font-semibold mb-4">{company.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(company.variables).map(([varName, years]) => {
                const varData = years[selectedYear];
                return varData ? (
                  <div key={varName} className="bg-gray-50 p-4 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-medium capitalize">{varName.replace(/_/g, ' ')}</span>
                      <span className="text-sm text-gray-600">
                        {varData.currency} {varData.value?.toLocaleString()}
                        {varData.unit}
                      </span>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}