import React, { useState, useEffect } from 'react';
import { FileText, Users, Code, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className={`p-4 rounded-lg bg-${color}-50 text-${color}-600`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        api.get('/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
    }, []);

    if (!stats) return <div className="p-8">Loading...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Templates" value={stats.totalTemplates} icon={FileText} color="blue" />
                <StatCard title="Active Clients" value={stats.totalApps} icon={Code} color="orange" />
                <StatCard title="Users" value={stats.totalUsers} icon={Users} color="green" />
                <StatCard title="PDFs Generated" value={stats.totalDocsGenerated} icon={Activity} color="purple" />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                <h2 className="text-lg font-semibold text-gray-800 mb-6">Document Generation Volume (Last 7 Days)</h2>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="docs" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Dashboard;
