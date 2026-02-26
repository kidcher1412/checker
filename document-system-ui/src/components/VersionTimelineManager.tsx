import React, { useState, useEffect, useRef } from 'react';
import { X, Settings2, Save, Trash2, Edit, Plus, MinusCircle } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

interface VersionTimelineManagerProps {
    isOpen: boolean;
    onClose: () => void;
    templateCode: string;
    onLoadVersion: (version: number) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const VersionTimelineManager: React.FC<VersionTimelineManagerProps> = ({ isOpen, onClose, templateCode, onLoadVersion }) => {
    const [versions, setVersions] = useState<any[]>([]);
    const [timelineSpanDays, setTimelineSpanDays] = useState(365);
    const baseDate = useRef(new Date(new Date().setHours(0, 0, 0, 0) - 30 * MS_PER_DAY).getTime());
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<{ id: string, side: 'validFrom' | 'validTo' | 'both', startX: number, initFrom: number | null, initTo: number | null } | null>(null);

    const fetchVersions = () => {
        if (!templateCode) return;
        api.get(`/templates/${templateCode}`).then(res => {
            const data = Array.isArray(res.data) ? res.data : [res.data];
            setVersions(data.map((v: any, i: number) => ({
                ...v,
                color: COLORS[i % COLORS.length],
                validFrom: v.validFrom ? new Date(v.validFrom).getTime() : null,
                validTo: v.validTo ? new Date(v.validTo).getTime() : null
            })));
        });
    };

    useEffect(() => {
        if (isOpen) fetchVersions();
    }, [isOpen, templateCode]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging || !trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();

            // Delta drag calculation
            const deltaX = e.clientX - dragging.startX;
            const deltaDays = (deltaX / rect.width) * timelineSpanDays;
            const deltaMs = deltaDays * MS_PER_DAY;

            if (dragging.side === 'both') {
                if (dragging.initFrom) {
                    const newFrom = new Date(dragging.initFrom + deltaMs);
                    newFrom.setHours(0, 0, 0, 0);
                    updateVersionDate(dragging.id, 'validFrom', newFrom.toISOString());
                }
                if (dragging.initTo) {
                    const newTo = new Date(dragging.initTo + deltaMs);
                    newTo.setHours(23, 59, 59, 999);
                    updateVersionDate(dragging.id, 'validTo', newTo.toISOString());
                }
            } else if (dragging.side === 'validTo') {
                if (dragging.initTo || dragging.initFrom) {
                    const baseTs = dragging.initTo || new Date().getTime();
                    const newDate = new Date(baseTs + deltaMs);
                    newDate.setHours(23, 59, 59, 999);
                    updateVersionDate(dragging.id, 'validTo', newDate.toISOString());
                }
            } else if (dragging.side === 'validFrom') {
                if (dragging.initFrom) {
                    const newDate = new Date(dragging.initFrom + deltaMs);
                    newDate.setHours(0, 0, 0, 0);
                    updateVersionDate(dragging.id, 'validFrom', newDate.toISOString());
                }
            }
        };

        const handleMouseUp = () => setDragging(null);

        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, timelineSpanDays]);

    if (!isOpen) return null;

    const timeToPosition = (timestamp: number | null, isEnd: boolean) => {
        if (!timestamp) return isEnd ? 100 : 0;
        const offsetMs = timestamp - baseDate.current;
        const offsetDays = offsetMs / MS_PER_DAY;
        const percentage = (offsetDays / timelineSpanDays) * 100;
        return Math.max(0, Math.min(100, percentage));
    };

    const handleSave = async () => {
        let success = true;
        for (const v of versions) {
            try {
                await api.put(`/templates/${v.id}`, {
                    isTimeBased: v.isTimeBased,
                    validFrom: v.validFrom ? new Date(v.validFrom).toISOString() : null,
                    validTo: v.validTo ? new Date(v.validTo).toISOString() : null
                });
            } catch (e: any) {
                toast.error(`Failed to update v${v.version}: ${e.response?.data?.message || 'Error'}`);
                success = false;
            }
        }
        if (success) {
            toast.success('Timeline updated successfully');
            onClose();
        }
    };

    const updateVersionDate = (id: string, field: 'validFrom' | 'validTo', newDateStr: string | null) => {
        setVersions(prev => prev.map(v => v.id === id ? { ...v, [field]: newDateStr ? new Date(newDateStr).getTime() : null, isTimeBased: true } : v));
    };

    const getLatestActiveVersion = () => {
        const active = versions.filter(v => v.isTimeBased);
        if (active.length === 0) return null;

        // Find the one extending furthest or infinity
        let furthest = active[0];
        for (const v of active) {
            if (!v.validTo) return v; // infinity wins
            if (furthest.validTo && v.validTo > furthest.validTo) furthest = v;
        }
        return furthest;
    };

    const addToTimeline = (id: string) => {
        const latestInfo = getLatestActiveVersion();

        let newValidFrom = new Date().setHours(0, 0, 0, 0);

        setVersions(prev => {
            const newVersions = [...prev];

            if (latestInfo) {
                const latestObj = newVersions.find(v => v.id === latestInfo.id);
                if (latestObj) {
                    if (!latestObj.validTo) {
                        // It was infinity, crop it to yesterday
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        yesterday.setHours(23, 59, 59, 999);
                        latestObj.validTo = yesterday.getTime();
                        newValidFrom = new Date().setHours(0, 0, 0, 0);
                    } else {
                        // Start exactly after its end
                        const exactNext = new Date(latestObj.validTo);
                        exactNext.setDate(exactNext.getDate() + 1);
                        exactNext.setHours(0, 0, 0, 0);
                        newValidFrom = exactNext.getTime();
                    }
                }
            }

            return newVersions.map(v => v.id === id ? { ...v, isTimeBased: true, validFrom: newValidFrom, validTo: null } : v);
        });
    };

    const removeFromTimeline = (id: string) => {
        setVersions(prev => prev.map(v => v.id === id ? { ...v, isTimeBased: false, validFrom: null, validTo: null } : v));
    };

    const deleteVersion = async (id: string) => {
        if (!confirm('Are you sure you want to delete this version entirely?')) return;
        try {
            await api.delete(`/templates/${id}`);
            toast.success('Version deleted');
            fetchVersions();
        } catch (e) {
            toast.error('Failed to delete version');
        }
    };

    const handleEdit = (version: number) => {
        onLoadVersion(version);
        onClose();
    };

    const activeTimelineVersions = versions.filter(v => v.isTimeBased && (v.validFrom || v.validTo));
    const todayPct = timeToPosition(new Date().getTime(), false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
            <div className={`bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh] ${dragging ? 'select-none pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 pointer-events-auto">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Settings2 size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Version Timeline</h2>
                            <p className="text-sm font-mono text-gray-500">{templateCode}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={24} /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 space-y-8 pointer-events-auto">
                    {/* Unified Timeline Track */}
                    <div>
                        <div className="mb-4 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-800">Unified Timeline Track <span className="text-sm font-normal text-gray-500 ml-2">(Drag edges to resize dates)</span></h3>
                            <select className="text-sm border-gray-200 rounded" value={timelineSpanDays} onChange={e => setTimelineSpanDays(Number(e.target.value))}>
                                <option value={90}>Next 90 Days</option>
                                <option value={365}>Next 1 Year</option>
                                <option value={1095}>Next 3 Years</option>
                                <option value={3650}>Next 10 Years</option>
                            </select>
                        </div>
                        <div className="relative pt-8 pb-12 bg-white border border-gray-200 rounded-xl shadow-sm px-4 select-none">
                            <div className="absolute top-0 bottom-0 left-4 right-4 border-b-2 border-dashed border-gray-300 pointer-events-none mt-16 z-0"></div>

                            <div className="relative h-16 w-full mt-4 group" ref={trackRef}>
                                <div className="absolute inset-0 bg-gray-100 rounded-md overflow-hidden outline outline-1 outline-gray-200">
                                    {activeTimelineVersions.map(v => {
                                        const leftPct = timeToPosition(v.validFrom, false);
                                        const rightPct = timeToPosition(v.validTo, true);
                                        const width = Math.max(0, rightPct - leftPct);
                                        return (
                                            <div key={`track-${v.id}`} className="absolute top-0 bottom-0 opacity-90 transition-none border-x-2 border-white flex items-center justify-center shadow-sm" style={{ left: `${leftPct}%`, width: `${width}%`, backgroundColor: v.color }}>
                                                <span className="text-white text-xs font-bold drop-shadow-md">v{v.version}</span>

                                                {/* Drag Handles inside the block but accessible */}
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/20 flex flex-col justify-center items-center opacity-0 hover:opacity-100 group-hover:opacity-50 transition-opacity z-20"
                                                    onMouseDown={(e) => { e.stopPropagation(); setDragging({ id: v.id, side: 'validFrom', startX: e.clientX, initFrom: v.validFrom, initTo: v.validTo }); }}
                                                >
                                                </div>
                                                <div
                                                    className="absolute left-3 right-3 top-0 bottom-0 cursor-grab active:cursor-grabbing z-10"
                                                    onMouseDown={(e) => { e.stopPropagation(); setDragging({ id: v.id, side: 'both', startX: e.clientX, initFrom: v.validFrom, initTo: v.validTo }); }}
                                                >
                                                </div>
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/20 flex flex-col justify-center items-center opacity-0 hover:opacity-100 group-hover:opacity-50 transition-opacity z-20"
                                                    onMouseDown={(e) => { e.stopPropagation(); setDragging({ id: v.id, side: 'validTo', startX: e.clientX, initFrom: v.validFrom, initTo: v.validTo }); }}
                                                >
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Today Marker */}
                                {todayPct > 0 && todayPct < 100 && (
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none" style={{ left: `${todayPct}%` }}>
                                        <div className="absolute -top-6 -translate-x-1/2 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">Today</div>
                                    </div>
                                )}

                                {/* Form overlay per version */}
                                {activeTimelineVersions.map(v => {
                                    const leftPct = timeToPosition(v.validFrom, false);
                                    const rightPct = timeToPosition(v.validTo, true);
                                    const width = Math.max(0, rightPct - leftPct);
                                    return (
                                        <div key={`handles-${v.id}`} className="absolute h-16 pointer-events-none z-20 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${Math.max(0, leftPct - 1)}%`, width: `${Math.min(100, width + 2)}%` }}>
                                            <input type="date" className="-mt-8 text-[11px] h-[22px] pointer-events-auto border-gray-300 rounded shadow-sm opacity-90 origin-top-left -ml-2" value={v.validFrom ? new Date(v.validFrom).toISOString().slice(0, 10) : ''} onChange={e => updateVersionDate(v.id, 'validFrom', e.target.value)} />
                                            <input type="date" className="-mt-8 text-[11px] h-[22px] pointer-events-auto border-gray-300 rounded shadow-sm opacity-90 origin-top-right -mr-2" value={v.validTo ? new Date(v.validTo).toISOString().slice(0, 10) : ''} onChange={e => { updateVersionDate(v.id, 'validTo', e.target.value); if (!e.target.value) updateVersionDate(v.id, 'validTo', null); }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Version List */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-4">All Versions</h3>
                        <div className="bg-white border text-sm border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-3">Version</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Timeline Constraints</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {versions.sort((a, b) => b.version - a.version).map(v => {
                                        const isInTimeline = v.isTimeBased && (v.validFrom || v.validTo);
                                        return (
                                            <tr key={v.id} className="border-b last:border-0 border-gray-100 hover:bg-gray-50">
                                                <td className="p-3 font-semibold text-gray-900 flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.color }}></div>
                                                    v{v.version}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${v.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{v.status}</span>
                                                </td>
                                                <td className="p-3 text-gray-600">
                                                    {isInTimeline ? (
                                                        <div className="flex items-center gap-1 group">
                                                            <input
                                                                type="date"
                                                                className="text-xs font-mono bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-300 focus:bg-white rounded px-1 py-1"
                                                                value={v.validFrom ? new Date(v.validFrom).toISOString().slice(0, 10) : ''}
                                                                onChange={e => updateVersionDate(v.id, 'validFrom', e.target.value)}
                                                            />
                                                            <span className="text-gray-400">&rarr;</span>
                                                            {v.validTo ? (
                                                                <>
                                                                    <input
                                                                        type="date"
                                                                        className="text-xs font-mono bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-300 focus:bg-white rounded px-1 py-1"
                                                                        value={new Date(v.validTo).toISOString().slice(0, 10)}
                                                                        onChange={e => updateVersionDate(v.id, 'validTo', e.target.value)}
                                                                    />
                                                                    <button onClick={() => updateVersionDate(v.id, 'validTo', null)} className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={() => updateVersionDate(v.id, 'validTo', new Date().toISOString())}
                                                                    className="text-xs font-mono bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-1 ml-1"
                                                                >
                                                                    ∞ (Set End)
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic font-medium">Unlinked</span>
                                                    )}
                                                </td>
                                                <td className="p-3 flex items-center justify-end gap-1">
                                                    {isInTimeline ? (
                                                        <button onClick={() => removeFromTimeline(v.id)} title="Remove from timeline" className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"><MinusCircle size={16} /></button>
                                                    ) : (
                                                        <button onClick={() => addToTimeline(v.id)} title="Add to timeline" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Plus size={16} /></button>
                                                    )}
                                                    <button onClick={() => handleEdit(v.version)} title="Edit Version" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                                    <button onClick={() => deleteVersion(v.id)} disabled={isInTimeline} title={isInTimeline ? "Remove from timeline first" : "Delete Version completely"} className={`p-1.5 rounded ${isInTimeline ? 'text-gray-300' : 'text-red-600 hover:bg-red-50 cursor-pointer'}`}><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3 z-10 pointer-events-auto">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"><Save size={18} /> Apply Changes</button>
                </div>
            </div>
        </div>
    );
};
export default VersionTimelineManager;
