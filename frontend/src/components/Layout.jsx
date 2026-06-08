import '../styles/layout.css';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Layout = ({ children, title }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const user = JSON.parse(
    localStorage.getItem('user') || '{}'
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    {
      icon: '📁',
      text: 'My Files',
      path: '/dashboard'
    },
    {
      icon: '📤',
      text: 'Upload',
      path: '/upload'
    },
    {
      icon: '📥',
      text: 'Downloads',
      path: '/downloads'
    }
  ];

  if (user.role === 'admin') {
    menuItems.push({
      icon: '👑',
      text: 'Admin Panel',
      path: '/admin'
    });
  }

  return (
    <div className="layout-container">

      {/* Sidebar */}

      <aside
        className="sidebar"
        style={{
          width: sidebarOpen ? '280px' : '80px'
        }}
      >
        <div className="sidebar-logo">
          {sidebarOpen ? (
            <h2>🔒 CLOAK</h2>
          ) : (
            <h2>🔒</h2>
          )}
        </div>

        <button
          className="sidebar-toggle"
          onClick={() =>
            setSidebarOpen(!sidebarOpen)
          }
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        <nav className="nav-menu">

          {menuItems.map((item, index) => (
            <div
              key={index}
              className="nav-item"
              onClick={() =>
                navigate(item.path)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              {sidebarOpen && (
                <span>{item.text}</span>
              )}
            </div>
          ))}

          <div
            className="logout-item"
            onClick={handleLogout}
          >
            <span className="nav-icon">
              🚪
            </span>

            {sidebarOpen && (
              <span>Logout</span>
            )}
          </div>

        </nav>
      </aside>

      {/* Main Content */}

      <div
        className="main-content"
        style={{
          marginLeft: sidebarOpen
            ? '280px'
            : '80px'
        }}
      >

        {/* Header */}

        <header className="layout-header">

          <h1>{title}</h1>

          <div className="user-info">

            <span>
              👤 {user.username || 'User'}
            </span>

            {user.role === 'admin' && (
              <span className="admin-badge">
                Admin
              </span>
            )}

          </div>

        </header>

        {/* Page Content */}

        <main className="page-content">
          {children}
        </main>

      </div>

    </div>
  );
};

export default Layout;