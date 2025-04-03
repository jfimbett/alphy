// app/companies/page.tsx
'use client';

import React, { useEffect, useState } from 'react';  // <-- ensure React is imported
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { SessionSummary } from '@/app/history/page'; // or define your own type if needed

interface VariableData {
  value?: number | string;
  currency?: string;
  unit?: string;
  sources: Array<{
    filePath: string;
    pageNumber?: number;
    confidence?: number;
  }>;
  [year: number]: {
    value?: number | string;
    currency?: string;
    unit?: string;
    sources: Array<{
      filePath: string;
      pageNumber?: number;
      confidence?: number;
    }>;
  };
}

interface ConsolidatedCompany {
  name: string;
  type: 'company' | 'fund';
  description: string;
  variables: Record<string, VariableData>;
  dates: string[];
  parent?: string;
  children?: ConsolidatedCompany[];
  ownershipPath: string[];
  sources: Array<{
    filePath: string;
    pageNumber?: number;
    confidence?: number;
  }>;
  // The following are optional properties that might be present for "fund" types or other data structures:
  investments?: Array<{
    company: string;
    ownershipPercentage?: number;
  }>;
  subsidiaries?: string[];
}

export default function CompaniesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingSessionId = searchParams.get('sessionId');
  
  const [companies, setCompanies] = useState<ConsolidatedCompany[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYears, setSelectedYears] = useState<Record<string, number>>({});
  const [expandedOwnership, setExpandedOwnership] = useState<Set<string>>(new Set());

  // New state for raw JSON toggling
  const [shownJson, setShownJson] = useState<Set<string>>(new Set());

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) return; // Not logged in
    fetch('/api/sessions', {
      headers: { 'x-user-id': userId }
    })
      .then(r => r.json())
      .then(data => {
        if (data.sessions) {
          setSessions(data.sessions);
        }
      })
      .catch(err => {
        console.error('Error fetching sessions for Companies page:', err);
      });
  }, []);

  useEffect(() => {
    const fetchConsolidatedData = async () => {
      if (!existingSessionId) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/store-heavy-data?sessionId=${existingSessionId}`);
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
  }, [existingSessionId]);

  // Add conditional rendering for the "no company data retrieved" message
  if (searchParams.get('message') === 'noData') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-600">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-gray-600">No company data retrieved.</p>
        </main>
      </div>
    );
  }

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
                <div className="flex items-center gap-3">
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
                  <button
                    onClick={() => {
                      const newSet = new Set(expandedOwnership);
                      newSet.has(company.name) 
                        ? newSet.delete(company.name) 
                        : newSet.add(company.name);
                      setExpandedOwnership(newSet);
                    }}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  >
                    {expandedOwnership.has(company.name) 
                      ? 'Hide Ownership' 
                      : 'Show Ownership'}
                  </button>
                </div>
              </div>
              
              {company.description && (
                <p className="text-gray-600 mb-4">{company.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Updated Variable Display Logic */}
                {Object.entries(company.variables).map(([varName, variableData]) => {
                  let varData: any = null;
                  
                  // Check for year-specific data
                  if (selectedYear !== null) {
                    varData = variableData[selectedYear];
                  } 
                  // Fallback to general value if no year is selected
                  else if (variableData.value !== undefined) {
                    varData = variableData;
                  }

                  return varData ? (
                    <div key={varName} className="p-4 rounded" style={{ backgroundColor: `${color}10` }}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">
                          {varName.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-gray-600">
                          {varData.currency} {varData.value?.toLocaleString()}
                          {varData.unit}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Sources:
                        {varData.sources?.map((source: any, idx: number) => (
                          <div key={idx} className="mt-1">
                            • {source.filePath.split('/').pop()} 
                            {source.pageNumber && ` (Page ${source.pageNumber})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })}
                
                {/* Conditionally Rendered Ownership Structure */}
                {expandedOwnership.has(company.name) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">Ownership Structure</h3>
                    <OwnershipTree company={company} />
                  </div>
                )}
              </div>

              {/* Show/Hide Raw Data Button & JSON Preview */}
              <div className="mt-4">
                <button
                  onClick={() => {
                    const newSet = new Set(shownJson);
                    newSet.has(company.name) 
                      ? newSet.delete(company.name) 
                      : newSet.add(company.name);
                    setShownJson(newSet);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {shownJson.has(company.name) ? 'Hide Raw Data' : 'Show Raw Data'}
                </button>
                
                {shownJson.has(company.name) && (
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <pre className="text-xs overflow-auto max-h-96">
                      {JSON.stringify(company, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Session Selector */}
        <div className="mb-4 text-gray-500">
          <label className="block text-gray-700 font-medium mb-1">Select Session:</label>
          <select
            className="border p-2 rounded"
            value={existingSessionId || ''}
            onChange={(e) => {
              const newSessionId = e.target.value;
              router.push(`/companies?sessionId=${newSessionId}`);
            }}
          >
            <option value="">-- Choose a session --</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name} (ID: {s.session_id})
              </option>
            ))}
          </select>
        </div>

        {renderCompanySection('fund', '#2563eb')}
        {renderCompanySection('company', '#16a34a')}
      </main>
    </div>
  );
}

// OwnershipTree component with investments and subsidiaries display
const OwnershipTree = ({ company }: { company: ConsolidatedCompany }) => (
  <div className="ml-4 border-l-2 border-gray-200 pl-4">
    {/* Existing ownership path */}
    {company.ownershipPath?.map((owner, idx) => (
      <div key={idx} className="text-sm text-gray-600">
        {idx === 0 ? 'Root Owner:' : '→'} {owner}
      </div>
    ))}
    
    {/* Display investments for funds */}
    {company.type === 'fund' && (company.investments ?? []).length > 0 && (
      <div className="mt-2">
        <h4 className="font-semibold text-sm mb-1">Investments:</h4>
        {(company.investments ?? []).map((investment, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span>{investment.company}</span>
            {investment.ownershipPercentage && (
              <span className="text-gray-500">
                ({investment.ownershipPercentage}%)
              </span>
            )}
          </div>
        ))}
      </div>
    )}

    {/* Display subsidiaries */}
    {(company.subsidiaries ?? []).length > 0 && (
      <div className="mt-2">
        <h4 className="font-semibold text-sm mb-1">Subsidiaries:</h4>
        {(company.subsidiaries ?? []).map((sub, idx) => (
          <div key={idx} className="text-sm">{sub}</div>
        ))}
      </div>
    )}

    {/* Recursive children */}
    {company.children?.map(child => (
      <div key={child.name} className="mt-2">
        <div className="font-medium">{child.name}</div>
        <OwnershipTree company={child} />
      </div>
    ))}
  </div>
);
