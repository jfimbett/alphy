// components/ui/company-facts-page.tsx
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Adjust these if you have environment variables:
//const BASE_URL = process.env.NEXT_PUBLIC_EXTERNAL_API_BASE_URL || "https://df1c-194-214-160-21.ngrok-free.app";
const API_TOKEN = process.env.NEXT_PUBLIC_EXTERNAL_API_TOKEN || "t3stt%40ken";

interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { units: Record<string, Array<{ end: string; val: number }>> }>>;
}

interface CompanyFactsPageProps {
  cik: string; // "0000320193" or similar
}

interface GeneralInfo {
  cik: string;
  ein: string;
  addresses: {
    business: {
      city: string;
      stateOrCountry: string;
      street1: string;
      street2: string | null;
      zipCode: string;
    };
    mailing: {
      city: string;
      stateOrCountry: string;
      street1: string;
      street2: string | null;
      zipCode: string;
    };
  };
  category: string;
  entityType: string;
  exchanges: string[];
  // There's also a huge "filings" object, but we skip it for brevity.
}


export function CompanyFactsPage({ cik }: CompanyFactsPageProps) {

  const [companyFacts, setCompanyFacts] = useState<CompanyFacts | null>(null);
  const [generalInfo, setGeneralInfo] = useState<GeneralInfo | null>(null);

  const [loading, setLoading] = useState(false);
  console.log("loading", loading);
  const [loadingFacts] = useState(false);
  // console log the setLoadingFacts
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [selectedFactPath, setSelectedFactPath] = useState("");
  const [timeSeriesData, setTimeSeriesData] = useState<Array<{ x: string; y: number }>>([]);

  // Convert "0000320193" -> 320193
  const numericCik = parseInt(cik, 10);

  async function handleRetrieveFacts() {
    setLoading(true);
    setCompanyFacts(null);
    setTimeSeriesData([]);
    setSelectedFactPath("");

    try {
      //const url = `${BASE_URL}/company_facts?cik=${numericCik}&api_token=${API_TOKEN}`;
      const url = `/api/company-facts?cik=${numericCik}&api_token=${API_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Error fetching facts: ${res.statusText}`);
      }
      const data = await res.json();
      setCompanyFacts(data);
    } catch (error) {
      console.error("Failed to retrieve facts:", error);
      alert("Error retrieving facts. Check console for details.");
    } finally {
      setLoading(false);
    }
  }


    // Flatten available fact keys from the returned JSON
    function getAvailableFactKeys(): string[] {
      if (!companyFacts?.facts) return [];
      const keys: string[] = [];
      for (const [domain, factGroup] of Object.entries(companyFacts.facts)) {
        for (const factName of Object.keys(factGroup)) {
          keys.push(`${domain}/${factName}`);
        }
      }
      return keys.sort();
    }

    function handleSelectFact(path: string) {
      setSelectedFactPath(path);
      if (!companyFacts?.facts) return;
  
      // Split "dei/EntityCommonStockSharesOutstanding"
      const [domain, factName] = path.split("/");
      const factObj = companyFacts.facts[domain]?.[factName];
      if (!factObj?.units) {
        setTimeSeriesData([]);
        return;
      }
  
      // pick the first unit key or "shares"
      const unitKeys = Object.keys(factObj.units);
      if (unitKeys.length === 0) {
        setTimeSeriesData([]);
        return;
      }
      const firstUnitKey = unitKeys[0];
      const dataPoints = factObj.units[firstUnitKey] as Array<{
        end: string;
        val: number;
      }>;
  
      const chartData = dataPoints.map((dp) => ({
        x: dp.end,
        y: dp.val,
      }));
      // sort by date
      chartData.sort((a, b) => (a.x < b.x ? -1 : 1));
      setTimeSeriesData(chartData);
    }


    // -----------------------------------------
  // FETCH #2: General Info (submission_history)
  // -----------------------------------------
  async function handleRetrieveGeneralInfo() {
    setLoadingInfo(true);
    setGeneralInfo(null);

    try {
      const url = `/api/submission-history?cik=${numericCik}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Error fetching general info: ${res.statusText}`);
      }
      const data = await res.json();
      setGeneralInfo(data);
    } catch (error) {
      console.error(error);
      alert("Error retrieving general info. Check console for details.");
    } finally {
      setLoadingInfo(false);
    }
  }

  

  return (
    <div className="p-4 bg-white rounded shadow space-y-6 text-gray-800">
      <h2 className="text-lg font-bold">
        CIK (raw): {cik} &mdash; (numeric: {numericCik})
      </h2>

      {/* Buttons */}
      <div className="flex gap-4">
        {/* Retrieve All Company Facts */}
        {!companyFacts && !loadingFacts && (
          <button
            onClick={handleRetrieveFacts}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retrieve all Company Facts
          </button>
        )}
        {loadingFacts && <Skeleton className="h-4 w-[200px]" />}

        {/* Retrieve General Info */}
        {!generalInfo && !loadingInfo && (
          <button
            onClick={handleRetrieveGeneralInfo}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Retrieve General Info
          </button>
        )}
        {loadingInfo && <Skeleton className="h-4 w-[200px]" />}
      </div>

      {/* General Info Display */}
      {generalInfo && (
        <div className="border p-4 rounded">
          <h3 className="font-semibold mb-2">General Info</h3>
          <p>
            <strong>CIK:</strong> {generalInfo.cik}
          </p>
          <p>
            <strong>EIN:</strong> {generalInfo.ein}
          </p>
          <p>
            <strong>Category:</strong> {generalInfo.category}
          </p>
          <p>
            <strong>Entity Type:</strong> {generalInfo.entityType}
          </p>
          <p>
            <strong>Exchanges:</strong> {generalInfo.exchanges.join(", ")}
          </p>
          <div className="mt-2">
            <strong>Business Address:</strong>
            <p>
              {generalInfo.addresses.business.street1}{" "}
              {generalInfo.addresses.business.street2} <br />
              {generalInfo.addresses.business.city},{" "}
              {generalInfo.addresses.business.stateOrCountry},{" "}
              {generalInfo.addresses.business.zipCode}
            </p>
          </div>
          <div className="mt-2">
            <strong>Mailing Address:</strong>
            <p>
              {generalInfo.addresses.mailing.street1}{" "}
              {generalInfo.addresses.mailing.street2} <br />
              {generalInfo.addresses.mailing.city},{" "}
              {generalInfo.addresses.mailing.stateOrCountry},{" "}
              {generalInfo.addresses.mailing.zipCode}
            </p>
          </div>
        </div>
      )}

      {/* Company Facts + Chart */}
      {companyFacts && (
        <div className="border p-4 rounded space-y-4">
          <p className="text-gray-600">
            <strong>Entity Name:</strong> {companyFacts.entityName}
          </p>

          {/* Fact selector */}
          <div>
            <label className="block mb-1 mt-4 font-medium text-sm">
              Select a Fact to Plot:
            </label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={selectedFactPath}
              onChange={(e) => handleSelectFact(e.target.value)}
            >
              <option value="">-- Choose --</option>
              {getAvailableFactKeys().map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          {/* Chart for the chosen fact */}
          {selectedFactPath && timeSeriesData.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2 text-gray-700">
                Chart for: {selectedFactPath}
              </h4>
              <Chart
                type="line"
                height={300}
                series={[
                  {
                    name: selectedFactPath,
                    data: timeSeriesData,
                  },
                ]}
                options={{
                  chart: {
                    id: "factsChart",
                    toolbar: { show: false },
                  },
                  xaxis: {
                    type: "datetime",
                  },
                }}
              />
            </div>
          )}

          {selectedFactPath && timeSeriesData.length === 0 && (
            <p className="text-red-500 mt-2">
              No time-series data found for this fact.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
