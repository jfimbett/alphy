'use client';
import { CompanyInfo } from '@/app/types';

export const CompanyInfoComponent = ({ companies }: { companies: CompanyInfo[] }) => {
  if (!companies || companies.length === 0) return null;

  return (
    <div className="mt-8 border-t pt-6">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-2">
          Company Data
        </span>
        Extracted Information
      </h4>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {companies.map((company, index) => (
          <div key={index} className="p-4 border-b last:border-b-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900">{company.name}</h3>
                {company.sector && <p className="text-sm text-gray-600">{company.sector}</p>}
              </div>
              {company.years && company.years.length > 0 && (
                <div className="col-span-2">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">Year</div>
                    <div className="font-medium">Profits</div>
                    <div className="font-medium">Assets</div>
                    {company.years.map((year) => (
                      <>
                        <div className="text-gray-600">{year}</div>
                        <div className="text-gray-600">
                          {company.profits?.[year] || 'N/A'}
                        </div>
                        <div className="text-gray-600">
                          {company.assets?.[year] || 'N/A'}
                        </div>
                      </>
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