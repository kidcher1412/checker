import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, Users, FileText, LogOut, Code } from 'lucide-react';

const AdminLayout: React.FC = () => {
    const { isAuthenticated, logout } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const handleLogout = () => {
        logout();
    };

    // Decode JWT for header info
    const token = localStorage.getItem('access_token');
    let email = 'Admin User';
    let role = 'Admin';
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            email = payload.email || email;
            role = payload.roles?.[0]?.name || role;
        } catch (e) {
            console.error('Failed to parse JWT');
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-4 text-2xl font-bold border-b border-slate-800">
                    Doc<span className="text-blue-400">System</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <NavLink to="/" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                        <LayoutDashboard size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/templates" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                        <FileText size={20} /> Templates
                    </NavLink>
                    <NavLink to="/applications" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                        <Code size={20} /> App Clients
                    </NavLink>
                    <NavLink to="/users" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                        <Users size={20} /> Users & RBAC
                    </NavLink>
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full rounded-md hover:bg-red-900/50 text-red-400 transition-colors">
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700">Xin chào <span className="font-bold">{email}</span> ({role})</span>
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">{email.charAt(0)}</div>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-6 bg-gray-50">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
