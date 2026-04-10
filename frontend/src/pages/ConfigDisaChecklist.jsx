import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowLeft, Loader, CheckCircle, AlertTriangle, X } from 'lucide-react';


const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";
// --- Sleek Toast Notification Component ---
const ToastNotification = ({ data, onClose }) => {
    useEffect(() => {
        if (data.show && data.type !== 'loading') {
            const timer = setTimeout(onClose, 3000); // Auto close after 3s
            return () => clearTimeout(timer);
        }
    }, [data, onClose]);

    if (!data.show) return null;

    const isError = data.type === 'error';
    const isLoading = data.type === 'loading';

    return (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-right-8 ${isLoading ? 'bg-blue-50 border-l-4 border-blue-600 text-blue-800' : isError ? 'bg-red-50 border-l-4 border-red-600 text-red-800' : 'bg-green-50 border-l-4 border-green-600 text-green-800'}`}>
            {isLoading ? <Loader className="animate-spin" size={20} /> : isError ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
            <p className="font-bold text-sm">{data.message}</p>
            {!isLoading && <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100"><X size={16} /></button>}
        </div>
    );
};

const ConfigDisaChecklist = ({ onBack }) => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const API_BASE_CONFIG = `${API_BASE}/config/disa-operator`;

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_CONFIG}/master`);
            setItems(res.data.config || []);
        } catch (error) { 
            setToast({ show: true, message: 'Failed to fetch configuration.', type: 'error' });
        }
        setLoading(false);
    };

    const handleAddRow = () => {
        // We ensure new items get isDeleted: false by default
        setItems([...items, { id: Date.now(), slNo: items.length + 1, description: '', method: '', isDeleted: false, isNew: true }]);
    };

    const handleDeleteRow = (id) => {
        // Perfectly maps the soft-delete functionality so the UI hides it, but the DB updates properly
        setItems(items.map(item => item.id === id ? { ...item, isDeleted: true } : item));
    };

    const handleSave = async () => {
        setToast({ show: true, message: 'Saving changes...', type: 'loading' });
        try {
            // Safely removes items that were added and deleted in the same session, 
            // but keeps existing DB items marked as isDeleted: true for the backend to soft-delete
            const dataToSave = items.filter(c => !(c.isNew && c.isDeleted));
            
            await axios.post(`${API_BASE_CONFIG}/master`, { config: dataToSave });
            setToast({ show: true, message: 'Schema Updated Successfully!', type: 'success' });
            
            setTimeout(() => {
                if (onBack) onBack(); else navigate('/admin');
            }, 1500);
        } catch (error) { 
            setToast({ show: true, message: 'Failed to save configuration.', type: 'error' });
        }
    };

    return (
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col pb-20">
            <ToastNotification data={toast} onClose={() => setToast({ ...toast, show: false })} />
            
            <div className="h-1.5 bg-[#ff9100] shadow-[0_0_15px_rgba(255,145,0,0.5)]" />
            <div className="bg-[#222] border-b border-white/5 py-4 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="text-white/50 hover:text-[#ff9100] p-2 rounded-lg hover:bg-white/5"><ArrowLeft /></button>
                    <h1 className="text-2xl font-black text-white uppercase tracking-wider">Edit Operator Checklist Fields</h1>
                </div>
                <button onClick={handleSave} className="bg-[#ff9100] hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 uppercase text-sm">
                    <Save size={16} /> Save Changes
                </button>
            </div>
            
            <div className="max-w-5xl w-full mx-auto p-10">
                <div className="bg-[#383838] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-black/20 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-[10px] font-black text-white/50 uppercase text-center">
                        <div className="col-span-1">S.No</div>
                        <div className="col-span-7 text-left">Check Point Description</div>
                        <div className="col-span-3 text-left">Method</div>
                        <div className="col-span-1">Action</div>
                    </div>
                    
                    {loading ? <div className="p-20 text-center text-[#ff9100]"><Loader className="animate-spin inline mr-2" /> Loading...</div> : (
                        <div className="divide-y divide-white/5">
                            {/* Filter out isDeleted items so they disappear from the UI immediately */}
                            {items.filter(item => !item.isDeleted).map((cp, idx) => (
                                <div key={cp.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                                    <div className="col-span-1 text-center font-bold text-white/50">{idx + 1}</div>
                                    <div className="col-span-7">
                                        <textarea 
                                            value={cp.description} 
                                            onChange={e => setItems(items.map(i => i.id === cp.id ? {...i, description: e.target.value} : i))} 
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm" 
                                            rows="1" 
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input 
                                            value={cp.method} 
                                            onChange={e => setItems(items.map(i => i.id === cp.id ? {...i, method: e.target.value} : i))} 
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm" 
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button 
                                            onClick={() => handleDeleteRow(cp.id)} 
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                            <div className="p-4 bg-black/10">
                                <button onClick={handleAddRow} className="w-full py-4 border-2 border-dashed border-white/20 hover:border-[#ff9100] rounded-xl text-white/50 hover:text-[#ff9100] font-bold uppercase text-xs">
                                    <Plus size={16} className="inline mr-2" /> Add Check Point
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfigDisaChecklist;