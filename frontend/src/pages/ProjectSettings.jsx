import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';

const ProjectSettings = () => {
  const { projectId } = useParams();
  const [envVars, setEnvVars] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchEnvVars();
  }, []);

  const fetchEnvVars = async () => {
    try {
      const { data } = await api.get(`/envvars/${projectId}`);
      setEnvVars(data.envVars);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    try {
      await api.post(`/envvars/${projectId}`, {
        key: newKey.trim().toUpperCase(),
        value: newValue.trim()
      });
      setNewKey('');
      setNewValue('');
      setMessage('Saved successfully');
      fetchEnvVars();
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key) => {
    if (!confirm(`Delete ${key}?`)) return;
    try {
      await api.delete(`/envvars/${projectId}/${key}`);
      setMessage('Deleted');
      fetchEnvVars();
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard"
          className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to dashboard
        </Link>
        <div className="text-white font-bold">🚀 DevOps Panel</div>
        <div/>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Environment Variables</h1>
          <p className="text-gray-400 text-sm mt-1">
            Stored encrypted. Injected into your container at runtime.
          </p>
        </div>

        {/* Add new env var */}
        <div className="bg-[#161616] border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Add Variable</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="KEY"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded-lg
                         px-4 py-2 text-white font-mono text-sm
                         placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <input
              type="password"
              placeholder="value"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded-lg
                         px-4 py-2 text-white font-mono text-sm
                         placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-white text-black font-semibold px-5 py-2
                         rounded-lg hover:bg-gray-100 transition-all
                         disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {saving ? 'Saving...' : '+ Add'}
            </button>
          </div>
          {message && (
            <p className={`text-sm ${
              message.includes('Failed') ? 'text-red-400' : 'text-green-400'
            }`}>
              {message}
            </p>
          )}
        </div>

        {/* Existing env vars */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold">
            Saved Variables ({envVars.length})
          </h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : envVars.length === 0 ? (
            <div className="bg-[#161616] border border-gray-800 rounded-2xl
                            p-8 text-center text-gray-500 text-sm">
              No environment variables yet. Add one above.
            </div>
          ) : (
            envVars.map((ev) => (
              <div key={ev.key}
                className="bg-[#161616] border border-gray-800 rounded-xl
                           p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-white font-mono text-sm font-semibold">
                    {ev.key}
                  </span>
                  <span className="text-gray-600 font-mono text-sm">
                    {ev.value}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(ev.key)}
                  className="text-red-500 hover:text-red-400 text-sm
                             transition-colors px-3 py-1 rounded-lg
                             hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;