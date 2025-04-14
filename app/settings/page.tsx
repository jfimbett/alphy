'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  defaultSummarizationTemplate,
  defaultExtractionTemplate,
  defaultConsolidationTemplate,
  defaultVariableExtraction
} from '@/lib/prompts';

export default function SettingsPage() {
  /*****************************************************************
   * 1) USER & MISCELLANEOUS STATES
   *****************************************************************/
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Success/error messaging
  const [message, setMessage] = useState('');

  // LLM prompt templates
  const [summarizationTemplate, setSummarizationTemplate] = useState(defaultSummarizationTemplate);
  const [extractionTemplate, setExtractionTemplate] = useState(defaultExtractionTemplate);
  const [consolidationTemplate, setConsolidationTemplate] = useState(defaultConsolidationTemplate);
  const [variableExtraction, setVariableExtraction] = useState(defaultVariableExtraction);

  /*****************************************************************
   * 2) APP-GENERATED API KEYS (ACCESS KEYS)
   *    These are the keys WE generate for the user to access data
   *****************************************************************/
  const [appGeneratedKeys, setAppGeneratedKeys] = useState<{ key: string; created_at: string }[]>([]);

  // Fetch existing app-generated keys
  useEffect(() => {
    const fetchAppKeys = async () => {
      try {
        const res = await fetch('/api/api-keys', {
          headers: {
            'x-user-id': user?.id || ''
          }
        });
        const data = await res.json();
        if (data.keys) {
          setAppGeneratedKeys(data.keys);
        }
      } catch (err) {
        console.error('Error fetching app-generated keys:', err);
      }
    };
    fetchAppKeys();
  }, []);

  // Generate a new app-generated key
  const generateAppKey = async () => {
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 
          'x-user-id': user?.id || ''
        }
      });
      const data = await res.json();
      if (data.key) {
        setAppGeneratedKeys((prev) => [...prev, { key: data.key, created_at: new Date().toISOString() }]);
        setMessage('New application access key generated.');
      }
    } catch (err) {
      setMessage('Error generating new access key');
    }
  };

  // Delete an app-generated key
  const deleteAppKey = async (key: string) => {
    try {
      const res = await fetch(`/api/api-keys/${key}`, { method: 'DELETE' });
      if (res.ok) {
        setAppGeneratedKeys((prev) => prev.filter((k) => k.key !== key));
        setMessage('Key deleted.');
      } else {
        setMessage('Error deleting key');
      }
    } catch (err) {
      setMessage('Error deleting key');
    }
  };

  /*****************************************************************
   * 3) LLM PROVIDER API KEYS
   *    e.g. OpenAI, Anthropic, Cohere
   *****************************************************************/
  const [llmProviderKeys, setLlmProviderKeys] = useState<Record<string, string>>({});

  // Save LLM provider keys to our backend
  const saveLlmProviderKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setMessage('No user ID found. Are you logged in?');
      return;
    }

    try {
      // We structure them for your DB as needed:
      const updates = Object.entries(llmProviderKeys).map(([provider, key]) => ({
        user_id: user.id,
        provider,
        decrypted_key: key,
        updated_at: new Date().toISOString()
      }));

      const res = await fetch('/api/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error saving LLM provider keys');
      setMessage('LLM provider keys updated successfully');
    } catch (err) {
      setMessage('Error saving LLM provider keys');
      console.error(err);
    }
  };

  /*****************************************************************
   * 4) PROFILE/USER SETUP & TEMPLATES
   *****************************************************************/
  useEffect(() => {
    const fetchUser = async () => {
      const userId = localStorage.getItem('userId');
      const email = localStorage.getItem('userEmail');
      if (!userId || !email) {
        router.push('/login');
        return;
      }
      setUser({ id: userId, email });

      // Load saved templates from local storage
      const savedSummarization = localStorage.getItem('summarizationTemplate');
      const savedExtraction = localStorage.getItem('extractionTemplate');
      const savedConsolidation = localStorage.getItem('consolidationTemplate');
      const savedVarExtraction = localStorage.getItem('variableExtraction');
      if (savedSummarization) setSummarizationTemplate(savedSummarization);
      if (savedExtraction) setExtractionTemplate(savedExtraction);
      if (savedConsolidation) setConsolidationTemplate(savedConsolidation);
      if (savedVarExtraction) setVariableExtraction(savedVarExtraction);

      // Also fetch LLM keys from your endpoint if needed
      try {
        const res = await fetch(`/api/api-keys?userId=${userId}`);
        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          console.error('Error parsing LLM keys JSON: ', error);
        }
        if ((data as any).apiKeys) {
          setLlmProviderKeys(
            Object.fromEntries(
              (data as any).apiKeys.map(
                (k: { provider: string; decrypted_key: string }) => [k.provider, k.decrypted_key]
              )
            )
          );
        }
      } catch (err) {
        console.error('Error fetching LLM provider keys:', err);
      }
    };
    fetchUser();
  }, [router]);

  // Profile update
  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          company: user.company // or any additional fields
        })
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Error updating profile');
      }
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage('Error updating profile');
      console.error(err);
    }
  };

  // Change password
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error changing password');
      setMessage('Password changed successfully');
    } catch (err) {
      setMessage('Error changing password');
      console.error(err);
    }
  };

  // Save custom prompt templates
  const saveTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('summarizationTemplate', summarizationTemplate);
      localStorage.setItem('extractionTemplate', extractionTemplate);
      localStorage.setItem('consolidationTemplate', consolidationTemplate);
      localStorage.setItem('variableExtraction', variableExtraction);
      setMessage('Templates saved successfully');
    } catch (err) {
      setMessage('Error saving templates');
      console.error(err);
    }
  };

  /*****************************************************************
   * 5) RENDERING THE SETTINGS PAGE
   *****************************************************************/
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Settings</h1>

        {/* ------------------------- Profile Section ------------------------- */}
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

        {/* -------------------- Our Application Access Keys ------------------- */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Your Application Access Keys
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            These are the **keys generated by this app** so you can programmatically access 
            and retrieve your data at a later time. They are **not** the same as your LLM 
            provider keys.
          </p>

          {/* Listing existing keys */}
          <div className="mb-4">
            {appGeneratedKeys.map((keyObj) => (
              <div
                key={keyObj.key}
                className="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded"
              >
                <code className="text-sm break-all">{keyObj.key}</code>
                <span className="text-sm text-gray-500">
                  {new Date(keyObj.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => deleteAppKey(keyObj.key)}
                  className="bg-red-600 text-white px-3 py-1 rounded ml-4 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          {/* Generate new key */}
          <button
            onClick={generateAppKey}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Generate New Access Key
          </button>
        </div>

        {/* ------------------------ Change Password ------------------------ */}
        <form onSubmit={changePassword} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Change Password</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2 border rounded text-gray-700"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              New Password
            </label>
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

        {/* -------------------- LLM Provider API Keys -------------------- */}
        <form onSubmit={saveLlmProviderKeys} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">LLM Provider API Keys</h2>
          <p className="text-sm text-gray-600 mb-4">
            These keys are **your personal** credentials for OpenAI, Anthropic, Cohere, etc. 
            We store them securely (encrypted) so you can use them in your private analyses.
          </p>
          {['openai', 'anthropic', 'cohere'].map((provider) => (
            <div key={provider} className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1 capitalize">
                {provider} Key
              </label>
              <input
                type="password"
                value={llmProviderKeys[provider] || ''}
                onChange={(e) =>
                  setLlmProviderKeys({ ...llmProviderKeys, [provider]: e.target.value })
                }
                className="w-full p-2 border rounded text-gray-700"
                placeholder={`Enter your ${provider} API key`}
              />
            </div>
          ))}
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Save LLM Provider Keys
          </button>
        </form>

        {/* -------------------- LLM Prompt Templates -------------------- */}
        <form onSubmit={saveTemplates} className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">LLM Prompt Templates</h2>
          <p className="mb-2 text-gray-600">
            Customize the prompt templates used at each step of your private equity document analysis.
          </p>

          {/* Summarization Template */}
          <label className="block text-sm font-medium text-gray-600 mt-4">
            Summarization Template
          </label>
          <textarea
            className="w-full p-2 border rounded text-gray-700"
            rows={6}
            value={summarizationTemplate}
            onChange={(e) => setSummarizationTemplate(e.target.value)}
          />

          {/* Extraction Template */}
          <label className="block text-sm font-medium text-gray-600 mt-4">
            Extraction Template
          </label>
          <textarea
            className="w-full p-2 border rounded text-gray-700"
            rows={8}
            value={extractionTemplate}
            onChange={(e) => setExtractionTemplate(e.target.value)}
          />

          {/* Consolidation Template */}
          <label className="block text-sm font-medium text-gray-600 mt-4">
            Consolidation Template
          </label>
          <textarea
            className="w-full p-2 border rounded text-gray-700"
            rows={10}
            value={consolidationTemplate}
            onChange={(e) => setConsolidationTemplate(e.target.value)}
          />

          {/* Variable Extraction Template */}
          <label className="block text-sm font-medium text-gray-600 mt-4">
            Variable Extraction Template
          </label>
          <textarea
            className="w-full p-2 border rounded text-gray-700"
            rows={6}
            value={variableExtraction}
            onChange={(e) => setVariableExtraction(e.target.value)}
          />

          <button type="submit" className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
            Save Templates
          </button>
        </form>

        {/* -------------------- Final messages -------------------- */}
        {message && (
          <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded text-gray-700">
            {message}
          </div>
        )}
      </main>
    </div>
  );
}
