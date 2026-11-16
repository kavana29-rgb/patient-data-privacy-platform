import { useState, useEffect, useCallback, useRef } from 'react';
import { documentApi } from '../services/api';
import { useToast } from '../context/useToast';

export default function DocumentManager({ onSelectForRedaction }) {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Preview Modal
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewVersion, setPreviewVersion] = useState('original');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Delete Confirmation Modal
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadDocuments = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await documentApi.listDocuments();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Failed to load your medical documents.', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [showToast]);

  useEffect(() => {
    let ignore = false;
    documentApi.listDocuments()
      .then((data) => {
        if (!ignore) {
          setDocuments(Array.isArray(data) ? data : []);
          setIsLoadingList(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          showToast(err.message || 'Failed to load medical documents.', 'error');
          setIsLoadingList(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [showToast]);

  const validateAndSetFile = (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Invalid file format. Please choose a PDF (.pdf) file.', 'error');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('File exceeds the maximum limit of 5 MB.', 'error');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    validateAndSetFile(e.target.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please select a valid PDF document to upload.', 'warning');
      return;
    }

    setIsUploading(true);
    setUploadProgress(35);

    try {
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 15 : p));
      }, 200);

      await documentApi.uploadDocument(selectedFile);
      clearInterval(progressTimer);
      setUploadProgress(100);

      showToast(`"${selectedFile.name}" securely stored in vault.`, 'success');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocuments();
    } catch (err) {
      showToast(err.message || 'Document upload failed.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenPreview = async (doc, version) => {
    setIsLoadingPreview(true);
    setPreviewDoc(doc);
    setPreviewVersion(version);

    try {
      const blob = await documentApi.fetchDocumentBlob(doc.id, version);
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (err) {
      showToast(err.message || `Could not preview ${version} document.`, 'error');
      setPreviewDoc(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewDoc(null);
  };

  const handleDownload = async (doc, version) => {
    try {
      showToast(`Preparing ${version} download...`, 'info', 2000);
      const blob = await documentApi.fetchDocumentBlob(doc.id, version);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${version}_${doc.filename}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloaded ${doc.filename} (${version}).`, 'success');
    } catch (err) {
      showToast(err.message || `Download failed for ${doc.filename}.`, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);

    try {
      await documentApi.deleteDocument(docToDelete.id);
      showToast(`Document "${docToDelete.filename}" deleted.`, 'success');
      if (previewDoc?.id === docToDelete.id) {
        handleClosePreview();
      }
      setDocToDelete(null);
      await loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to delete document.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'redacted') return doc.has_redacted;
    if (statusFilter === 'original') return !doc.has_redacted;
    return true;
  });

  return (
    <div className="card" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: '700' }}>
            Medical Document Vault
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
            Upload, inspect, redact, and manage encrypted medical records. Files are restricted to verified PDF format (max 5 MB).
          </p>
        </div>
        <button
          type="button"
          onClick={loadDocuments}
          className="btn btn-outline btn-sm"
          disabled={isLoadingList}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Modern Drag and Drop Upload Area */}
      <form onSubmit={handleUpload}>
        <div
          className={`dropzone ${isDragOver ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            disabled={isUploading}
            style={{ display: 'none' }}
          />

          <div className="dropzone-icon">
            📄
          </div>

          {selectedFile ? (
            <div>
              <div className="dropzone-title" style={{ color: 'var(--primary)' }}>
                {selectedFile.name}
              </div>
              <div className="dropzone-hint">
                {formatSize(selectedFile.size)} &bull; Ready to upload
              </div>
            </div>
          ) : (
            <div>
              <div className="dropzone-title">
                Drag and drop your medical PDF here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse</span>
              </div>
              <div className="dropzone-hint">
                Supported format: PDF only &bull; Maximum file size: 5 MB
              </div>
            </div>
          )}

          {selectedFile && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isUploading}
              >
                {isUploading ? `Uploading (${uploadProgress}%)...` : '⬆️ Start Secure Upload'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={isUploading}
              >
                Cancel
              </button>
            </div>
          )}

          {isUploading && (
            <div style={{ width: '100%', maxWidth: '300px', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.75rem' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.2s ease' }}></div>
            </div>
          )}
        </div>
      </form>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-control"
            placeholder="Search documents by filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Documents ({documents.length})</option>
          <option value="redacted">Redacted Versions</option>
          <option value="original">Unredacted Originals</option>
        </select>
      </div>

      {/* Documents List */}
      {isLoadingList ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading medical documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📁</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem', display: 'block' }}>
            {searchTerm || statusFilter !== 'all' ? 'No matching documents found' : 'Your vault is currently empty'}
          </strong>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            {searchTerm || statusFilter !== 'all'
              ? 'Try modifying your search query or clear the filter.'
              : 'Drag & drop a medical PDF above to securely store and protect your healthcare record.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document Details</th>
                <th>File Size</th>
                <th>Upload Date</th>
                <th>Protection Status</th>
                <th>Available Versions</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>📄</span>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                          {doc.filename}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ID: #{doc.id}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{formatSize(doc.file_size)}</td>
                  <td>
                    {doc.uploaded_at
                      ? new Date(doc.uploaded_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Recently'}
                  </td>
                  <td>
                    {doc.has_redacted ? (
                      <span className="badge badge-green">
                        ✓ Redacted & Protected
                      </span>
                    ) : (
                      <span className="badge badge-blue">
                        🔒 Encrypted Original
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenPreview(doc, 'original')}
                        title="Preview Original Version"
                      >
                        👁️ Original
                      </button>
                      {doc.has_redacted && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: 'var(--success-border)', color: 'var(--success-text)' }}
                          onClick={() => handleOpenPreview(doc, 'redacted')}
                          title="Preview Redacted Version"
                        >
                          👁️ Redacted
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      {/* Redact Action Button */}
                      {onSelectForRedaction && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onSelectForRedaction(doc.id)}
                          title="Open in Redaction Studio"
                        >
                          🛡️ Redact
                        </button>
                      )}

                      {/* Download Menu */}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDownload(doc, doc.has_redacted ? 'redacted' : 'original')}
                        title="Download Document"
                      >
                        📥 Download
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm"
                        onClick={() => setDocToDelete(doc)}
                        title="Delete document permanently"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF In-App Preview Modal */}
      {(previewUrl || isLoadingPreview) && (
        <div className="modal-overlay" onClick={handleClosePreview}>
          <div
            className="modal-card"
            style={{ maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>👁️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {previewDoc?.filename}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Viewing: <strong style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{previewVersion}</strong> version
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleClosePreview}
                aria-label="Close Preview"
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative' }}>
              {isLoadingPreview ? (
                <div className="loading-container" style={{ height: '100%' }}>
                  <div className="spinner"></div>
                  <p>Decrypting and loading document preview...</p>
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  title={`Preview of ${previewDoc?.filename}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}
            </div>

            <div className="modal-footer">
              {previewDoc && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownload(previewDoc, previewVersion)}
                >
                  📥 Download {previewVersion.toUpperCase()} PDF
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleClosePreview}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDocToDelete(null)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--error-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.35rem', color: 'var(--error)' }}>⚠️</span>
                <h3 style={{ color: 'var(--error)' }}>Confirm Deletion</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isDeleting && setDocToDelete(null)}
                disabled={isDeleting}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Are you sure you want to permanently delete:
              </p>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {docToDelete.filename}
              </div>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                This will permanently delete the encrypted original and any associated redacted files from storage. This action cannot be undone.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDocToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
