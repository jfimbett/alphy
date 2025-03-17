// app/companies/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface VariableData {
  value?: number | string;
  currency?: string;
  unit?: string;
}

interface ConsolidatedCompany {
  name: string;
  type: 'company' | 'fund';
  description: string;
  variables: Record<string, Record<number, VariableData>>;
  dates: string[];
}

export default function CompaniesPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [companies, setCompanies] = useState<ConsolidatedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYears, setSelectedYears] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchConsolidatedData = async () => {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/store-heavy-data?sessionId=${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();

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

  const getCompanyYears = (company: ConsolidatedCompany): number[] => {
    const years = new Set<number>();
    Object.values(company.variables).forEach(variable => {
      Object.keys(variable).forEach(yearStr => {
        const year = parseInt(yearStr, 10);
        if (!isNaN(year)) years.add(year);
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const renderCompanySection = (type: 'company' | 'fund', color: string) => {
    const filteredCompanies = companies.filter(c => c.type === type);
    if (filteredCompanies.length === 0) return null;

    return (
      <div className="mb-8 text-gray-500">
        <Navbar />
        <h2 className="text-xl font-bold mb-4" style={{ color }}>
          {type === 'fund' ? 'Funds' : 'Companies'}
        </h2>
        {filteredCompanies.map(company => {
          const companyYears = getCompanyYears(company);
          const latestYear = companyYears[0] || null;
          const selectedYear = selectedYears[company.name] ?? latestYear;

          return (
            <div 
              key={company.name}
              className="bg-white p-6 rounded-lg shadow-sm mb-4 border-l-4"
              style={{ borderColor: color }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{company.name}</h2>
                {companyYears.length > 0 && (
                  <select
                    value={selectedYear || ''}
                    onChange={(e) => {
                      const year = parseInt(e.target.value, 10);
                      setSelectedYears(prev => ({
                        ...prev,
                        [company.name]: year
                      }));
                    }}
                    className="px-4 py-2 border rounded"
                  >
                    {companyYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                )}
              </div>
              
              {company.description && (
                <p className="text-gray-600 mb-4">{company.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(company.variables).map(([varName, years]) => {
                  const varData = years[selectedYear];
                  return varData ? (
                    <div 
                      key={varName}
                      className="p-4 rounded"
                      style={{ backgroundColor: `${color}10` }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">
                          {varName.replace(/_/g, ' ')}
                        </span>
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
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {renderCompanySection('fund', '#2563eb')}
        {renderCompanySection('company', '#16a34a')}
      </main>
    </div>
  );
}