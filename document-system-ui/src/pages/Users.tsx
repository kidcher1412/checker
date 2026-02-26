import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';

const Users: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roleName, setRoleName] = useState('');
    const [isActive, setIsActive] = useState(true);

    const fetchUsers = () => {
        api.get('/users').then(res => setUsers(res.data)).catch(console.error);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const openModal = (mode: 'add' | 'edit', user?: any) => {
        setModalMode(mode);
        setCurrentUser(user || null);
        setEmail(user ? user.email : '');
        setPassword('');
        setRoleName(user && user.roles?.length ? user.roles[0].name : '');
        setIsActive(user ? user.isActive : true);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!email) return toast.warn('Email is required');
        try {
            if (modalMode === 'add') {
                if (!password) return toast.warn('Password is required');
                await api.post('/users', { email, password, roleName });
                toast.success('User created!');
            } else {
                await api.put(`/users/${currentUser.id}`, { isActive, roleName, password: password || undefined });
                toast.success('User updated!');
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Error saving user');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            toast.success('User deleted');
            fetchUsers();
        } catch (e: any) {
            toast.error('Error deleting user');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Users & RBAC</h1>
                <button onClick={() => openModal('add')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Add User</button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                            <th className="p-4 font-medium">User Email</th>
                            <th className="p-4 font-medium">Roles</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 transition">
                                <td className="p-4 font-medium text-gray-900">{u.email}</td>
                                <td className="p-4">
                                    {u.roles?.map((r: any) => (
                                        <span key={r.id} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold mr-2">{r.name}</span>
                                    ))}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {u.isActive ? 'Active' : 'Suspended'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => openModal('edit', u)} className="text-blue-600 hover:underline mr-4">Edit</button>
                                    <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <h3 className="font-bold text-lg">{modalMode === 'add' ? 'Add New User' : 'Edit User'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 space-y-4 text-sm">
                            <div>
                                <label className="block text-gray-700 mb-1">Email</label>
                                <input disabled={modalMode === 'edit'} value={email} onChange={e => setEmail(e.target.value)} className="w-full border-gray-300 rounded disabled:bg-gray-100" type="email" />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-1">Password {modalMode === 'edit' && <span className="text-xs text-gray-400">(Leave blank to keep current)</span>}</label>
                                <input value={password} onChange={e => setPassword(e.target.value)} className="w-full border-gray-300 rounded" type="password" />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-1">Role Name (Optional)</label>
                                <select value={roleName} onChange={e => setRoleName(e.target.value)} className="w-full border-gray-300 rounded">
                                    <option value="">Select a role...</option>
                                    <option value="Super Admin">Super Admin</option>
                                    <option value="Editor">Editor</option>
                                    <option value="Viewer">Viewer</option>
                                </select>
                            </div>
                            {modalMode === 'edit' && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-blue-600 border-gray-300 focus:ring-blue-500" />
                                        <span>Active Account</span>
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
        </div>
    );
};
export default Users;
