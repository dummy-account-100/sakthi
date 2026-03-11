import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowLeft, Loader, Settings, AlertTriangle, CheckCircle, Lock, RotateCcw } from 'lucide-react';

const API = `${process.env.REACT_APP_API_URL}/api/4m-change`;

const NotificationToast = ({ data, onClose }) => {
    const isError = data.type === 'error';
    const isLoading = data.type === 'loading';

    React.useEffect(() => {
        if (data.show && !isLoading) {
            const timer = setTimeout(() => onClose(), 3000);
            return () => clearTimeout(timer);
        }
    }, [data.show, isLoading, onClose]);

    if (!data.show) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] animate-slide-in-right">
            <div className={`
                flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border 
                ${isError ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : isLoading ? 'bg-[#ff9100]/10 border-[#ff9100]/30 text-[#ff9100]'
                        : 'bg-green-500/10 border-green-500/30 text-green-200'}
            `}>
                <div className="flex-shrink-0">
                    {isLoading ? <Loader className="w-6 h-6 animate-spin" /> : isError ? <AlertTriangle className="w-6 h-6 text-red-500" /> : <CheckCircle className="w-6 h-6 text-green-500" />}
                </div>
                <div className="flex flex-col">
                    <h4 className="text-sm font-bold tracking-wide uppercase">
                        {isLoading ? 'Processing' : isError ? 'Error' : 'Success'}
                    </h4>
                    <p className="text-sm opacity-90">{data.message}</p>
                </div>
            </div>
        </div>
    );
};

