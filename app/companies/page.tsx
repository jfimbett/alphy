// app/companies/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { SessionSummary } from '@/app/history/page'; // or define your own type if needed
import { mergeConsolidatedCompanies, estimateTokens } from '@/app/dashboard/utils/utils';
import * as XLSX from 'xlsx';

/* ------------------------------------------------------------------
 *  - Fetches heavyData (fileTree, consolidatedCompanies, rawResponses …)
 *  - Shows consolidated companies as before
 *  - NEW: for every file in rawResponses we render a toggle button
 *         that reveals the pretty‑printed JSON returned by the LLM.
 * ----------------------------------------------------------------*/

/* ----------  UI helper for pretty JSON  ---------- */
const prettyJSON = (raw: string): string => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

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

interface CompanySource {
  filePath: string;
  pageNumber?: number;
  extractionDate: string;
}

interface CompanyInfo {
  name: string;
  sector?: string;
  years?: number[];
  variables?: Record<string, VariableData>;
  sources?: CompanySource[];
  ownershipPath: string[];
  subsidiaries?: string[];
  investments?: Array<{
    company: string;
    ownershipPercentage?: number;
  }>;
}

interface ConsolidatedCompany extends CompanyInfo {
  type: 'company' | 'fund';
  description: string;
  dates: string[];
  parent?: string;
  children?: ConsolidatedCompany[];
}

