// app/data-aggregated/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type AccountKey = string; // e.g. "AccountsPayableCurrent", "Assets", etc.
interface AccountDefinition {
  description: string;
  instant: number;       // 1 or 0
  name: string;
  taxonomy: string;      // e.g. "us-gaap"
  units: string;         // e.g. "USD" or "shares"
}

// Suppose the aggregated data from your remote returns array of objects
// e.g. { cik: '0000320193', year: 2022, value: 123456, ... }
interface AggregatedDataItem {
  cik: string;
  year: number;
  value: number;
  [key: string]: string | number;
}

export default function DataAggregatedPage() {
  // 1) States
  const [accounts, setAccounts] = useState<Record<AccountKey, AccountDefinition>>({})
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [year, setYear] = useState<string>("2022")

  const [loadingData, setLoadingData] = useState(false)
  const [aggregatedData, setAggregatedData] = useState<AggregatedDataItem[]>([])

  const [error, setError] = useState<string>("")

  // 2) Fetch all accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      setLoadingAccounts(true)
      try {
        const res = await fetch("/api/all-accounts")
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Failed fetching accounts.")
        }
        const data = await res.json()
        setAccounts(data)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(`Error: ${err.message}`)
        } else {
          setError("Unknown error fetching accounts.")
        }
      } finally {
        setLoadingAccounts(false)
      }
    }
    fetchAccounts()
  }, [])

  // 3) Function to load aggregated data for the chosen account
  async function handleLoadData() {
    if (!selectedAccount) {
      alert("Please select an account first.")
      return
    }

    setLoadingData(true)
    setAggregatedData([])
    setError("")

    try {
      // e.g. /api/account-data?account=AccountsPayableCurrent&year=2022
      const query = new URLSearchParams({
        account: selectedAccount,
        year: year || "",
      })
      const res = await fetch(`/api/account-data?${query.toString()}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed fetching aggregated data.")
      }
      const data = await res.json()
      // data is presumably an array of { cik, value, ... }
      setAggregatedData(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Error: ${err.message}`)
      } else {
        setError("Unknown error fetching aggregated data.")
      }
    } finally {
      setLoadingData(false)
    }
  }

  // 4) Render
  const accountKeys = Object.keys(accounts)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
          Aggregated Data by Account
        </h1>

        {/* If error */}
        {error && <p className="text-red-600">{error}</p>}

        {/* Accounts dropdown */}
        <div className="bg-white p-4 shadow rounded space-y-4 text-gray-600">
          <label className="block font-semibold">Select an Account:</label>
          {loadingAccounts ? (
            <Skeleton className="h-6 w-full text-gray-600" />
          ) : (
            <select
              className="border rounded px-2 py-1 w-full text-sm"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">-- Choose an account --</option>
              {accountKeys.map((key) => (
                <option key={key} value={key}>
                  {key} ({accounts[key].units})
                </option>
              ))}
            </select>
          )}

          {/* Optional year input */}
          <label className="block font-semibold">Year:</label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2022"
            className="border rounded px-2 py-1 w-full text-sm"
          />

          {/* Button to load data */}
          <div className="text-right">
            <button
              onClick={handleLoadData}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Load Aggregated Data
            </button>
          </div>
        </div>

        {/* Aggregated data results */}
        <div className="bg-white p-4 shadow rounded">
          {loadingData && <Skeleton className="h-4 w-full" />}
          {!loadingData && aggregatedData.length > 0 && (
            <div>
              <h2 className="font-semibold mb-2 text-lg">
                Results for {selectedAccount} ({year || "All Years"})
              </h2>
              <table className="w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">CIK</th>
                    <th className="border p-2 text-left">Year</th>
                    <th className="border p-2 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedData.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border p-2">{item.cik}</td>
                      <td className="border p-2">{item.year}</td>
                      <td className="border p-2">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingData && aggregatedData.length === 0 && (
            <p className="text-gray-600">No data loaded yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
