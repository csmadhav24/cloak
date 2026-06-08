import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

function Upload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const encryptFile = async (file, serverPublicKey) => {
    // Generate AES-256 key
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Read file
    const fileBuffer = await file.arrayBuffer();

    // Encrypt file with AES
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      aesKey,
      fileBuffer
    );

    // Export AES key
    const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);

    // Import server's RSA public key
    const rsaPublicKey = await window.crypto.subtle.importKey(
      "spki",
      serverPublicKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );

    // Encrypt AES key with RSA
    const encryptedAesKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      rsaPublicKey,
      aesKeyRaw
    );

    // Compute SHA-256 hash
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      encryptedFile: encrypted,
      encryptedAesKey: arrayBufferToHex(encryptedAesKey),
      iv: arrayBufferToHex(iv),
      authTag: arrayBufferToHex(encrypted.slice(-16)),
      hash: hashHex
    };
  };

  const arrayBufferToHex = (buffer) => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setProgress(20);

    try {
      // Get server public key
      setProgress(30);
      const keyResponse = await fetch('https://cloak-api-igkh.onrender.com/api/auth/public-key');
      const keyData = await keyResponse.json();
      const serverPublicKeyPem = keyData.public_key;
      
      // Convert PEM to buffer
      const pemContents = serverPublicKeyPem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\n/g, '');
      const serverPublicKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

      // Encrypt file
      setProgress(50);
      const encrypted = await encryptFile(file, serverPublicKey.buffer);

      // Upload to server
      setProgress(70);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', new Blob([encrypted.encryptedFile]), file.name);
      formData.append('encrypted_aes_key', encrypted.encryptedAesKey);
      formData.append('iv', encrypted.iv);
      formData.append('auth_tag', encrypted.authTag);
      formData.append('sha256_hash', encrypted.hash);

      const uploadResponse = await fetch('https://cloak-api-igkh.onrender.com/api/files/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      setProgress(100);

      if (uploadResponse.ok) {
        alert('File uploaded successfully!');
        navigate('/dashboard');
      } else {
        const error = await uploadResponse.json();
        alert('Upload failed: ' + (error.detail || 'Unknown error'));
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <Layout title="Upload File">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? '#667eea' : '#ccc'}`,
            borderRadius: '10px',
            padding: '60px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? '#f0f0ff' : 'white',
            transition: 'all 0.3s'
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            {isDragActive ? '📂' : '📁'}
          </div>
          <h3>
            {isDragActive
              ? 'Drop your file here'
              : 'Drag & drop a file here, or click to select'}
          </h3>
          <p style={{ color: '#666', marginTop: '10px' }}>
            Maximum file size: 100MB
          </p>
          <p style={{ color: '#999', fontSize: '12px', marginTop: '10px' }}>
            🔒 Files are encrypted with AES-256-GCM before upload
          </p>
        </div>

        {uploading && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              background: '#e0e0e0',
              borderRadius: '10px',
              height: '20px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
                height: '100%',
                transition: 'width 0.3s'
              }} />
            </div>
            <p style={{ textAlign: 'center', marginTop: '10px' }}>
              {progress < 30 && '🔐 Getting encryption keys...'}
              {progress >= 30 && progress < 70 && '🔒 Encrypting file...'}
              {progress >= 70 && '📤 Uploading...'}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Upload;