export default function CompaniesPage() {
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const existingSessionId = searchParams.get('sessionId');

  // Consolidated companies, raw LLM responses & consolidation debug
  const [companies, setCompanies]             = useState<ConsolidatedCompany[]>([]);
  const [rawResponses, setRawResponses]       = useState<Record<string, { prompt: string; response: string }>>({});
  const [consolidationDebug, setConsolidationDebug] = useState<Array<{ prompt: string; response: string }>>([]);

  // Session list
  const [sessions, setSessions]         = useState<SessionSummary[]>([]);
  // Estimated token usage for this session
  const [tokenCount, setTokenCount]     = useState<number>(0);

  // Loading / error
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // UI state
  const [selectedYears, setSelectedYears]         = useState<Record<string, number>>({});
  const [expandedOwnership, setExpandedOwnership] = useState<Set<string>>(new Set());
  const [shownJson, setShownJson]                 = useState<Set<string>>(new Set());
  const [expandedRaw, setExpandedRaw]             = useState<Set<string>>(new Set());
  // Toggle show/hide consolidation debug
  const [showConsolidation, setShowConsolidation] = useState(true);

  // Download companies data as Excel
  const downloadExcel = () => {
    if (companies.length === 0) {
      alert('No company data to export');
      return;
    }
    const wb = XLSX.utils.book_new();
    companies.forEach(company => {
      const sheetName = company.name.substring(0, 31);
      const rows: any[][] = [];
      rows.push(['Company', company.name]);
      rows.push(['Type', company.type]);
      rows.push([]);
      rows.push(['Metric', 'Year', 'Value', 'Currency', 'Sources']);
      Object.entries(company.variables || {}).forEach(([metric, entries]) => {
        Object.entries(entries as Record<string, any>).forEach(([key, vd]) => {
          const v = vd as any;
          const val = v.value;
          const curr = v.currency || '';
          const sourcesArr = Array.isArray(v.sources)
            ? v.sources.map((s: any) => `${s.filePath}${s.pageNumber ? `:${s.pageNumber}` : ''}`)
            : [];
          const year = key === 'value' ? '' : key;
          rows.push([metric, year, val, curr, sourcesArr.join(', ')]);
        });
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    XLSX.writeFile(wb, 'companies.xlsx');
  };

  // API Key management
  const [apiKeys, setApiKeys]           = useState<{ key: string; created_at: Date }[]>([]);
  const [newApiKey, setNewApiKey]       = useState<string | null>(null);

  // Copy URL feedback
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  /* ----------  API Key Management Functions  ---------- */
  const fetchApiKeys = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const response = await fetch('/api/companies?action=managekeys', {
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      setApiKeys(data.keys);
    } catch (err) {
      console.error('Error fetching API keys:', err);
    }
  };

  const createApiKey = async () => {
    try {
      const response = await fetch('/api/companies', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to create API key');
      const data = await response.json();
      setNewApiKey(data.key);
      fetchApiKeys();
    } catch (err) {
      console.error('Error creating API key:', err);
    }
  };

  /* ----------  Copy Data URL Handler  ---------- */
  const handleCopyUrl = (companyName: string) => {
    if (!existingSessionId) {
      alert('Please select a session first');
      return;
    }
    if (apiKeys.length === 0) {
      alert('Please generate an API key first');
      return;
    }
    const apiKey = apiKeys[0].key;
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
    const url = `${base}/api/companies?name=${encodeURIComponent(companyName)}&sessionId=${existingSessionId}&apiKey=${apiKey}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopyFeedback(companyName);
        setTimeout(() => setCopyFeedback(null), 2000);
      })
      .catch(() => alert('Failed to copy URL'));
  };

  /* ----------  Toggle raw response JSON visibility  ---------- */
  const toggleRaw = (filePath: string) => {
    setExpandedRaw(prev => {
      const next = new Set(prev);
      next.has(filePath) ? next.delete(filePath) : next.add(filePath);
      return next;
    });
  };

  /* ----------  Fetch API keys once on mount  ---------- */
  useEffect(() => {
    fetchApiKeys();
  }, []);

  /* ----------  Fetch available sessions  ---------- */
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    fetch('/api/sessions', {
      headers: { 'x-user-id': userId },
    })
      .then(r => r.json())
      .then(data => {
        if (data.sessions) setSessions(data.sessions);
      })
      .catch(err => console.error('Error fetching sessions:', err));
  }, []);

  /* ----------  Fetch consolidated data & rawResponses  ---------- */
  useEffect(() => {
    // Session expiration / auth check
    if (typeof window !== 'undefined') {
      const loginTS = localStorage.getItem('loginTimestamp');
      const userId = localStorage.getItem('userId');
      const now = Date.now();
      const TTL = 24 * 60 * 60 * 1000; // 24h session TTL
      if (!loginTS || !userId || now - parseInt(loginTS) > TTL) {
        localStorage.removeItem('loginTimestamp');
        localStorage.removeItem('userId');
        localStorage.removeItem('currentSessionId');
        router.push('/login');
        return;
      }
    }
    const fetchConsolidatedData = async () => {
      if (!existingSessionId) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/store-heavy-data?sessionId=${existingSessionId}`);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        // Use consolidated companies if available, otherwise fall back to extracted companies
        let comps = data.consolidatedCompanies || [];
        if ((!comps || comps.length === 0) && data.extractedCompanies) {
          // Merge extractedCompanies (mapping filePath -> CompanyInfo[]) into a flat array
          const allExtracted: any[] = Object.values(data.extractedCompanies).flat();
          // mergeConsolidatedCompanies will dedupe and combine variables/sources appropriately
          comps = mergeConsolidatedCompanies([allExtracted]);
        }
        // Ensure each company has a type (default to 'company') for rendering
        const normalized: typeof comps = comps.map(c => ({
          ...c,
          type: c.type ?? 'company'
        }));
        setCompanies(normalized);
        setRawResponses(data.rawResponses || {});
        // Load consolidation debug entries if present
        setConsolidationDebug(data.consolidationDebug || []);
      } catch (err: any) {
        console.error('Error loading companies:', err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchConsolidatedData();
  }, [existingSessionId]);

  // Recompute token count when LLM responses change
  useEffect(() => {
    let total = 0;
    Object.values(rawResponses).forEach(({ prompt, response }) => {
      total += estimateTokens(prompt) + estimateTokens(response);
    });
    consolidationDebug.forEach(({ prompt, response }) => {
      total += estimateTokens(prompt) + estimateTokens(response);
    });
    setTokenCount(total);
  }, [rawResponses, consolidationDebug]);

  /* ----------  Early return: loading / error / noData  ---------- */
  if (loading) return <div className="p-6">Loading…</div>;
  if (error)   return <div className="p-6 text-red-600">{error}</div>;
  if (searchParams.get('message') === 'noData') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-600">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-gray-600">No company data retrieved.</p>
        </main>
      </div>
    );
  }

  /* ----------  Helpers for company rendering  ---------- */
  const getCompanyYears = (company: ConsolidatedCompany): number[] => {
    const years = new Set<number>();
    Object.values(company.variables ?? {}).forEach(variable => {
      Object.keys(variable).forEach(yearStr => {
        const y = parseInt(yearStr, 10);
        if (!isNaN(y)) years.add(y);
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  /* ----------  Render section for companies or funds  ---------- */
  const renderCompanySection = (type: 'company' | 'fund', color: string) => {
    const filtered = companies.filter(c => c.type === type);
    if (filtered.length === 0) return null;

    return (
      <div className="mb-8 text-gray-500">
        <h2 className="text-xl font-bold mb-4" style={{ color }}>
          {type === 'fund' ? 'Funds' : 'Companies'}
        </h2>
        {filtered.map(company => {
          const years      = getCompanyYears(company);
          const latestYear = years[0] || null;
          const selYear    = selectedYears[company.name] ?? latestYear;

          return (
            <div
              key={company.name}
              className="bg-white p-6 rounded-lg shadow-sm mb-4 border-l-4"
              style={{ borderColor: color }}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{company.name}</h2>
                <div className="flex items-center gap-3">
                  {years.length > 0 && (
                    <select
                      value={selYear || ''}
                      onChange={e => {
                        const yr = parseInt(e.target.value, 10);
                        setSelectedYears(prev => ({ ...prev, [company.name]: yr }));
                      }}
                      className="px-4 py-2 border rounded"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => {
                      const next = new Set(expandedOwnership);
                      next.has(company.name)
                        ? next.delete(company.name)
                        : next.add(company.name);
                      setExpandedOwnership(next);
                    }}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  >
                    {expandedOwnership.has(company.name)
                      ? 'Hide Ownership'
                      : 'Show Ownership'}
                  </button>
                </div>
              </div>

              {/* Description */}
              {company.description && (
                <p className="text-gray-600 mb-4">{company.description}</p>
              )}

              {/* Variables Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(company.variables ?? {}).map(([varName, varData]) => {
                  let dataToShow: any = null;
                  if (selYear !== null) {
                    dataToShow = varData[selYear];
                  } else if (varData.value !== undefined) {
                    dataToShow = varData;
                  }
                  if (!dataToShow) return null;

                  return (
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
                          {dataToShow.currency} {dataToShow.value?.toLocaleString()}
                          {dataToShow.unit}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Sources:
                        {dataToShow.sources?.map((src: { filePath: string; pageNumber?: number; confidence?: number }, idx: number) => (
                          <div key={idx} className="mt-1">
                            • {src.filePath.split('/').pop()}
                            {src.pageNumber && ` (Page ${src.pageNumber})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Ownership tree */}
                {expandedOwnership.has(company.name) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">Ownership Structure</h3>
                    <OwnershipTree company={company} />
                  </div>
                )}
              </div>

              {/* Raw Data & Copy URL Controls */}
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => {
                    const next = new Set(shownJson);
                    next.has(company.name)
                      ? next.delete(company.name)
                      : next.add(company.name);
                    setShownJson(next);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {shownJson.has(company.name) ? 'Hide Raw Data' : 'Show Raw Data'}
                </button>

                <button
                  onClick={() => handleCopyUrl(company.name)}
                  className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                  disabled={apiKeys.length === 0}
                >
                  <ClipboardIcon className="w-4 h-4" />
                  Copy Data URL
                </button>
                {copyFeedback === company.name && (
                  <span className="absolute left-0 -bottom-5 text-xs text-green-600">
                    URL copied!
                  </span>
                )}
                {apiKeys.length === 0 && (
                  <span className="text-sm text-gray-500">
                    Generate API key in settings
                  </span>
                )}
              </div>

              {/* Company JSON Preview */}
              {shownJson.has(company.name) && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <pre className="text-xs overflow-auto max-h-96">
                    {JSON.stringify(company, null, 2)}
                  </pre>
                </div>
              )}
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
            onChange={e => {
              const sid = e.target.value;
              router.push(`/companies?sessionId=${sid}`);
            }}
          >
            <option value="">-- Choose a session --</option>
            {sessions.map(s => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name} (ID: {s.session_id})
              </option>
            ))}
          </select>
        </div>
        {/* Download Excel button */}
        <div className="mb-6">
          <button
            onClick={downloadExcel}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Download Excel
          </button>
        </div>
        {/* Token usage summary */}
        <div className="mb-4 text-gray-700">
          <span className="font-medium">Estimated LLM tokens used:</span>{" "}
          <span className="font-semibold">{tokenCount}</span>
        </div>

        {renderCompanySection('fund', '#2563eb')}
        {renderCompanySection('company', '#16a34a')}

        {/* ───────────────────────────────────────────────────────────
            NEW ‑ Raw LLM JSON per file
            ──────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Raw LLM JSON per file</h2>
          {Object.keys(rawResponses).length === 0 ? (
            <p className="text-gray-600 italic">
              No raw responses were stored for this session.
            </p>
          ) : (
            <ul className="space-y-4">
              {Object.entries(rawResponses).map(([filePath, dbg]) => {
                const isOpen = expandedRaw.has(filePath);
                const fileName = filePath.split('/').pop() ?? filePath;
                return (
                  <li key={filePath} className="border p-4 rounded-lg bg-white">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{fileName}</span>
                      <button
                        onClick={() => toggleRaw(filePath)}
                        className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                      >
                        {isOpen ? 'Hide' : 'Show'} raw JSON
                      </button>
                    </div>
                    {isOpen && (
                      <pre className="mt-3 bg-gray-50 rounded p-3 text-xs overflow-x-auto max-h-80 whitespace-pre-wrap">
                        {prettyJSON(dbg.response)}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {/* ───────────────────────────────────────────────────────────
            Raw LLM Consolidation JSON (toggleable)
            ──────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Raw LLM Consolidation JSON</h2>
            {consolidationDebug.length > 0 && (
              <button
                onClick={() => setShowConsolidation(!showConsolidation)}
                className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                {showConsolidation ? 'Hide Debug' : 'Show Debug'}
              </button>
            )}
          </div>
          {consolidationDebug.length === 0 ? (
            <p className="text-gray-600 italic">
              No consolidation debug stored for this session.
            </p>
          ) : (
            showConsolidation && (
              <ul className="space-y-4">
                {consolidationDebug.map((dbg, idx) => (
                  <li key={idx} className="border p-4 rounded-lg bg-white">
                    <div className="font-medium">Entry {idx + 1}</div>
                    <div className="mt-2 text-sm text-gray-500">Prompt:</div>
                    <pre className="mt-1 bg-gray-50 rounded p-2 text-xs overflow-auto whitespace-pre-wrap">
                      {prettyJSON(dbg.prompt)}
                    </pre>
                    <div className="mt-2 text-sm text-gray-500">Response:</div>
                    <pre className="mt-1 bg-gray-50 rounded p-2 text-xs overflow-auto whitespace-pre-wrap">
                      {prettyJSON(dbg.response)}
                    </pre>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>
      </main>
    </div>
  );
}

// OwnershipTree component
const OwnershipTree = ({ company }: { company: ConsolidatedCompany }) => (
  <div className="ml-4 border-l-2 border-gray-200 pl-4">
    {company.ownershipPath?.map((owner, idx) => (
      <div key={idx} className="text-sm text-gray-600">
        {idx === 0 ? 'Root Owner:' : '→'} {owner}
      </div>
    ))}
    {company.type === 'fund' && (company.investments ?? []).length > 0 && (
      <div className="mt-2">
        <h4 className="font-semibold text-sm mb-1">Investments:</h4>
        {company.investments!.map((inv, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span>{inv.company}</span>
            {inv.ownershipPercentage != null && (
              <span className="text-gray-500">({inv.ownershipPercentage}%)</span>
            )}
          </div>
        ))}
      </div>
    )}
    {company.subsidiaries && company.subsidiaries.length > 0 && (
      <div className="mt-2">
        <h4 className="font-semibold text-sm mb-1">Subsidiaries:</h4>
        {company.subsidiaries!.map((sub, idx) => (
          <div key={idx} className="text-sm">{sub}</div>
        ))}
      </div>
    )}
    {company.children?.map(child => (
      <div key={child.name} className="mt-2">
        <div className="font-medium">{child.name}</div>
        <OwnershipTree company={child} />
      </div>
    ))}
  </div>
);

// Clipboard icon component
const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
    />
  </svg>
);
