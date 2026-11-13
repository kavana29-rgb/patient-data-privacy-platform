import React, { useState, useEffect } from 'react';
import { documentApi } from '../services/api';

export default function DocumentManager() {
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadDocuments();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const loadDocuments = async () => {
    setIsLoadingList(true);
    setErrorMsg('');
    try {
      const data = await documentApi.listDocuments();
      setDocuments(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load your medical documents.');
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleFileSelect = (e) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Invalid file format. Please choose a PDF (.pdf) file.');
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File exceeds the maximum limit of 5 MB.');
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a valid PDF document before uploading.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await documentApi.uploadDocument(selectedFile);
      setSuccessMsg(`"${selectedFile.name}" uploaded securely.`);
      setSelectedFile(null);
      e.target.reset();
      await loadDocuments();
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenDocument = async (doc, version, action) => {
    setErrorMsg('');
    try {
      const blob = await documentApi.fetchDocumentBlob(doc.id, version);
      const blobUrl = URL.createObjectURL(blob);

      if (action === 'preview') {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(blobUrl);
        setPreviewTitle(`${version.toUpperCase()} — ${doc.filename}`);
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${version}_${doc.filename}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (err) {
      setErrorMsg(err.message || `Could not open ${version} document.`);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1a202c' }}>
      <h2 style={{ marginTop: 0 }}>Medical Document Vault</h2>
      <p style={{ color: '#4a5568', fontSize: '0.95rem' }}>
        Upload synthetic medical reports (PDF only, max 5 MB) to manage original and redacted versions securely.
      </p>

      {/* Upload Form */}
      <form onSubmit={handleUpload} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          style={{
            padding: '8px 16px',
            backgroundColor: !selectedFile || isUploading ? '#cbd5e0' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload PDF'}
        </button>
      </form>

      {/* Feedback States */}
      {errorMsg && (
        <div style={{ padding: '10px 14px', marginBottom: '1rem', backgroundColor: '#fed7d7', color: '#9b2c2c', borderRadius: '6px' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '10px 14px', marginBottom: '1rem', backgroundColor: '#c6f6d5', color: '#22543d', borderRadius: '6px' }}>
          {successMsg}
        </div>
      )}

      {/* Document Table */}
      {isLoadingList ? (
        <p>Loading your medical documents...</p>
      ) : documents.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f7fafc', borderRadius: '6px', color: '#718096' }}>
          No medical documents uploaded yet. Select a synthetic PDF file above to begin.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '10px' }}>Document Name</th>
                <th style={{ padding: '10px' }}>Size</th>
                <th style={{ padding: '10px' }}>Upload Date</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Original Version</th>
                <th style={{ padding: '10px' }}>Redacted Version</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px', fontWeight: '500' }}>{doc.filename}</td>
                  <td style={{ padding: '10px' }}>{formatSize(doc.file_size_bytes)}</td>
                  <td style={{ padding: '10px' }}>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.85rem', backgroundColor: '#ebf8ff', color: '#2b6cb0' }}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button onClick={() => handleOpenDocument(doc, 'original', 'preview')} style={{ marginRight: '6px', cursor: 'pointer' }}>
                      Preview
                    </button>
                    <button onClick={() => handleOpenDocument(doc, 'original', 'download')} style={{ cursor: 'pointer' }}>
                      Download
                    </button>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {doc.has_redacted ? (
                      <>
                        <button onClick={() => handleOpenDocument(doc, 'redacted', 'preview')} style={{ marginRight: '6px', cursor: 'pointer' }}>
                          Preview
                        </button>
                        <button onClick={() => handleOpenDocument(doc, 'redacted', 'download')} style={{ cursor: 'pointer' }}>
                          Download
                        </button>
                      </>
                    ) : (
                      <span style={{ color: '#a0aec0', fontSize: '0.9rem' }}>Not redacted yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Embedded PDF Previewer */}
      {previewUrl && (
        <div style={{ marginTop: '1.5rem', border: '1px solid #cbd5e0', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', backgroundColor: '#edf2f7' }}>
            <strong>{previewTitle}</strong>
            <button
              onClick={() => {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
              style={{ padding: '4px 10px', cursor: 'pointer' }}
            >
              Close Preview
            </button>
          </div>
          <iframe src={previewUrl} title="PDF Document Preview" width="100%" height="520px" style={{ border: 'none', display: 'block' }} />
        </div>
      )}
    </div>
  );
}
