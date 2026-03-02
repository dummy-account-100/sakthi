import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader, AlertTriangle, CheckCircle, Save, X, ChevronDown } from 'lucide-react';

const API = process.env.REACT_APP_API_URL;
const DISA_MACHINES = ['DISA-I', 'DISA-II'];

// ─────────────────────────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => {
    useEffect(() => {
        if (msg) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }
    }, [msg, onClose]);
    if (!msg) return null;
    const colors = {
        loading: 'bg-[#ff9100]/10 border-[#ff9100]/40 text-[#ff9100]',
        success: 'bg-green-500/10 border-green-500/30 text-green-300',
        error: 'bg-red-500/10 border-red-500/30 text-red-300',
    };
    const Icon = type === 'loading' ? Loader : type === 'success' ? CheckCircle : AlertTriangle;
    return (
        <div className="fixed top-6 right-6 z-[300]">
            <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl ${colors[type]}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${type === 'loading' ? 'animate-spin' : ''}`} />
                <span className="text-sm font-bold">{msg}</span>
                {type !== 'loading' && <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>}
            </div>
        </div>
    );
};

const Field = ({ label, value, onChange, type = 'text', options, disabled }) => (
    <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</label>
        {options ? (
            <div className="relative">
                <select
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full bg-[#222] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff9100] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="">— Select —</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
        ) : (
            <input
                type={type}
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                className="w-full bg-[#222] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff9100] disabled:opacity-50 disabled:cursor-not-allowed"
            />
        )}
    </div>
);

const SectionHeader = ({ title }) => (
    <div className="col-span-full mt-4 mb-1 pb-1 border-b border-white/10">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#ff9100]">{title}</h3>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  FORM EDITORS
// ─────────────────────────────────────────────────────────────────────────────

/* 1. UNPOURED MOULD DETAILS */
const UnpouredEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/unpoured-moulds/details`, { params: { date, disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setShiftField = (shift, field, val) =>
        setData(prev => ({ ...prev, [shift]: { ...prev[shift], [field]: val } }));
    const setCustom = (shift, colId, val) =>
        setData(prev => ({
            ...prev,
            [shift]: { ...prev[shift], customValues: { ...(prev[shift]?.customValues || {}), [colId]: val } }
        }));

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await axios.post(`${API}/api/unpoured-moulds/save`, { date, disa, shiftsData: data });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data) return <NoData />;

    const FIELDS = ['patternChange', 'heatCodeChange', 'mouldBroken', 'amcCleaning', 'mouldCrush', 'coreFalling',
        'sandDelay', 'drySand', 'nozzleChange', 'nozzleLeakage', 'spoutPocking', 'stRod', 'qcVent', 'outMould',
        'lowMg', 'gradeChange', 'msiProblem', 'brakeDown', 'wom', 'devTrail', 'powerCut', 'plannedOff', 'vatCleaning', 'others', 'rowTotal'];

    return (
        <div className="space-y-6">
            {[1, 2, 3].map(shift => (
                <div key={shift} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <h3 className="text-base font-black text-[#ff9100] uppercase tracking-wider mb-3">Shift {shift}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {FIELDS.map(f => (
                            <Field key={f} label={f.replace(/([A-Z])/g, ' $1')} value={data[shift]?.[f.charAt(0).toUpperCase() + f.slice(1)] ?? data[shift]?.[f] ?? ''}
                                onChange={val => setShiftField(shift, f, val)} type="number" />
                        ))}
                        {data[shift]?.customValues && Object.entries(data[shift].customValues).map(([colId, val]) => (
                            <Field key={colId} label={`Custom ${colId}`} value={val}
                                onChange={v => setCustom(shift, colId, v)} type="number" />
                        ))}
                    </div>
                </div>
            ))}
            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 2. DMM SETTING PARAMETERS */
const DmmEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/dmm-settings/details`, { params: { date, disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setRow = (shift, rowIdx, field, val) =>
        setData(prev => {
            const rows = [...(prev.shiftsData[shift] || [])];
            rows[rowIdx] = { ...rows[rowIdx], [field]: val };
            return { ...prev, shiftsData: { ...prev.shiftsData, [shift]: rows } };
        });

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await axios.post(`${API}/api/dmm-settings/save`, { date, disa, shiftsData: data.shiftsData, shiftsMeta: data.shiftsMeta });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data) return <NoData />;

    const BASE_COLS = ['Customer', 'ItemDescription', 'Time', 'PpThickness', 'PpHeight', 'SpThickness', 'SpHeight',
        'CoreMaskOut', 'CoreMaskIn', 'SandShotPressure', 'CorrectionShotTime', 'SqueezePressure',
        'PpStripAccel', 'PpStripDist', 'SpStripAccel', 'SpStripDist', 'MouldThickness', 'CloseUpForce', 'Remarks'];

    return (
        <div className="space-y-6">
            {[1, 2, 3].map(shift => (
                <div key={shift} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <h3 className="text-base font-black text-[#ff9100] uppercase tracking-wider mb-3">Shift {shift}</h3>
                    {(data.shiftsData[shift] || []).map((row, ri) => (
                        <div key={ri} className="mb-4 border border-white/5 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-white/30 uppercase mb-2">Row {ri + 1}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {BASE_COLS.map(col => (
                                    <Field key={col} label={col.replace(/([A-Z])/g, ' $1')} value={row[col] || ''}
                                        onChange={val => setRow(shift, ri, col, val)} />
                                ))}
                                {row.customValues && Object.entries(row.customValues).map(([cId, cv]) => (
                                    <Field key={cId} label={`Custom ${cId}`} value={cv || ''}
                                        onChange={v => setRow(shift, ri, 'customValues', { ...row.customValues, [cId]: v })} />
                                ))}
                            </div>
                        </div>
                    ))}
                    {(!data.shiftsData[shift] || data.shiftsData[shift].length === 0) &&
                        <p className="text-white/30 text-sm italic">No rows for this shift.</p>}
                </div>
            ))}
            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 3. DISA OPERATOR CHECKLIST */
const DisaChecklistEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/disa-checklist/details`, { params: { date, disaMachine: disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setItem = (idx, field, val) =>
        setData(prev => {
            const cl = [...prev.checklist];
            cl[idx] = { ...cl[idx], [field]: val };
            return { ...prev, checklist: cl };
        });

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await axios.post(`${API}/api/disa-checklist/submit-batch`, {
                items: data.checklist, sign: data.checklist[0]?.AssignedHOD || '',
                date, disaMachine: disa, operatorSignature: data.checklist[0]?.OperatorSignature || ''
            });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data) return <NoData />;

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm text-white">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="p-3 text-left text-[10px] uppercase tracking-widest text-white/50">Sl No</th>
                            <th className="p-3 text-left text-[10px] uppercase tracking-widest text-white/50">Checkpoint</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50">Done</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50">Holiday</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Reading</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data.checklist || []).map((item, i) => (
                            <tr key={item.MasterId} className="border-t border-white/5 hover:bg-white/5">
                                <td className="p-3 text-white/50">{item.SlNo}</td>
                                <td className="p-3">{item.CheckPointDesc}</td>
                                <td className="p-3 text-center">
                                    <input type="checkbox" checked={!!item.IsDone}
                                        onChange={e => setItem(i, 'IsDone', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 accent-[#ff9100]" />
                                </td>
                                <td className="p-3 text-center">
                                    <input type="checkbox" checked={!!item.IsHoliday}
                                        onChange={e => setItem(i, 'IsHoliday', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 accent-[#ff9100]" />
                                </td>
                                <td className="p-3">
                                    <input type="text" value={item.ReadingValue || ''}
                                        onChange={e => setItem(i, 'ReadingValue', e.target.value)}
                                        className="w-32 bg-[#222] border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff9100]" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 4. ERROR PROOF VERIFICATION */
const ErrorProofEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/error-proof/details-by-date`, { params: { date, machine: disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setVer = (idx, field, val) =>
        setData(prev => {
            const v = [...prev.verifications];
            v[idx] = { ...v[idx], [field]: val };
            return { ...prev, verifications: v };
        });

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            const first = data.verifications[0] || {};
            await axios.post(`${API}/api/error-proof/save`, {
                machine: disa,
                verifications: data.verifications,
                reactionPlans: data.reactionPlans || [],
                headerDetails: { reviewedBy: first.ReviewedByHOF || '', approvedBy: first.ApprovedBy || '', assignedHOF: first.AssignedHOF || '' },
                operatorSignature: first.OperatorSignature || ''
            });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.verifications?.length === 0) return <NoData msg="No error proof records for this date and machine." />;

    const RESULTS = ['', 'OK', 'NOT OK'];

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm text-white">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="p-3 text-left text-[10px] uppercase tracking-widest text-white/50">Error Proof Name</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Nature</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Freq</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Shift 1</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Shift 2</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Shift 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.verifications.map((v, i) => (
                            <tr key={v.Id} className="border-t border-white/5 hover:bg-white/5">
                                <td className="p-3">{v.ErrorProofName}</td>
                                <td className="p-3">{v.NatureOfErrorProof}</td>
                                <td className="p-3 text-center">{v.Frequency}</td>
                                {['Date1_Shift1_Res', 'Date1_Shift2_Res', 'Date1_Shift3_Res'].map(field => (
                                    <td key={field} className="p-3">
                                        <select value={v[field] || ''} onChange={e => setVer(i, field, e.target.value)}
                                            className="bg-[#333] border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff9100]">
                                            {RESULTS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
                                        </select>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 5. DISA SETTING ADJUSTMENT */
const DisaSettingEditor = ({ date, toast, setToast }) => {
    const [records, setRecords] = useState([]);
    const [customCols, setCustomCols] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/disa/records`, { params: { fromDate: date, toDate: date } })
            .then(r => {
                const arr = Array.isArray(r.data) ? r.data : [];
                setRecords(arr);
                return axios.get(`${API}/api/disa/custom-columns`);
            })
            .then(r => setCustomCols(r.data || []))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date]);

    const setField = (idx, field, val) =>
        setRecords(prev => { const r = [...prev]; r[idx] = { ...r[idx], [field]: val }; return r; });
    const setCustom = (idx, colId, val) =>
        setRecords(prev => {
            const r = [...prev];
            r[idx] = { ...r[idx], customValues: { ...(r[idx].customValues || {}), [colId]: val } };
            return r;
        });

    const handleSaveRow = async (rec) => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await axios.put(`${API}/api/disa/records/${rec.id}`, rec);
            setToast({ msg: 'Record updated!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (records.length === 0) return <NoData msg="No DISA Setting Adjustment records for this date." />;

    return (
        <div className="space-y-6">
            {records.map((rec, idx) => (
                <div key={rec.id} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] font-black text-white/30 uppercase mb-3">Record #{rec.id}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <Field label="Mould Count No" value={rec.mouldCountNo} onChange={v => setField(idx, 'mouldCountNo', v)} />
                        <Field label="Prev Mould Count No" value={rec.prevMouldCountNo} onChange={v => setField(idx, 'prevMouldCountNo', v)} />
                        <Field label="No of Moulds" value={rec.noOfMoulds} onChange={v => setField(idx, 'noOfMoulds', v)} type="number" />
                        <SectionHeader title="Work Details" />
                        <div className="col-span-2">
                            <Field label="Work Carried Out" value={rec.workCarriedOut} onChange={v => setField(idx, 'workCarriedOut', v)} />
                        </div>
                        <div className="col-span-2">
                            <Field label="Preventive Work" value={rec.preventiveWorkCarried} onChange={v => setField(idx, 'preventiveWorkCarried', v)} />
                        </div>
                        <div className="col-span-2">
                            <Field label="Remarks" value={rec.remarks} onChange={v => setField(idx, 'remarks', v)} />
                        </div>
                        {customCols.map(col => (
                            <Field key={col.id} label={col.columnName}
                                value={rec.customValues?.[col.id] || ''}
                                onChange={v => setCustom(idx, col.id, v)} />
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button onClick={() => handleSaveRow(rec)}
                            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-colors shadow-lg">
                            <Save size={13} /> Save Record
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* 6. 4M CHANGE MONITORING */
const FourMEditor = ({ date, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/4m-change/records-by-date`, { params: { date } })
            .then(r => {
                // If empty array returned (no records)
                if (Array.isArray(r.data)) {
                    setData({ records: [], customColumns: [] });
                } else {
                    setData(r.data);
                }
            })
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date]);

    const setField = (idx, field, val) =>
        setData(prev => {
            const r = [...prev.records];
            r[idx] = { ...r[idx], [field]: val };
            return { ...prev, records: r };
        });

    const handleSaveRow = async (rec) => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await axios.put(`${API}/api/4m-change/records/${rec.id}`, rec);
            setToast({ msg: 'Row saved!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.records.length === 0) return <NoData msg="No 4M Monitoring records found for this date." />;

    const FIELDS_4M = [
        { key: 'line', label: 'Line' }, { key: 'partName', label: 'Part Name' },
        { key: 'shift', label: 'Shift', options: ['Shift 1', 'Shift 2', 'Shift 3'] },
        { key: 'mcNo', label: 'M/C No' }, { key: 'type4M', label: 'Type of 4M' },
        { key: 'description', label: 'Description' }, { key: 'firstPart', label: 'First Part' },
        { key: 'lastPart', label: 'Last Part' }, { key: 'inspFreq', label: 'Insp Freq' },
        { key: 'retroChecking', label: 'Retro Checking', options: ['OK', 'Not OK', '-'] },
        { key: 'quarantine', label: 'Quarantine', options: ['OK', 'Not OK', '-'] },
        { key: 'partId', label: 'Part Ident', options: ['OK', 'Not OK', '-'] },
        { key: 'internalComm', label: 'Internal Comm', options: ['OK', 'Not OK', '-'] },
        { key: 'inchargeSign', label: 'Incharge Sign' }, { key: 'assignedHOD', label: 'Assigned HOD' },
    ];

    return (
        <div className="space-y-6">
            {data.records.map((rec, idx) => (
                <div key={rec.id} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] font-black text-white/30 uppercase mb-3">Record #{rec.id}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {FIELDS_4M.map(f => (
                            <Field key={f.key} label={f.label} value={rec[f.key] || ''}
                                options={f.options}
                                onChange={v => setField(idx, f.key, v)} />
                        ))}
                        {(data.customColumns || []).map(col => (
                            <Field key={col.id} label={col.columnName}
                                value={rec.customValues?.[col.id] || ''}
                                onChange={v => {
                                    const r = [...data.records];
                                    r[idx] = { ...r[idx], customValues: { ...r[idx].customValues, [col.id]: v } };
                                    setData(p => ({ ...p, records: r }));
                                }} />
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button onClick={() => handleSaveRow(rec)}
                            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-colors shadow-lg">
                            <Save size={13} /> Save Row
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* 7. LPA – Bottom Level Audit */
const LpaEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API}/api/bottom-level-audit/details`, { params: { date, disaMachine: disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setItem = (idx, field, val) =>
        setData(prev => {
            const cl = [...prev.checklist];
            cl[idx] = { ...cl[idx], [field]: val };
            return { ...prev, checklist: cl };
        });

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await axios.post(`${API}/api/bottom-level-audit/submit-batch`, {
                items: data.checklist, sign: data.checklist[0]?.AssignedHOD || '',
                date, disaMachine: disa, operatorSignature: data.checklist[0]?.OperatorSignature || ''
            });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data) return <NoData />;

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm text-white">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="p-3 text-left text-[10px] uppercase tracking-widest text-white/50">Sl No</th>
                            <th className="p-3 text-left text-[10px] uppercase tracking-widest text-white/50">Checkpoint</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50">Done</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50">Holiday</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Reading</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data.checklist || []).map((item, i) => (
                            <tr key={item.MasterId} className="border-t border-white/5 hover:bg-white/5">
                                <td className="p-3 text-white/50">{item.SlNo}</td>
                                <td className="p-3">{item.CheckPointDesc}</td>
                                <td className="p-3 text-center">
                                    <input type="checkbox" checked={!!item.IsDone}
                                        onChange={e => setItem(i, 'IsDone', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 accent-[#ff9100]" />
                                </td>
                                <td className="p-3 text-center">
                                    <input type="checkbox" checked={!!item.IsHoliday}
                                        onChange={e => setItem(i, 'IsHoliday', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 accent-[#ff9100]" />
                                </td>
                                <td className="p-3">
                                    <input type="text" value={item.ReadingValue || ''}
                                        onChange={e => setItem(i, 'ReadingValue', e.target.value)}
                                        className="w-32 bg-[#222] border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff9100]" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <SaveButton onClick={handleSave} />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────
const CenteredLoader = () => (
    <div className="flex justify-center items-center py-20">
        <Loader className="animate-spin text-[#ff9100] w-10 h-10" />
    </div>
);

const NoData = ({ msg = "No records found for the selected date." }) => (
    <div className="flex flex-col items-center justify-center py-20 text-white/30">
        <AlertTriangle className="w-10 h-10 mb-3" />
        <p className="text-sm font-bold">{msg}</p>
    </div>
);

const SaveButton = ({ onClick }) => (
    <div className="flex justify-end pt-2">
        <button onClick={onClick}
            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-black text-sm uppercase tracking-wider px-6 py-3 rounded-xl transition-colors shadow-[0_0_20px_rgba(255,145,0,0.3)] active:scale-95">
            <Save size={16} /> Save All Changes
        </button>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  NEEDS-MACHINE forms
// ─────────────────────────────────────────────────────────────────────────────
const NEEDS_MACHINE = ['unpoured-mould-details', 'dmm-setting-parameters', 'disa-operator', 'error-proof', 'lpa'];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
const AdminFormEditor = ({ form, date, onBack }) => {
    const [selectedMachine, setSelectedMachine] = useState('');
    const [machineConfirmed, setMachineConfirmed] = useState(false);
    const [toast, setToast] = useState({ msg: '', type: 'success' });

    const needsMachine = NEEDS_MACHINE.includes(form.id);
    const ready = !needsMachine || machineConfirmed;

    const renderEditor = () => {
        const props = { date, disa: selectedMachine, toast, setToast };
        switch (form.id) {
            case 'unpoured-mould-details': return <UnpouredEditor {...props} />;
            case 'dmm-setting-parameters': return <DmmEditor {...props} />;
            case 'disa-operator': return <DisaChecklistEditor {...props} />;
            case 'error-proof': return <ErrorProofEditor {...props} />;
            case 'disa-setting-adjustment': return <DisaSettingEditor date={date} toast={toast} setToast={setToast} />;
            case '4m-change': return <FourMEditor date={date} toast={toast} setToast={setToast} />;
            case 'lpa': return <LpaEditor {...props} />;
            default: return (
                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                    <AlertTriangle className="w-10 h-10 mb-3" />
                    <p className="text-sm font-bold">Editor not available for this form type.</p>
                </div>
            );
        }
    };

    return (
        <div className="relative w-full min-h-screen bg-[#2d2d2d] font-sans">
            <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: toast.type })} />

            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#2d2d2d]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center gap-4">
                <button onClick={onBack}
                    className="flex items-center gap-2 text-[#ff9100] font-bold uppercase tracking-wider text-xs hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:border-[#ff9100]/50">
                    ← Back
                </button>
                <div>
                    <h1 className="text-lg font-black text-white uppercase tracking-wide leading-tight">{form.name}</h1>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                        Admin Edit · {date}{ready && needsMachine ? ` · ${selectedMachine}` : ''}
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Machine selector step */}
                {needsMachine && !machineConfirmed && (
                    <div className="flex flex-col items-center justify-center py-20 gap-6">
                        <p className="text-white/60 text-sm font-bold uppercase tracking-wider">Select DISA Machine for this form</p>
                        <div className="flex gap-4">
                            {DISA_MACHINES.map(m => (
                                <button key={m}
                                    onClick={() => setSelectedMachine(m)}
                                    className={`px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider border-2 transition-all ${selectedMachine === m
                                            ? 'bg-[#ff9100] border-[#ff9100] text-white'
                                            : 'bg-[#2a2a2a] border-white/10 text-white/60 hover:border-[#ff9100]/50'
                                        }`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                        <button
                            disabled={!selectedMachine}
                            onClick={() => setMachineConfirmed(true)}
                            className="mt-2 bg-[#ff9100] hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider px-8 py-3 rounded-xl transition-colors shadow-lg">
                            Load Data
                        </button>
                    </div>
                )}

                {/* Form editor content */}
                {ready && renderEditor()}
            </div>
        </div>
    );
};

export default AdminFormEditor;
