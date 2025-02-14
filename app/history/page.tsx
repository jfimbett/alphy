'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@heroicons/react/24/outline';
import Navbar from '@/components/Navbar';

export interface SessionSummary {
  session_id: number;
  session_name: string;
  created_at: string;
  file_count: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch user sessions on mount
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      // Not logged in
      router.push('/login');
      return;
    }

    fetch('/api/sessions', {
      headers: { 'x-user-id': userId }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSessions(data.sessions || []);
      })
      .catch((err) => {
        setError(err.message || 'Error fetching sessions');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  // Delete a session
  async function handleDeleteSession(sessionId: number) {
    const userId = localStorage.getItem('userId') || '';
     // First confirmation:
    if (!confirm('Are you sure you want to delete this session?')) return;
    // Second confirmation:
    if (!confirm('This action is permanent and cannot be undone. Continue?')) return;


    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete session');
      }

      // Remove it from local state
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert('Error deleting session: ' + err.message);
      } else {
        alert('Error deleting session');
      }
      console.error(err);
    }
  }

  if (loading) {
    return <div className="p-4">Loading sessions...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Your Sessions</h1>
        {sessions.length === 0 ? (
          <p>No sessions found.</p>
        ) : (
          <ul className="space-y-4">
            {sessions.map((session) => (
              <li key={session.session_id} className="border p-4 rounded bg-white flex justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-600">
                    {session.session_name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(session.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {/*Files: {session.file_count}*/}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Details */}
                  <button
                    onClick={() => router.push(`/history/${session.session_id}`)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    View Details
                  </button>

                  {/* Trash Icon => Delete Session */}
                  <button
                    onClick={() => handleDeleteSession(session.session_id)}
                    className="p-2 hover:bg-red-50 rounded"
                    title="Delete Session"
                  >
                    <TrashIcon className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
