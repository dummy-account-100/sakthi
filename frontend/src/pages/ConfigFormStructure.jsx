import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowLeft, Loader, Settings, AlertTriangle, CheckCircle } from 'lucide-react';

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

const ConfigFormStructure = () => {
    const { formId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    // Config State
    const [checkpoints, setCheckpoints] = useState([]);
    const [formTitle, setFormTitle] = useState("");

    const API_BASE_FORM_STRUCTURE = `${API_BASE}/config/${formId}`;

    useEffect(() => {
        fetchConfig();
    }, [formId]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_FORM_STRUCTURE}/master`);
            setFormTitle(formId.toUpperCase().replace('-', ' '));
            setCheckpoints(res.data.config || []);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to load master configuration or form type not supported.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        setCheckpoints([...checkpoints, {
            id: Date.now(),
            slNo: checkpoints.length + 1,
            description: '',
            method: '',
            isDeleted: false,
            isNew: true
        }]);
    };

    const handleUpdateRow = (id, field, value) => {
        setCheckpoints(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleDeleteRow = (id) => {
        setCheckpoints(prev => prev.map(item =>
            item.id === id ? { ...item, isDeleted: !item.isDeleted } : item
        ));
    };

    const handleSaveConfig = async () => {
        setSaving(true);
        setNotification({ show: true, type: 'loading', message: 'Syncing configuration with database...' });

        try {
            // Filter out permanently deleted items that were never saved
            const activeData = checkpoints.filter(c => !(c.isNew && c.isDeleted));
            await axios.post(`${API_BASE}/master`, { config: activeData });

            setNotification({ show: true, type: 'success', message: 'Form Schema Updated Successfully!' });
            setTimeout(() => navigate('/admin'), 1500);

        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to save configuration.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col font-sans relative z-[200]">
            <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

            <div className="h-1.5 bg-[#ff9100] flex-shrink-0 shadow-[0_0_15px_rgba(255,145,0,0.5)]" />

            {/* Config Header bar */}
            <div className="bg-[#222] border-b border-white/5 py-4 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/admin')} className="text-white/50 hover:text-[#ff9100] transition-colors p-2 rounded-lg hover:bg-white/5">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-[#ff9100]" />
                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Master Schema Config</span>
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-wider">{formTitle}</h1>
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

                <div className="bg-[#383838] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-black/20 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/50 uppercase tracking-widest text-center">
                        <div className="col-span-1">S.No</div>
                        <div className="col-span-7 pl-4 text-left">Checkpoint Description</div>
                        <div className="col-span-3 text-left">Check Method</div>
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
                            {checkpoints.map((cp, index) => (
                                <div key={cp.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-all ${cp.isDeleted ? 'opacity-40 bg-red-900/10' : 'hover:bg-white/5'} ${cp.isNew ? 'border-[#ff9100]/30 border-l-4' : 'border-transparent border-l-4'}`}>

                                    <div className="col-span-1 text-center font-bold text-white/50">
                                        {cp.isDeleted ? 'DEL' : index + 1}
                                    </div>

                                    <div className="col-span-7 pr-4">
                                        <textarea
                                            rows="2"
                                            disabled={cp.isDeleted}
                                            value={cp.description}
                                            onChange={(e) => handleUpdateRow(cp.id, 'description', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all resize-none disabled:cursor-not-allowed"
                                            placeholder="Enter checkpoint description..."
                                        />
                                    </div>

                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            disabled={cp.isDeleted}
                                            value={cp.method}
                                            onChange={(e) => handleUpdateRow(cp.id, 'method', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed"
                                            placeholder="e.g. Visual, Gauge"
                                        />
                                    </div>

                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => handleDeleteRow(cp.id)}
                                            className={`p-2 rounded-lg transition-colors ${cp.isDeleted ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white' : 'text-white/30 hover:bg-red-500/20 hover:text-red-500'}`}
                                            title={cp.isDeleted ? 'Restore Row' : 'Delete Row'}
                                        >
                                            <Trash2 className="w-5 h-5" />
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
                                    <Plus className="w-5 h-5" /> Add New Checkpoint
                                </button>
                            </div>

                        </div>
                    )}
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes slide-in-right { 0% { transform: translateX(100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
        </div>
    );
};

export default ConfigFormStructure;