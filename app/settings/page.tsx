'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      // Retrieve user info from localStorage
      const userId = localStorage.getItem('userId');
      const email = localStorage.getItem('userEmail');
      if (!userId || !email) {
        router.push('/login');
        return;
      }
      setUser({ id: userId, email });
      
      // Fetch API keys from your local endpoint
      try {
        const res = await fetch(`/api/api-keys?userId=${userId}`);
        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          console.error("Error parsing API keys JSON: ", error);
        }
        if ((data as any).apiKeys) {
          setApiKeys(
            Object.fromEntries(
              (data as any).apiKeys.map((k: { provider: string; decrypted_key: string }) => [
                k.provider,
                k.decrypted_key
              ])
            )
          );
        }
      } catch (err) {
        console.error('Error fetching API keys:', err);
      }
    };
    fetchUser();
  }, [router]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          company: user.company // if you store company info
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error updating profile');
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage('Error updating profile');
      console.error(err);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error changing password');
      setMessage('Password changed successfully');
    } catch (err) {
      setMessage('Error changing password');
      console.error(err);
    }
  };

  const saveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updates = Object.entries(apiKeys).map(([provider, key]) => ({
        user_id: user.id,
        provider,
        decrypted_key: key,
        updated_at: new Date().toISOString()
      }));

      const res = await fetch('/api/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error saving API keys');
      setMessage('API keys updated successfully');
    } catch (err) {
      setMessage('Error saving API keys');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Settings</h1>

        {/* Profile Section */}
        <form onSubmit={updateProfile} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Profile</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              className="w-full p-2 border rounded text-gray-700"
              disabled
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Update Profile
          </button>
        </form>

        {/* Password Change */}
        <form onSubmit={changePassword} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Change Password</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2 border rounded text-gray-700"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 border rounded text-gray-700"
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Change Password
          </button>
        </form>

        {/* API Keys */}
        <form onSubmit={saveApiKeys} className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">API Keys</h2>
          {['openai', 'anthropic', 'cohere'].map((provider) => (
            <div key={provider} className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1 capitalize">
                {provider} API Key
              </label>
              <input
                type="password"
                value={apiKeys[provider] || ''}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, [provider]: e.target.value })
                }
                className="w-full p-2 border rounded text-gray-700"
              />
            </div>
          ))}
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Save API Keys
          </button>
        </form>

        {message && (
          <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded text-gray-700">
            {message}
          </div>
        )}
      </main>
    </div>
  );
}
