import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';

function Dashboard() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sharedFiles, setSharedFiles] = useState([]);

  useEffect(() => {
    fetchFiles();
    fetchSharedFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://cloak-api-igkh.onrender.com/api/files/files', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://cloak-api-igkh.onrender.com/api/files/shared-with-me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSharedFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching shared files:', error);
    }
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://cloak-api-igkh.onrender.com/api/files/download/${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      alert(`✅ "${filename}" downloaded successfully!`);
    } catch (error) {
      alert('Download failed: ' + error.message);
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('⚠️ Are you sure you want to delete this file? This action cannot be undone.')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`https://cloak-api-igkh.onrender.com/api/files/delete/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchFiles();
      alert('✅ File deleted successfully');
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const handleShare = async (fileId, filename) => {
  const recipient = prompt(`🔗 Share "${filename}" with user:\n\nEnter recipient's username:`, '');
  if (!recipient) return;
  
  try {
    const token = localStorage.getItem('token');
    console.log('Sharing file:', fileId, 'with:', recipient);
    
    const response = await fetch('https://cloak-api-igkh.onrender.com/api/files/share', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file_id: fileId,
        recipient_username: recipient,
        permission: 'read'
      })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      alert(`✅ File shared with ${recipient}! They can now download it.`);
      // Refresh shared files list
      fetchSharedFiles();
    } else {
      alert(`❌ Failed to share: ${data.detail || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Share error:', error);
    alert('Share failed: ' + error.message + '\n\nMake sure the recipient user exists.');
  }
};

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (filename) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '🖼️';
    if (filename.match(/\.(pdf)$/i)) return '📄';
    if (filename.match(/\.(zip|rar|7z|tar|gz)$/i)) return '🗜️';
    if (filename.match(/\.(mp4|mkv|avi|mov)$/i)) return '🎬';
    if (filename.match(/\.(mp3|wav|flac|m4a)$/i)) return '🎵';
    if (filename.match(/\.(doc|docx)$/i)) return '📝';
    if (filename.match(/\.(xls|xlsx)$/i)) return '📊';
    if (filename.match(/\.(txt)$/i)) return '📃';
    return '📎';
  };

  const filteredFiles = files.filter(file =>
    file.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSize = files.reduce((sum, file) => sum + (file.file_size || 0), 0);

  if (loading) {
    return (
      <Layout title="My Files">
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading your secure files...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Files">
      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📁</div>
          <div>
            <h3 style={styles.statNumber}>{files.length}</h3>
            <p style={styles.statLabel}>Total Files</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💾</div>
          <div>
            <h3 style={styles.statNumber}>{formatFileSize(totalSize)}</h3>
            <p style={styles.statLabel}>Storage Used</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🔒</div>
          <div>
            <h3 style={styles.statNumber}>AES-256</h3>
            <p style={styles.statLabel}>Encryption</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={styles.searchContainer}>
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search files by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={styles.clearButton}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Files Section */}
      {filteredFiles.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔒</div>
          <h2>No Files Found</h2>
          <p>Upload your first encrypted file to get started</p>
          <button 
            onClick={() => window.location.href = '/upload'}
            style={styles.uploadButton}
          >
            📤 Upload File
          </button>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>My Secure Files</h3>
            <p style={styles.tableSubtitle}>
              Files are encrypted with AES-256-GCM and stored securely
            </p>
          </div>
          
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>File Name</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Uploaded</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.fileNameCell}>
                        <span style={styles.fileIcon}>{getFileIcon(file.original_filename)}</span>
                        <span style={styles.fileName}>{file.original_filename}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.fileSize}>{formatFileSize(file.file_size)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.fileDate}>{formatDate(file.uploaded_at)}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          onClick={() => handleDownload(file.id, file.original_filename)}
                          style={styles.downloadBtn}
                          title="Download"
                        >
                          📥 Download
                        </button>
                        <button
                          onClick={() => handleShare(file.id, file.original_filename)}
                          style={styles.shareBtn}
                          title="Share with another user"
                        >
                          🔗 Share
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          style={styles.deleteBtn}
                          title="Delete"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shared Files Section (if any) */}
      {sharedFiles.length > 0 && (
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>Shared With Me</h3>
            <p style={styles.tableSubtitle}>Files shared by other users</p>
          </div>
          
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>File Name</th>
                  <th style={styles.th}>Owner</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Shared</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sharedFiles.map((file) => (
                  <tr key={file.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.fileNameCell}>
                        <span style={styles.fileIcon}>{getFileIcon(file.original_filename)}</span>
                        <span style={styles.fileName}>{file.original_filename}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.ownerBadge}>{file.owner_username}</span>
                    </td>
                    <td style={styles.td}>{formatFileSize(file.file_size)}</td>
                    <td style={styles.td}>{formatDate(file.shared_at)}</td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleDownload(file.id, file.original_filename)}
                        style={styles.downloadBtn}
                      >
                        📥 Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Footer */}
      <div style={styles.securityFooter}>
        <div style={styles.securityIcon}>🔒</div>
        <div>
          <strong>End-to-End Encryption</strong><br />
          Files are encrypted with AES-256-GCM before upload. Only you and authorized recipients can decrypt files.
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
    transition: 'transform 0.3s'
  },
  statIcon: {
    fontSize: '35px'
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
  searchContainer: {
    marginBottom: '25px'
  },
  searchWrapper: {
    position: 'relative',
    maxWidth: '350px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '16px',
    color: '#94a3b8'
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px 12px 40px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    transition: 'all 0.3s',
    outline: 'none'
  },
  clearButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#94a3b8'
  },
  tableContainer: {
    background: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '25px'
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
    transition: 'background 0.2s'
  },
  fileNameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  fileIcon: {
    fontSize: '20px'
  },
  fileName: {
    fontWeight: '500',
    color: '#1e293b'
  },
  fileSize: {
    background: '#f1f5f9',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px'
  },
  fileDate: {
    background: '#f1f5f9',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px'
  },
  ownerBadge: {
    background: '#e0e7ff',
    color: '#4338ca',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px'
  },
  downloadBtn: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },
  shareBtn: {
    background: '#f59e0b',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },
  deleteBtn: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
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
  emptyState: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '15px'
  },
  uploadButton: {
    marginTop: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '10px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  securityFooter: {
    marginTop: '25px',
    padding: '15px 20px',
    background: '#f0fdf4',
    borderRadius: '10px',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    fontSize: '13px',
    color: '#166534',
    border: '1px solid #bbf7d0'
  },
  securityIcon: {
    fontSize: '24px'
  }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .stat-card:hover {
    transform: translateY(-5px);
  }
  button:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }
  tr:hover {
    background: #f8fafc;
  }
`;
document.head.appendChild(styleSheet);

export default Dashboard;
