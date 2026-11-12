import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function ConsentManager() {
    const [consents, setConsents] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [form, setForm] = useState({ institution_id: '', document_id: '', purpose: '', expiry_date: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchConsents();
        fetchDocuments();
    }, []);

    const fetchConsents = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/consent/');
            setConsents(res.data);
        } catch (err) {
            setError('Failed to load consents.');
        } finally {
            setLoading(false);
        }
    };

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/api/documents/');
            setDocuments(res.data);
        } catch (err) {
            console.error('Failed to load documents');
        }
    };

    const handleGrant = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/consent/', {
                ...form,
                document_id: parseInt(form.document_id),
                expiry_date: new Date(form.expiry_date).toISOString()
            });
            setForm({ institution_id: '', document_id: '', purpose: '', expiry_date: '' });
            fetchConsents();
        } catch (err) {
            setError('Failed to grant consent.');
        }
    };

    const handleRevoke = async (id) => {
        try {
            await api.patch(`/api/consent/${id}/revoke`);
            fetchConsents();
        } catch (err) {
            setError('Failed to revoke consent.');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Consent Management</h2>
            {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}
            
            <form onSubmit={handleGrant} className="bg-white p-4 shadow rounded mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Institution ID / Name</label>
                    <input type="text" value={form.institution_id} onChange={e => setForm({...form, institution_id: e.target.value})} required className="mt-1 block w-full border rounded p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Select Document</label>
                    <select value={form.document_id} onChange={e => setForm({...form, document_id: e.target.value})} required className="mt-1 block w-full border rounded p-2">
                        <option value="">-- Choose Document --</option>
                        {documents.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.filename} (ID: {doc.id})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Purpose</label>
                    <input type="text" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} required className="mt-1 block w-full border rounded p-2" placeholder="e.g., Cardiology Consultation" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Expiry Date & Time</label>
                    <input type="datetime-local" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} required className="mt-1 block w-full border rounded p-2" />
                </div>
                <div className="md:col-span-2">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Grant Access</button>
                </div>
            </form>

            <h3 className="text-xl font-semibold mb-3">Active, Expired & Revoked Permissions</h3>
            {loading ? <p>Loading permissions...</p> : (
                <div className="bg-white shadow overflow-hidden rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doc ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {consents.map(c => (
                                <tr key={c.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.institution_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.document_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.purpose}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(c.expiry_date).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            c.status === 'active' ? 'bg-green-100 text-green-800' :
                                            c.status === 'expired' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {c.status === 'active' && (
                                            <button onClick={() => handleRevoke(c.id)} className="text-red-600 hover:text-red-900">Revoke</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
