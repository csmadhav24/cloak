import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const navigate = useNavigate();

  // Simple email validation
  const validateEmailFormat = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check for disposable emails (optional - remove if you don't want this)
  const isDisposableEmail = (email) => {
    const disposableDomains = [
      'tempmail.com', 'mailinator.com', '10minutemail.com', 
      'yopmail.com', 'guerrillamail.com'
    ];
    const domain = email.split('@')[1];
    return disposableDomains.includes(domain);
  };

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (username.length < 3) return;
    
    try {
      const response = await fetch(`https://cloak-api-igkh.onrender.com/api/auth/check-username/${username}`);
      const data = await response.json();
      setUsernameAvailable(data.available);
      if (!data.available) {
        setErrors(prev => ({ ...prev, username: 'Username already taken' }));
      } else {
        setErrors(prev => ({ ...prev, username: '' }));
      }
    } catch (error) {
      console.error('Username check failed:', error);
    }
  };

  // Check email availability
  const checkEmailAvailability = async (email) => {
    if (!validateEmailFormat(email)) return;
    
    try {
      const response = await fetch(`https://cloak-api-igkh.onrender.com/api/auth/check-email/${encodeURIComponent(email)}`);
      const data = await response.json();
      setEmailAvailable(data.available);
      if (!data.available) {
        setErrors(prev => ({ ...prev, email: 'Email already registered' }));
      } else {
        setErrors(prev => ({ ...prev, email: '' }));
      }
    } catch (error) {
      console.error('Email check failed:', error);
    }
  };

  const generateRSAKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
    const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyMatch(publicKeyBase64, 64)}\n-----END PUBLIC KEY-----`;
    
    const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
    
    localStorage.setItem('user_private_key', privateKeyBase64);
    
    return publicKeyPEM;
  };

  const publicKeyMatch = (str, length) => {
    const regex = new RegExp(`(.{${length}})`, 'g');
    return str.match(regex)?.join('\n') || str;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    setErrors(prev => ({ ...prev, [name]: '' }));
    
    if (name === 'username' && value.length >= 3) {
      checkUsernameAvailability(value);
    }
    if (name === 'email' && validateEmailFormat(value)) {
      checkEmailAvailability(value);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 50) {
      newErrors.username = 'Username must be less than 50 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmailFormat(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (isDisposableEmail(formData.email)) {
      newErrors.email = 'Temporary email addresses are not allowed';
    }
    
    // Password validation - SIMPLIFIED: just minimum 8 characters
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setSuccess('');
    setErrors({});

    try {
      console.log('Generating RSA key pair...');
      const publicKey = await generateRSAKeyPair();

      const response = await fetch('https://cloak-api-igkh.onrender.com/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          public_key: publicKey
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else if (response.status === 409) {
        if (data.detail && data.detail.includes('username')) {
          setErrors({ username: 'Username already taken' });
        } else if (data.detail && data.detail.includes('email')) {
          setErrors({ email: 'Email already registered' });
        } else {
          setErrors({ general: data.detail || 'Registration failed' });
        }
      } else {
        setErrors({ general: data.detail || 'Registration failed' });
      }
    } catch (err) {
      setErrors({ general: 'Cannot connect to server. Make sure backend is running.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '500px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>
          Create Account
        </h1>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666', fontSize: '14px' }}>
          Join Secure File Transfer System
        </p>

        {success && (
          <div style={{
            background: '#d4edda',
            color: '#155724',
            padding: '12px',
            borderRadius: '5px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        {errors.general && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '5px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a username"
              style={{
                width: '100%',
                padding: '12px',
                border: errors.username ? '2px solid #dc3545' : '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
            {usernameAvailable === true && formData.username && (
              <small style={{ color: '#28a745' }}>✓ Username available</small>
            )}
            {usernameAvailable === false && (
              <small style={{ color: '#dc3545' }}>✗ Username already taken</small>
            )}
            {errors.username && <small style={{ color: '#dc3545', display: 'block' }}>{errors.username}</small>}
            <small style={{ color: '#666', fontSize: '12px', display: 'block' }}>3-50 characters (letters, numbers, underscores)</small>
          </div>

          {/* Email Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px',
                border: errors.email ? '2px solid #dc3545' : '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
            {emailAvailable === true && formData.email && (
              <small style={{ color: '#28a745' }}>✓ Email available</small>
            )}
            {emailAvailable === false && (
              <small style={{ color: '#dc3545' }}>✗ Email already registered</small>
            )}
            {errors.email && <small style={{ color: '#dc3545', display: 'block' }}>{errors.email}</small>}
            <small style={{ color: '#666', fontSize: '12px', display: 'block' }}>Enter a valid email address</small>
          </div>

          {/* Password Field - SIMPLIFIED */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              style={{
                width: '100%',
                padding: '12px',
                border: errors.password ? '2px solid #dc3545' : '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
            {errors.password && <small style={{ color: '#dc3545', display: 'block' }}>{errors.password}</small>}
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
              Password must be at least 8 characters
            </small>
          </div>

          {/* Confirm Password Field */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
              Confirm Password *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              style={{
                width: '100%',
                padding: '12px',
                border: errors.confirmPassword ? '2px solid #dc3545' : '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
            {errors.confirmPassword && <small style={{ color: '#dc3545', display: 'block' }}>{errors.confirmPassword}</small>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
          Already have an account? <Link to="/login" style={{ color: '#667eea' }}>Login</Link>
        </p>
        
        <div style={{ marginTop: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '5px', fontSize: '12px', color: '#666' }}>
          <p style={{ margin: 0, textAlign: 'center' }}>
            🔒 Your RSA key pair is generated locally in your browser
          </p>
          <p style={{ margin: '5px 0 0', textAlign: 'center', fontSize: '11px' }}>
            Your private key never leaves your device
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
