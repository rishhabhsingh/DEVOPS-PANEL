import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../lib/api';

// Log line colors based on content
const getLogColor = (message) => {
  if (!message) return 'text-gray-300';
  const m = message.toLowerCase();
  if (m.includes('error') || m.includes('failed') || m.includes('err '))
    return 'text-red-400';
  if (m.includes('warning') || m.includes('warn'))
    return 'text-yellow-400';
  if (m.includes('success') || m.includes('complete') || m.includes('done'))
    return 'text-green-400';
  if (m.includes('step') || m.includes('building') || m.includes('cloning'))
    return 'text-blue-400';
  return 'text-gray-300';
};

const Deployment = () => {
  const { deploymentId } = useParams();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [history, setHistory] = useState([]);
  const logEndRef = useRef(null);
  const socketRef = useRef(null);

  // Auto scroll to bottom as logs come in
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // Connect to Socket.io
    const socket = io('http://localhost:4000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      // Join the room for this specific deployment
      // Only logs for THIS deployment come through
      socket.emit('watch:deployment', deploymentId);
      setLogs(prev => [...prev, {
        message: 'Connected to deployment stream...',
        type: 'system',
        timestamp: new Date().toISOString()
      }]);
    });

    // Each log line arrives as a 'log' event
    socket.on('log', (data) => {
      setLogs(prev => [...prev, data]);

      if (data.type === 'done') {
        setStatus('success');
        fetchHistory();
      }

      if (data.type === 'error') {
        setStatus('error');
        fetchHistory();
      }
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    // Fetch deployment history for rollback UI
    fetchHistory();

    return () => {
      socket.disconnect();
    };
  }, [deploymentId]);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get(`/deploy/${projectId}/history`);
      setHistory(data.deployments);
    } catch (err) {
      console.error('History fetch failed:', err.message);
    }
  };

  const handleRollback = async (targetDeploymentId) => {
    if (!confirm('Roll back to this version?')) return;

    try {
      await api.post('/deploy/rollback', {
        deploymentId: targetDeploymentId
      });
      alert('Rollback queued successfully');
    } catch (err) {
      alert('Rollback failed: ' + err.message);
    }
  };

  const statusColors = {
    connecting: 'text-yellow-400',
    connected: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    disconnected: 'text-gray-400'
  };

  const statusLabels = {
    connecting: '⏳ Connecting...',
    connected: '🔄 Building...',
    success: '✅ Deployed',
    error: '❌ Failed',
    disconnected: '🔌 Disconnected'
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">

      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-4
                      flex items-center justify-between">
        <Link to="/dashboard"
          className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to dashboard
        </Link>
        <div className="text-white font-bold">🚀 DevOps Panel</div>
        <span className={`text-sm font-medium ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Deployment ID */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white">Deployment Logs</h1>
          <p className="text-gray-500 text-sm font-mono">{deploymentId}</p>
        </div>

        {/* Terminal */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">

          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-3
                          border-b border-gray-800 bg-[#111]">
            <div className="w-3 h-3 rounded-full bg-red-500"/>
            <div className="w-3 h-3 rounded-full bg-yellow-500"/>
            <div className="w-3 h-3 rounded-full bg-green-500"/>
            <span className="text-gray-500 text-xs ml-2 font-mono">
              build output
            </span>
          </div>

          {/* Log lines */}
          <div className="p-4 h-96 overflow-y-auto font-mono text-sm space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 leading-relaxed">
                <span className="text-gray-600 text-xs w-20 shrink-0 pt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={getLogColor(log.message)}>
                  {log.message}
                </span>
              </div>
            ))}

            {/* Blinking cursor while building */}
            {status === 'connected' && (
              <div className="flex gap-3">
                <span className="text-gray-600 text-xs w-20"/>
                <span className="text-gray-400 animate-pulse">█</span>
              </div>
            )}

            <div ref={logEndRef}/>
          </div>
        </div>

        {/* Deployment History + Rollback */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-white font-semibold">Deployment History</h2>
            <div className="space-y-2">
              {history.map((dep) => (
                <div
                  key={dep._id}
                  className="bg-[#1a1a1a] border border-gray-800 rounded-xl
                             p-4 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium text-sm">
                        Version {dep.version}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        dep.status === 'running'
                          ? 'bg-green-900/40 text-green-400'
                          : dep.status === 'failed'
                          ? 'bg-red-900/40 text-red-400'
                          : dep.status === 'rolled_back'
                          ? 'bg-gray-800 text-gray-400'
                          : 'bg-blue-900/40 text-blue-400'
                      }`}>
                        {dep.status}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">
                      {new Date(dep.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Only show rollback for non-current versions */}
                  {dep._id !== deploymentId && dep.imageTag && (
                    <button
                      onClick={() => handleRollback(dep._id)}
                      className="text-sm bg-gray-800 hover:bg-gray-700
                                 text-gray-300 px-4 py-2 rounded-lg
                                 transition-colors"
                    >
                      ↩ Rollback
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Deployment;