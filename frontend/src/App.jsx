import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deployment from './pages/Deployment';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deployment/:deploymentId" element={<Deployment />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;