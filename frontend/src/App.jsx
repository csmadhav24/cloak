import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Downloads from './pages/Downloads';
import Admin from './pages/Admin';
import Register from './pages/Register';

function App() {
  const isAuthenticated = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route 
          path="/upload" 
          element={isAuthenticated ? <Upload /> : <Navigate to="/login" />}
        />
        <Route 
          path="/downloads" 
          element={isAuthenticated ? <Downloads /> : <Navigate to="/login" />}
        />
        <Route 
          path="/admin" 
          element={isAuthenticated && user.role === 'admin' ? <Admin /> : <Navigate to="/dashboard" />}
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;