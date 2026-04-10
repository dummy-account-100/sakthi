import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowLeft, Loader, Settings, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

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

const ConfigUnpouredMould = ({ onBack }) => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    // Config State
    const [items, setItems] = useState([]);

    const API_BASE_UNPOURED_MOULD = `${API_BASE}/config/unpoured-mould-details`;

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_UNPOURED_MOULD}/master`);
            setItems(res.data.config || []);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to load configuration.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        setItems([...items, {
            id: Date.now(),
            slNo: items.length + 1,
            department: '',
            reasonName: '',
            isDeleted: false,
            isNew: true
        }]);
    };

    const handleUpdateRow = (id, field, value) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value.toUpperCase() } : item // Force uppercase for consistency
        ));
    };

    const handleDeleteRow = (id) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, isDeleted: !item.isDeleted } : item
        ));
    };

    const handleSaveConfig = async () => {
        // Validate
        const hasEmptyFields = items.some(c => !c.isDeleted && (c.department.trim() === "" || c.reasonName.trim() === ""));
        if (hasEmptyFields) {
            setNotification({ show: true, type: 'error', message: 'Please fill all fields or delete empty rows.' });
            return;
        }

        setSaving(true);
        setNotification({ show: true, type: 'loading', message: 'Syncing configuration with database...' });

        try {
            const activeData = items.filter(c => !(c.isNew && c.isDeleted));
            await axios.post(`${API_BASE_UNPOURED_MOULD}/master`, { config: activeData });

            setNotification({ show: true, type: 'success', message: 'Form Schema Updated Successfully!' });
            await fetchConfig(); // Refresh data
            
            setTimeout(() => {
                if (onBack) onBack();
                else navigate('/admin');
            }, 1500);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to save configuration.' });
        } finally {
            setSaving(false);
        }
    };

    const goBack = () => {
        if (onBack) onBack();
        else navigate('/admin');
    };

    return (
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col font-sans relative pb-20 z-[200] w-full">
            <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

            <div className="h-1.5 bg-[#ff9100] flex-shrink-0 shadow-[0_0_15px_rgba(255,145,0,0.5)]" />

            {/* Config Header bar */}
            <div className="bg-[#222] border-b border-white/5 py-4 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={goBack} className="text-white/50 hover:text-[#ff9100] transition-colors p-2 rounded-lg hover:bg-white/5">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-[#ff9100]" />
                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Master Schema Config</span>
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-wider">UNPOURED MOULD COLUMNS</h1>
                    </div>
                </div>

                <button
                    onClick={handleSaveConfig}
                    disabled={saving || loading}
                    className="bg-[#ff9100] hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-[0_0_15px_rgba(255,145,0,0.3)] transition-all flex items-center gap-2 uppercase text-sm disabled:opacity-50"
                >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Master Config
                </button>
            </div>

            {/* Main Configuration Editor */}
            <div className="flex-1 max-w-5xl w-full mx-auto p-10">

                <div className="mb-6 bg-[#ff9100]/5 border border-[#ff9100]/20 rounded-xl p-4 text-white/60 text-sm">
                    Add custom defect reasons below. They will be dynamically added to the end of the Unpoured Mould Details table. Grouping by "Department" ensures columns are merged neatly.
                </div>

                <div className="bg-[#383838] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-black/20 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/50 uppercase tracking-widest text-center">
                        <div className="col-span-1">S.No</div>
                        <div className="col-span-4 text-left pl-2">Department Group</div>
                        <div className="col-span-6 text-left pl-2">Reason / Defect Name</div>
                        <div className="col-span-1">Action</div>
                    </div>

                    {/* Skeleton Loader */}
                    {loading ? (
                        <div className="p-10 flex justify-center items-center flex-col gap-4 text-[#ff9100]">
                            <Loader className="w-8 h-8 animate-spin" />
                            <span className="text-sm font-bold uppercase tracking-widest">Loading Master Schema...</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {items.map((cp, index) => (
                                <div key={cp.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-all ${cp.isDeleted ? 'opacity-40 bg-red-900/10' : 'hover:bg-white/5'} ${cp.isNew ? 'border-[#ff9100]/30 border-l-4' : 'border-transparent border-l-4'}`}>

                                    <div className="col-span-1 text-center font-bold text-white/50">
                                        {cp.isDeleted ? 'DEL' : index + 1}
                                    </div>

                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            disabled={cp.isDeleted}
                                            value={cp.department}
                                            onChange={(e) => handleUpdateRow(cp.id, 'department', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed uppercase font-bold"
                                            placeholder="e.g. MOULDING"
                                        />
                                    </div>

                                    <div className="col-span-6">
                                        <input
                                            type="text"
                                            disabled={cp.isDeleted}
                                            value={cp.reasonName}
                                            onChange={(e) => handleUpdateRow(cp.id, 'reasonName', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed uppercase"
                                            placeholder="e.g. PATTERN CHANGE"
                                        />
                                    </div>

                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => handleDeleteRow(cp.id)}
                                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider
                                                ${cp.isDeleted 
                                                    ? 'bg-white/10 text-white hover:bg-white/20' 
                                                    : 'text-white/30 hover:bg-red-500/20 hover:text-red-500'}`}
                                            title={cp.isDeleted ? 'Restore Row' : 'Delete Row'}
                                        >
                                            {cp.isDeleted ? <RotateCcw className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                                        </button>
                                    </div>

                                </div>
                            ))}

                            {/* Add New Row Button */}
                            <div className="p-4 bg-black/10">
                                <button
                                    onClick={handleAddRow}
                                    className="w-full py-4 border-2 border-dashed border-white/20 hover:border-[#ff9100] rounded-xl flex items-center justify-center gap-2 text-white/50 hover:text-[#ff9100] font-bold uppercase tracking-widest text-sm transition-all"
                                >
                                    <Plus className="w-5 h-5" /> Add New Row Reason
                                </button>
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ConfigUnpouredMould;