import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deployment from './pages/Deployment';
import ProjectSettings from './pages/ProjectSettings';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deployment/:deploymentId" element={<Deployment />} />
        <Route path="/project/:projectId/settings" element={<ProjectSettings />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;