import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

interface TemplateDef {
    id: string;
    templateCode: string;
    templateName: string;
    version: number;
    isTimeBased: boolean;
    validFrom: string | null;
    validTo: string | null;
    currentActiveVersion: number | null;
}

const Templates: React.FC = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<TemplateDef[]>([]);

    const fetchTemplates = () => {
        api.get('/templates').then(res => {
            setTemplates(res.data);
        }).catch(() => {
            toast.error('Failed to load templates');
        });
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
                <button
                    onClick={() => navigate('/templates/builder')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                >
                    Create Template
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                            <th className="p-4 font-medium">Template Name</th>
                            <th className="p-4 font-medium">Code</th>
                            <th className="p-4 font-medium">Version / Type</th>
                            <th className="p-4 font-medium">Current Generate Version</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {templates.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 transition">
                                <td className="p-4 font-medium text-gray-900">{t.templateName}</td>
                                <td className="p-4 font-mono text-xs text-gray-500">{t.templateCode}</td>
                                <td className="p-4 text-gray-600 flex flex-col items-start gap-1">
                                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">v{t.version}</span>
                                    {t.isTimeBased && (
                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-medium tracking-wide uppercase">Time Based</span>
                                    )}
                                </td>
                                <td className="p-4 text-gray-800 font-medium">
                                    {t.currentActiveVersion ? (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-bold">v{t.currentActiveVersion}</span>
                                    ) : (
                                        <span className="text-gray-400 italic text-sm">None</span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => navigate(`/templates/builder/${t.templateCode}`)} className="text-blue-600 hover:underline">Edit (New Version)</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {templates.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500">No templates found. Create one.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default Templates;
