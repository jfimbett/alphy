'use client';
import { CompanyInfo } from '@/app/types';
import React, { useEffect, useState } from 'react';

// Type guard for company data validation
function isCompanyArray(data: any): data is CompanyInfo[] {
  return Array.isArray(data) && data.every(item => 
    typeof item.name === 'string' &&
    (typeof item.sector === 'string' || item.sector === undefined) &&
    (typeof item.years === 'undefined' || Array.isArray(item.years)) &&
    (typeof item.profits === 'undefined' || typeof item.profits === 'object') &&
    (typeof item.assets === 'undefined' || typeof item.assets === 'object')
  );
}

export const CompanyInfoComponent = ({ companies }: { companies: any }) => {
  const [error, setError] = useState<string | null>(null);
  const [validatedCompanies, setValidatedCompanies] = useState<CompanyInfo[]>([]);

  useEffect(() => {
    if (!companies) {
      setError('No company data provided');
      setValidatedCompanies([]);
      return;
    }

    if (!isCompanyArray(companies)) {
      setError('Invalid company data format');
      setValidatedCompanies([]);
      return;
    }

    setError(null);
    setValidatedCompanies(companies);
  }, [companies]);

  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-red-600 font-medium">Data Error</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (validatedCompanies.length === 0) return null;

  return (
    <div className="mt-8 border-t pt-6">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-2">
          Company Data
        </span>
        Extracted Information
      </h4>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden text-gray-800">
        {validatedCompanies.map((company, index) => (
          <div key={index} className="p-4 border-b last:border-b-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900">{company.name}</h3>
                {company.sector && <p className="text-sm text-gray-600">{company.sector}</p>}
              </div>
              {company.years && company.years.length > 0 && (
                <div className="col-span-2">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="font-medium">Year</div>
                    <div className="font-medium">Profits</div>
                    <div className="font-medium">Assets</div>
                    <div className="font-medium"> EBITDA </div>
                    {company.years.map((year, yearIndex) => (
                      <React.Fragment key={yearIndex}>
                        <div className="text-gray-600">{year}</div>
                        <div className="text-gray-600">
                          {company.profits?.[year] || 'N/A'}
                        </div>
                        <div className="text-gray-600">
                          {company.assets?.[year] || 'N/A'}
                        </div>
                        <div className="text-gray-600">
                          {company.ebitda?.[year] || 'N/A'}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};