import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';

function Admin() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const [usersRes, statsRes, auditRes] = await Promise.all([
        fetch('https://cloak-api-igkh.onrender.com/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('https://cloak-api-igkh.onrender.com/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('https://cloak-api-igkh.onrender.com/api/audit/logs?page=1&page_size=20', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }
    } catch (err) {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`https://cloak-api-igkh.onrender.com/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      fetchData();
    } catch (error) {
      alert('Failed to update role');
    }
  };

  const toggleUserLock = async (userId, currentStatus) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`https://cloak-api-igkh.onrender.com/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_locked: !currentStatus })
      });
      fetchData();
    } catch (error) {
      alert('Failed to update user');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'admin': return '#667eea';
      case 'auditor': return '#f59e0b';
      default: return '#10b981';
    }
  };

  if (loading) {
    return (
      <Layout title="Admin Dashboard">
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading admin dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Admin Dashboard">
        <div style={styles.errorContainer}>
          <p>Error: {error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      {/* Stats Cards - CLOAK Theme */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>👥</div>
          <div>
            <h3 style={styles.statNumber}>{stats?.total_users || 0}</h3>
            <p style={styles.statLabel}>Total Users</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📄</div>
          <div>
            <h3 style={styles.statNumber}>{stats?.total_files || 0}</h3>
            <p style={styles.statLabel}>Total Files</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💾</div>
          <div>
            <h3 style={styles.statNumber}>{formatBytes(stats?.total_storage_bytes)}</h3>
            <p style={styles.statLabel}>Storage Used</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🔄</div>
          <div>
            <h3 style={styles.statNumber}>{stats?.active_sessions || 0}</h3>
            <p style={styles.statLabel}>Active Sessions</p>
          </div>
        </div>
      </div>

      {/* Tabs - CLOAK Style */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            ...styles.tabButton,
            ...(activeTab === 'users' ? styles.tabActive : {})
          }}
        >
          👥 User Management
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            ...styles.tabButton,
            ...(activeTab === 'audit' ? styles.tabActive : {})
          }}
        >
          📋 Audit Logs
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>System Users</h3>
            <p style={styles.tableSubtitle}>Manage user roles and account status</p>
          </div>
          
          {users.length === 0 ? (
            <p style={styles.emptyState}>No users found</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Role</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <div style={styles.avatar}>{user.username[0].toUpperCase()}</div>
                          <strong>{user.username}</strong>
                        </div>
                       </td>
                      <td style={styles.td}>{user.email}</td>
                      <td style={styles.td}>
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          style={{
                            ...styles.select,
                            borderColor: getRoleBadgeColor(user.role)
                          }}
                        >
                          <option value="user">👤 User</option>
                          <option value="admin">👑 Admin</option>
                          <option value="auditor">👁️ Auditor</option>
                        </select>
                       </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          background: user.account_locked ? '#fff5f5' : '#e8f5e9',
                          color: user.account_locked ? '#dc3545' : '#28a745'
                        }}>
                          {user.account_locked ? '🔒 Locked' : '🟢 Active'}
                        </span>
                       </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => toggleUserLock(user.id, user.account_locked)}
                          style={{
                            ...styles.actionButton,
                            background: user.account_locked ? '#28a745' : '#dc3545'
                          }}
                        >
                          {user.account_locked ? 'Unlock' : 'Lock'}
                        </button>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>System Audit Logs</h3>
            <p style={styles.tableSubtitle}>Track all system activities and security events</p>
          </div>
          
          {auditLogs.length === 0 ? (
            <p style={styles.emptyState}>No audit logs found</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Event</th>
                    <th style={styles.th}>Severity</th>
                    <th style={styles.th}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={styles.tr}>
                      <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <div style={styles.smallAvatar}>{log.username?.[0] || 'S'}</div>
                          {log.username || 'System'}
                        </div>
                       </td>
                      <td style={styles.td}>
                        <span style={styles.eventType}>{log.event_type}</span>
                       </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.severityBadge,
                          background: log.event_severity === 'WARNING' ? '#fff3e0' : '#e8f5e9',
                          color: log.event_severity === 'WARNING' ? '#f59e0b' : '#28a745'
                        }}>
                          {log.event_severity}
                        </span>
                       </td>
                      <td style={styles.td}>
                        <code style={styles.ipCode}>{log.ip_address || 'localhost'}</code>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    padding: '20px',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    transition: 'transform 0.3s, box-shadow 0.3s'
  },
  statIcon: {
    fontSize: '40px'
  },
  statNumber: {
    fontSize: '28px',
    margin: 0,
    fontWeight: 'bold'
  },
  statLabel: {
    margin: '5px 0 0',
    fontSize: '13px',
    opacity: 0.9
  },
  tabsContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '25px',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0'
  },
  tabButton: {
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s',
    color: '#64748b'
  },
  tabActive: {
    background: '#667eea',
    color: 'white'
  },
  tableContainer: {
    background: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  tableHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc'
  },
  tableTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#1e293b'
  },
  tableSubtitle: {
    margin: '5px 0 0',
    fontSize: '13px',
    color: '#64748b'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '16px 20px',
    background: '#f1f5f9',
    fontWeight: '600',
    color: '#334155',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e2e8f0'
  },
  td: {
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    color: '#475569',
    fontSize: '14px'
  },
  tr: {
    transition: 'background 0.2s',
    cursor: 'pointer'
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  smallAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: '#764ba2',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid',
    background: 'white',
    cursor: 'pointer',
    fontSize: '13px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    display: 'inline-block'
  },
  severityBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '500',
    display: 'inline-block'
  },
  eventType: {
    fontFamily: 'monospace',
    fontSize: '12px',
    background: '#f1f5f9',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  actionButton: {
    padding: '6px 16px',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b'
  },
  spinner: {
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px',
    color: '#dc2626',
    background: '#fef2f2',
    borderRadius: '12px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px',
    color: '#94a3b8'
  },
  ipCode: {
    background: '#f1f5f9',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace'
  }
};

// Add animation for spinner and hover effects
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
  }
  button:hover {
    transform: translateY(-1px);
  }
  tr:hover {
    background: #f8fafc;
  }
  select:hover {
    border-color: #667eea;
  }
`;
document.head.appendChild(styleSheet);

export default Admin;
