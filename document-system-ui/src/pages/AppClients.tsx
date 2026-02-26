import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';

const AppClients: React.FC = () => {
    const [clients, setClients] = useState<any[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentClient, setCurrentClient] = useState<any>(null);
    const [appName, setAppName] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Secret expose modal
    const [newSecret, setNewSecret] = useState<{ appCode: string, rawSecret: string } | null>(null);

    const fetchClients = () => {
        api.get('/clients').then(res => setClients(res.data)).catch(console.error);
    };

    useEffect(() => {
        fetchClients();
        api.get('/templates').then(res => setTemplates(res.data)).catch(console.error);
    }, []);

    const openModal = (mode: 'add' | 'edit', client?: any) => {
        setModalMode(mode);
        setCurrentClient(client || null);
        setAppName(client ? client.appName : '');
        setIsActive(client ? client.isActive : true);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!appName) return toast.warn('App Name is required');
        try {
            if (modalMode === 'add') {
                const res = await api.post('/clients', { appName });
                setNewSecret(res.data);
                toast.success('Client application created!');
            } else {
                await api.put(`/clients/${currentClient.id}`, { appName, isActive });
                toast.success('Client application updated!');
            }
            setIsModalOpen(false);
            fetchClients();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Error saving client');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this application?')) return;
        try {
            await api.delete(`/clients/${id}`);
            toast.success('Client application deleted');
            fetchClients();
        } catch (e: any) {
            toast.error('Error deleting client');
        }
    };

    const handleRotate = async (id: string) => {
        if (!confirm('Rotating the secret will immediately invalidate the current secret. Continue?')) return;
        try {
            const res = await api.post(`/clients/${id}/rotate`);
            setNewSecret(res.data);
            toast.success('Secret rotated successfully');
            fetchClients();
        } catch (e: any) {
            toast.error('Error rotating secret');
        }
    };

    const handleReveal = async (id: string) => {
        try {
            const res = await api.get(`/clients/${id}/reveal`);
            setNewSecret(res.data);
            toast.success('Secret Revealed. Keep it safe.');
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Error revealing secret');
        }
    };

    const handleAssignTemplate = async (clientId: string, templateCode: string) => {
        if (!templateCode) return;
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const existing = client.assignedTemplates || [];
        if (existing.includes(templateCode)) return toast.info('Template already assigned');

        try {
            const updated = [...existing, templateCode];
            await api.put(`/clients/${clientId}`, { assignedTemplates: updated });
            toast.success('Template assigned');
            fetchClients();
        } catch (e) {
            toast.error('Failed to assign template');
        }
    };

    const handleRemoveTemplate = async (clientId: string, templateCode: string) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        try {
            const existing = client.assignedTemplates || [];
            const updated = existing.filter((code: string) => code !== templateCode);
            await api.put(`/clients/${clientId}`, { assignedTemplates: updated });
            toast.success('Template removed');
            fetchClients();
        } catch (e) {
            toast.error('Failed to remove template');
        }
    };
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Application Clients</h1>
                <button onClick={() => openModal('add')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Create App</button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                            <th className="p-4 font-medium">App Name</th>
                            <th className="p-4 font-medium">App Code</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {clients.map(c => (
                            <React.Fragment key={c.id}>
                                <tr className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                                    <td className="p-4 font-medium text-gray-900">{c.appName}</td>
                                    <td className="p-4 font-mono text-xs text-gray-500">{c.appCode}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td className="p-4 text-right">
                                        <button className="text-gray-600 hover:text-black hover:underline mr-4" onClick={(e) => { e.stopPropagation(); handleReveal(c.id); }}>View Secret</button>
                                        <button className="text-orange-600 hover:underline mr-4" onClick={(e) => { e.stopPropagation(); handleRotate(c.id); }}>Rotate Secret</button>
                                        <button className="text-blue-600 hover:underline mr-4" onClick={(e) => { e.stopPropagation(); openModal('edit', c); }}>Edit</button>
                                        <button className="text-red-600 hover:underline" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>Delete</button>
                                    </td>
                                </tr>
                                {expandedId === c.id && (
                                    <tr className="bg-blue-50/50">
                                        <td colSpan={4} className="p-6 border-b border-gray-100">
                                            <div className="flex flex-col md:flex-row gap-8">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-800 mb-2">Connection Details</h4>
                                                    <p className="text-sm text-gray-600 mb-4">App Code: <span className="font-mono bg-white px-2 py-0.5 border border-gray-200 shadow-sm rounded">{c.appCode}</span></p>
                                                </div>
                                                <div className="flex-[2] bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center justify-between">
                                                        <span>Assigned Templates</span>
                                                        <select
                                                            className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 py-1"
                                                            onChange={(e) => {
                                                                handleAssignTemplate(c.id, e.target.value);
                                                                e.target.value = '';
                                                            }}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>+ Link a template...</option>
                                                            {templates.map(t => (
                                                                <option key={t.id} value={t.templateCode}>{t.templateName} ({t.templateCode})</option>
                                                            ))}
                                                        </select>
                                                    </h4>

                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {(c.assignedTemplates || []).map((code: string) => {
                                                            const t = templates.find(t => t.templateCode === code);
                                                            return (
                                                                <div key={code} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md text-sm font-medium pr-1">
                                                                    <span>{t ? t.templateName : code} <span className="text-xs opacity-60 font-mono">({code})</span></span>
                                                                    <button onClick={() => handleRemoveTemplate(c.id, code)} className="p-0.5 hover:bg-blue-200 rounded-full text-blue-500 hover:text-blue-800 transition-colors">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                        {(!c.assignedTemplates || c.assignedTemplates.length === 0) && (
                                                            <span className="text-sm text-gray-400 italic">No templates assigned. This app cannot generate any PDFs yet.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <h3 className="font-bold text-lg">{modalMode === 'add' ? 'Create Application' : 'Edit Application'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 space-y-4 text-sm">
                            <div>
                                <label className="block text-gray-700 mb-1">Application Name</label>
                                <input value={appName} onChange={e => setAppName(e.target.value)} className="w-full border-gray-300 rounded" type="text" placeholder="e.g. Finance Dashboard" />
                            </div>
                            {modalMode === 'edit' && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-blue-600 border-gray-300 focus:ring-blue-500" />
                                        <span>Active Connection</span>
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 bg-white hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 transition">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Secret Modal */}
            {newSecret && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden border-2 border-orange-200">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-orange-50">
                            <h3 className="font-bold text-lg text-orange-800">Application Secret Key</h3>
                            <button onClick={() => setNewSecret(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4 text-sm">
                            <p className="text-gray-600">Please copy this secret key and store it securely.</p>

                            <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-xs break-all">
                                <strong>App Code:</strong> {newSecret.appCode} <br /><br />
                                <strong>Secret:</strong> <span className="text-blue-600">{newSecret.rawSecret}</span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
                            <button onClick={() => setNewSecret(null)} className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 transition">I have copied it</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default AppClients;
