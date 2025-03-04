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

  // For custom "internal" delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);

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

  function handleOpenDeleteModal(session: SessionSummary) {
    setSelectedSession(session);
    setShowDeleteModal(true);
  }

  function handleCloseDeleteModal() {
    setShowDeleteModal(false);
    setSelectedSession(null);
  }
   // Actual deletion logic, only called upon modal confirmation
   async function handleConfirmDelete() {
    if (!selectedSession) return; // safety check

    try {
      const userId = localStorage.getItem('userId') || '';
      const res = await fetch(`/api/sessions/${selectedSession.session_id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete session');
      }

      // Remove it from local state
      setSessions((prev) =>
        prev.filter((s) => s.session_id !== selectedSession.session_id)
      );
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        alert('Error deleting session: ' + err.message);
      } else {
        alert('Unknown error deleting session.');
      }
    } finally {
      handleCloseDeleteModal();
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
              <li
                key={session.session_id}
                className="border p-4 rounded bg-white flex justify-between"
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-600">
                    {session.session_name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(session.created_at).toLocaleString()}
                  </p>
                  {/* <p className="text-sm text-gray-600">Files: {session.file_count}</p> */}
                </div>
                <div className="flex items-center gap-2">
                  {/* View Details */}
                  <button
                    onClick={() => router.push(`/history/${session.session_id}`)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    View Details
                  </button>

                  {/* Delete Session (opens our custom modal) */}
                  <button
                    onClick={() => handleOpenDeleteModal(session)}
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

      {/* Our custom modal for delete confirmation */}
      {showDeleteModal && selectedSession && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-md max-w-sm w-full">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Delete Session
            </h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the session "<strong>{selectedSession.session_name}</strong>"?
              <br />
              This action is <strong>permanent</strong> and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseDeleteModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}