// Accept the onBack prop here
const ConfigFourMColumns = ({ onBack }) => {
    const navigate = useNavigate();

    const [customCols, setCustomCols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    // Hardcoded permanent columns for visual context
    const permanentCols = [
        "Date / Shift", "M/c No", "Type of 4M", "Description",
        "First Part", "Last Part", "Insp. Freq", "Retro Checking",
        "Quarantine", "Part Ident.", "Internal Comm.", "Incharge Sign", "HOD Sign"
    ];

    useEffect(() => {
        loadCustomCols();
    }, []);

    const loadCustomCols = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/custom-columns`);
            const mapped = res.data.map(c => ({ ...c, isNew: false, isDeleted: false }));
            setCustomCols(mapped);
        } catch {
            setNotification({ show: true, type: 'error', message: 'Failed to load custom columns.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        setCustomCols([...customCols, { id: Date.now(), columnName: "", isNew: true, isDeleted: false }]);
    };

    const handleUpdateRow = (id, value) => {
        setCustomCols(prev => prev.map(col => col.id === id ? { ...col, columnName: value } : col));
    };

    const handleDeleteRow = (id) => {
        setCustomCols(prev => prev.map(col => col.id === id ? { ...col, isDeleted: !col.isDeleted } : col));
    };

    const handleSave = async () => {
        const hasEmptyColumns = customCols.some(c => !c.isDeleted && c.columnName.trim() === "");
        if (hasEmptyColumns) {
            setNotification({ show: true, type: 'error', message: 'Please fill in all column names, or delete empty rows.' });
            return;
        }

        setSaving(true);
        setNotification({ show: true, type: 'loading', message: 'Syncing configuration with database...' });

        try {
            const toDelete = customCols.filter(c => !c.isNew && c.isDeleted);
            const toUpdate = customCols.filter(c => !c.isNew && !c.isDeleted && c.columnName.trim() !== "");
            const toAdd = customCols.filter(c => c.isNew && !c.isDeleted && c.columnName.trim() !== "");

            const deletePromises = toDelete.map(col => axios.delete(`${API}/custom-columns/${col.id}`));
            const updatePromises = toUpdate.map(col => axios.put(`${API}/custom-columns/${col.id}`, { columnName: col.columnName }));
            const addPromises = toAdd.map(col => axios.post(`${API}/custom-columns`, { columnName: col.columnName }));

            await Promise.all([...deletePromises, ...updatePromises, ...addPromises]);

            setNotification({ show: true, type: 'success', message: 'Columns Configuration Saved!' });
            loadCustomCols();
        } catch (err) {
            setNotification({ show: true, type: 'error', message: 'Error saving columns.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col font-sans relative pb-20 w-full">
            <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

            <div className="h-1.5 bg-[#ff9100] flex-shrink-0 shadow-[0_0_15px_rgba(255,145,0,0.5)]" />

            <div className="bg-[#222] border-b border-white/5 py-4 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    {/* Fire the onBack prop if it exists, otherwise fallback to navigate */}
                    <button onClick={onBack || (() => navigate('/admin'))} className="text-white/50 hover:text-[#ff9100] transition-colors p-2 rounded-lg hover:bg-white/5">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-[#ff9100]" />
                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Master Schema Config</span>
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-wider">4M CHANGE COLUMNS</h1>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="bg-[#ff9100] hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-[0_0_15px_rgba(255,145,0,0.3)] transition-all flex items-center gap-2 uppercase text-sm disabled:opacity-50"
                >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Configuration
                </button>
            </div>

            <div className="flex-1 max-w-5xl w-full mx-auto pt-10 px-4">
                
                <div className="mb-6 bg-[#ff9100]/5 border border-[#ff9100]/20 rounded-xl p-4 text-white/60 text-sm">
                    The grid below defines the structure of the 4M Change Monitoring Sheet. The permanent columns are locked, but you can append custom columns to the end.
                </div>

                <div className="bg-[#383838] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-black/20 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/50 uppercase tracking-widest text-center">
                        <div className="col-span-1">S.No</div>
                        <div className="col-span-7 text-left pl-4">Column Name</div>
                        <div className="col-span-2">Type</div>
                        <div className="col-span-2">Action</div>
                    </div>

                    {loading ? (
                        <div className="p-10 flex justify-center items-center flex-col gap-4 text-[#ff9100]">
                            <Loader className="w-8 h-8 animate-spin" />
                            <span className="text-sm font-bold uppercase tracking-widest">Loading Columns...</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            
                            {/* PERMANENT COLUMNS */}
                            {permanentCols.map((col, idx) => (
                                <div key={`perm-${idx}`} className="grid grid-cols-12 gap-4 p-4 items-center border-l-4 border-transparent hover:bg-white/5 transition-all">
                                    <div className="col-span-1 text-center font-bold text-white/30">
                                        {idx + 1}
                                    </div>
                                    <div className="col-span-7">
                                        <input
                                            type="text"
                                            value={col}
                                            readOnly
                                            className="w-full bg-black/20 border border-white/5 rounded-lg p-3 text-white/50 text-sm cursor-not-allowed outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        <span className="bg-white/10 text-white/50 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                            Fixed
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        <Lock className="w-4 h-4 text-white/20" />
                                    </div>
                                </div>
                            ))}

                            {/* DIVIDER */}
                            <div className="grid grid-cols-12 bg-gradient-to-r from-transparent via-[#ff9100]/10 to-transparent border-y border-[#ff9100]/20 p-3">
                                <div className="col-span-12 text-center text-[10px] font-black text-[#ff9100] uppercase tracking-[0.2em]">
                                    --- Dynamic Custom Columns Below ---
                                </div>
                            </div>

                            {/* CUSTOM COLUMNS */}
                            {customCols.map((col, idx) => (
                                <div key={col.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-all ${col.isDeleted ? 'opacity-40 bg-red-900/10' : 'hover:bg-white/5'} ${col.isNew ? 'border-[#ff9100]/30 border-l-4' : 'border-transparent border-l-4'}`}>
                                    <div className="col-span-1 text-center font-bold text-white/50">
                                        {col.isDeleted ? 'DEL' : permanentCols.length + idx + 1}
                                    </div>
                                    <div className="col-span-7">
                                        <input
                                            type="text"
                                            disabled={col.isDeleted}
                                            value={col.columnName}
                                            onChange={(e) => handleUpdateRow(col.id, e.target.value)}
                                            placeholder="e.g. REMARKS 2"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed uppercase"
                                        />
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        <span className="bg-[#ff9100]/20 text-[#ff9100] px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                            Custom
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        <button
                                            onClick={() => handleDeleteRow(col.id)}
                                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider
                                                ${col.isDeleted 
                                                    ? 'bg-white/10 text-white hover:bg-white/20' 
                                                    : 'text-white/30 hover:bg-red-500/20 hover:text-red-500'}`}
                                        >
                                            {col.isDeleted ? (
                                                <><RotateCcw className="w-4 h-4" /> Undo</>
                                            ) : (
                                                <Trash2 className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="p-4 bg-black/10">
                                <button
                                    onClick={handleAddRow}
                                    className="w-full py-4 border-2 border-dashed border-white/20 hover:border-[#ff9100] rounded-xl flex items-center justify-center gap-2 text-white/50 hover:text-[#ff9100] font-bold uppercase tracking-widest text-sm transition-all"
                                >
                                    <Plus className="w-5 h-5" /> Add New Column
                                </button>
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ConfigFourMColumns;