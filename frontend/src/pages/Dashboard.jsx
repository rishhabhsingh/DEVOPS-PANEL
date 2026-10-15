import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState({});
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const init = async () => {
      try {
        const { data: userData } = await api.get('/auth/me');
        setUser(userData);

        // Fetch their GitHub repos
        const { data: repoData } = await api.get('/repos');
        setRepos(repoData.repos);
      } catch (err) {
        // Not logged in — send to login page
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleDeploy = async (repo) => {
    setDeploying(prev => ({ ...prev, [repo.id]: true }));

    try {
      const { data } = await api.post('/deploy', {
        repoFullName: repo.fullName,
        repoName: repo.name,
        branch: repo.defaultBranch
      });

      // Navigate to deployment page to watch logs
      navigate(`/deployment/${data.deploymentId}?projectId=${data.projectId}`);

    } catch (err) {
      console.error('Deploy failed:', err);
      alert('Deploy failed: ' + (err.response?.data?.error || err.message));
      setDeploying(prev => ({ ...prev, [repo.id]: false }));
    }
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/');
  };

  // Filter repos by search
  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">

      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="text-white font-bold text-xl">🚀 DevOps Panel</div>
        <div className="flex items-center gap-4">
          <img
            src={user?.avatarUrl}
            alt={user?.username}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-gray-300 text-sm">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">
            Select a repository to deploy
          </h1>
          <p className="text-gray-400">
            {repos.length} repositories found
          </p>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl
                     px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                     focus:border-gray-600 transition-colors"
        />

        {/* Repo list */}
        <div className="space-y-3">
          {filteredRepos.map(repo => (
            <div
              key={repo.id}
              className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5
                         flex items-center justify-between hover:border-gray-600
                         transition-all duration-200"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{repo.name}</span>
                  {repo.isPrivate && (
                    <span className="text-xs bg-gray-800 text-gray-400
                                     px-2 py-0.5 rounded-full">
                      Private
                    </span>
                  )}
                  {repo.language && (
                    <span className="text-xs bg-blue-900/40 text-blue-400
                                     px-2 py-0.5 rounded-full">
                      {repo.language}
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-gray-500 text-sm">{repo.description}</p>
                )}
                <p className="text-gray-600 text-xs">
                  Branch: {repo.defaultBranch}
                </p>
              </div>

              <div className="flex items-center gap-2">
  <button
    onClick={() => handleDeploy(repo)}
    disabled={deploying[repo.id]}
    className="bg-white text-black font-semibold px-5 py-2
               rounded-lg hover:bg-gray-100 transition-all
               disabled:opacity-50 disabled:cursor-not-allowed
               text-sm whitespace-nowrap"
  >
    {deploying[repo.id] ? 'Queuing...' : 'Deploy →'}
  </button>
</div>
              
              
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;