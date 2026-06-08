import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';

function Downloads() {
  const [files, setFiles] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFiles();
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

  const handleDownload = async (fileId, filename) => {
    setDownloading(fileId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://cloak-api-igkh.onrender.com/api/files/download/${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.encrypted`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      alert(`✅ File "${filename}" downloaded successfully!\n\nNote: The file is encrypted. To decrypt, you need your RSA private key.`);
    } catch (error) {
      alert('Download failed: ' + error.message);
    } finally {
      setDownloading(null);
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

  const filteredFiles = files.filter(file =>
    file.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout title="Downloads">
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading your files...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Secure Downloads">
      {/* Stats Summary */}
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
            <h3 style={styles.statNumber}>{formatFileSize(files.reduce((sum, f) => sum + (f.file_size || 0), 0))}</h3>
            <p style={styles.statLabel}>Total Storage</p>
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
            <button
              onClick={() => setSearchTerm('')}
              style={styles.clearButton}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Files List */}
      <div style={styles.filesContainer}>
        {filteredFiles.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <h3>No files found</h3>
            <p>Upload files from the Upload page to get started</p>
          </div>
        ) : (
          <div style={styles.filesGrid}>
            {filteredFiles.map((file) => (
              <div key={file.id} style={styles.fileCard}>
                <div style={styles.fileIcon}>
                  {file.original_filename.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' :
                   file.original_filename.match(/\.(pdf)$/i) ? '📄' :
                   file.original_filename.match(/\.(zip|rar|7z)$/i) ? '🗜️' :
                   file.original_filename.match(/\.(mp4|mkv|avi)$/i) ? '🎬' :
                   file.original_filename.match(/\.(mp3|wav)$/i) ? '🎵' : '📎'}
                </div>
                <div style={styles.fileInfo}>
                  <h4 style={styles.fileName}>{file.original_filename}</h4>
                  <div style={styles.fileMeta}>
                    <span style={styles.fileSize}>{formatFileSize(file.file_size)}</span>
                    <span style={styles.fileDate}>{formatDate(file.uploaded_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(file.id, file.original_filename)}
                  disabled={downloading === file.id}
                  style={{
                    ...styles.downloadButton,
                    opacity: downloading === file.id ? 0.6 : 1
                  }}
                >
                  {downloading === file.id ? (
                    <span>⏳ Downloading...</span>
                  ) : (
                    <span>📥 Download</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Note */}
      <div style={styles.securityNote}>
        <div style={styles.noteIcon}>🔒</div>
        <div>
          <strong>Security Note:</strong> Files are encrypted with AES-256-GCM before download.
          The downloaded file has <code>.encrypted</code> extension and requires your RSA private key to decrypt.
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
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
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
    maxWidth: '400px'
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
  filesContainer: {
    minHeight: '400px'
  },
  filesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px'
  },
  fileCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'all 0.3s',
    border: '1px solid #f1f5f9'
  },
  fileIcon: {
    fontSize: '32px'
  },
  fileInfo: {
    flex: 1
  },
  fileName: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: '5px',
    wordBreak: 'break-word'
  },
  fileMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#64748b'
  },
  fileSize: {
    background: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  fileDate: {
    background: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  downloadButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
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
    color: '#94a3b8'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '15px'
  },
  securityNote: {
    marginTop: '30px',
    padding: '15px',
    background: '#f0fdf4',
    borderRadius: '10px',
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#166534',
    border: '1px solid #bbf7d0'
  },
  noteIcon: {
    fontSize: '20px'
  }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }
  button:hover {
    transform: translateY(-1px);
  }
`;
document.head.appendChild(styleSheet);

export default Downloads;
