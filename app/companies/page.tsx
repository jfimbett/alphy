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
  variables: Record<string, VariableData>; // varName -> { value, currency, unit }
  dates: string[];
}

export default function CompaniesPage() {
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
      <main className="max-w-7xl mx-auto px-4 py-8 text-gray-800">
        <h1 className="text-2xl font-bold mb-6">Consolidated Company Data</h1>

        {companies.length === 0 && (
          <p className="text-gray-700">
            No consolidated data found for this session.
          </p>
        )}

        <div className="space-y-6">
          {companies.map((company, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
              {/* Company Name */}
              <h2 className="text-xl font-semibold mb-4">{company.name}</h2>

              {/* Variables */}
              {company.variables && Object.keys(company.variables).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(company.variables).map(([varName, varData]) => {
                    // Safeguard if varData is missing or not an object
                    if (!varData || typeof varData !== 'object') {
                      return (
                        <div key={varName} className="bg-gray-50 p-4 rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium capitalize">
                              {varName.replace(/_/g, ' ')}
                            </span>
                            <span className="text-sm text-gray-600">
                              No structured data
                            </span>
                          </div>
                        </div>
                      );
                    }

                    let displayValue = 'N/A';
                    // If numeric
                    if (typeof varData.value === 'number') {
                      displayValue = varData.value.toLocaleString();
                    } else if (typeof varData.value === 'string') {
                      displayValue = varData.value;
                    }

                    const displayCurrency = varData.currency || '';
                    const displayUnit = varData.unit || '';

                    return (
                      <div key={varName} className="bg-gray-50 p-4 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium capitalize">
                            {varName.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-gray-600">
                            {displayCurrency} {displayValue}
                            {displayUnit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dates */}
              {Array.isArray(company.dates) && company.dates.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Relevant Dates</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.dates.map((date, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-100 px-3 py-1 rounded-full text-sm text-blue-800"
                      >
                        {date}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
