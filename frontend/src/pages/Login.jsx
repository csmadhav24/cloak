import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate input
    if (!username || !password) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      console.log('Attempting login with:', username);
      
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password 
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        alert('Login successful!');
        navigate('/dashboard');
      } else {
        // Handle specific error messages
        if (response.status === 401) {
          setError('Invalid username or password');
        } else if (response.status === 403) {
          setError('Account is locked. Contact administrator.');
        } else if (response.status === 400) {
          setError(data.detail || 'Bad request. Please check your input.');
        } else {
          setError(data.detail || `Login failed with status ${response.status}`);
        }
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Cannot connect to server. Make sure backend is running on port 8000');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="login-page">

    {/* floating particles */}

    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="particle"
        style={{
          width: `${Math.random() * 6 + 2}px`,
          height: `${Math.random() * 6 + 2}px`,
          left: `${Math.random() * 100}%`,
          animationDuration: `${10 + Math.random() * 20}s`,
          animationDelay: `${Math.random() * 10}s`,
        }}
      />
    ))}

    <div className="left-panel">
      <div className="cloak-container">
        <h1 className="cloak-title">
          <span>C</span>
          <span>L</span>
          <span>O</span>
          <span>A</span>
          <span>K</span></h1>
        <p className="cloak-subtitle">
          Secure File Transfer
        </p>
      </div>
    </div>

    <div className="right-panel">
      <div className="login-box">

        <h2 className="login-heading">
          Sign In
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="Username"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Password"
              className="form-input"
              required
            />
          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading
              ? "Signing In..."
              : "Login"}
          </button>

          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
  Don't have an account? <a href="/register" style={{ color: '#667eea' }}>Register</a>
</p>
        </form>
      </div>
    </div>
  </div>
);
}

export default Login;