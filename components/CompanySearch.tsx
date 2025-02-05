import { useEffect, useState } from 'react';

interface Company {
  cik: string;
  name: string;
  tickers: string[];
}

export default function CompanySearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both datasets in parallel
        const [namesRes, tickersRes] = await Promise.all([
          fetch('https://03ac-194-214-160-21.ngrok-free.app/cik_names?api_token=t3stt%40ken'),
          fetch('https://03ac-194-214-160-21.ngrok-free.app/cik_tickers?api_token=t3stt%40ken')
        ]);

        const namesData: Record<string, string> = await namesRes.json();
        const tickersData: Record<string, string[]> = await tickersRes.json();

        // Merge the datasets
        const mergedCompanies = Object.entries(tickersData).map(([cikWithZeros, tickers]) => {
          // Remove leading zeros from CIK
          const cik = parseInt(cikWithZeros, 10).toString();
          return {
            cik,
            name: namesData[cik] || 'Unknown Company',
            tickers
          };
        });

        setCompanies(mergedCompanies);
        setLoading(false);
      } catch {
        setError('Failed to load company data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredCompanies = companies.filter(company => {
    const searchLower = searchTerm.toLowerCase();
    return (
      company.name.toLowerCase().includes(searchLower) ||
      company.tickers.some(ticker => ticker.toLowerCase().includes(searchLower)) ||
      company.cik.includes(searchTerm)
    );
  });

  if (loading) return <div className="p-4 text-gray-500">Loading company data...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Company Search</h1>
      
      <input
        type="text"
        placeholder="Search by company name, ticker, or CIK..."
        className="w-full p-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="space-y-2">
        {filteredCompanies.slice(0, 10).map(company => (
          <div
            key={company.cik}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{company.name}</h3>
                <p className="text-gray-600 text-sm">CIK: {company.cik}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {company.tickers.map(ticker => (
                  <span
                    key={ticker}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {ticker}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCompanies.length === 0 && searchTerm && (
        <div className="text-gray-500 text-center py-4">
          No companies found matching `{searchTerm}`
        </div>
      )}
    </div>
  );
}