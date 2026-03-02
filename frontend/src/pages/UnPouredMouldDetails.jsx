import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Save, Loader, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';

const NotificationModal = ({ data, onClose }) => {
  if (!data.show) return null;
  const isError = data.type === 'error';
  const isLoading = data.type === 'loading';
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`border-2 w-full max-w-md p-6 rounded-2xl shadow-2xl bg-white ${isError ? 'border-red-200' : 'border-green-200'}`}>
        <div className="flex items-center gap-4">
          {isLoading ? <Loader className="animate-spin text-blue-600" /> : isError ? <AlertTriangle className="text-red-600" /> : <CheckCircle className="text-green-600" />}
          <div>
            <h3 className="font-bold text-lg">{isLoading ? 'Processing...' : isError ? 'Error' : 'Success'}</h3>
            <p className="text-sm text-gray-600">{data.message}</p>
          </div>
        </div>
        {!isLoading && <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded text-sm font-bold float-right">Close</button>}
      </div>
    </div>
  );
};

const getShiftDate = () => {
  const now = new Date();
  if (now.getHours() < 7) now.setDate(now.getDate() - 1);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const baseColumns = [
  { key: 'patternChange', label: 'PATTERN\nCHANGE', group: 'MOULDING' },
  { key: 'heatCodeChange', label: 'HEAT CODE\nCHANGE', group: 'MOULDING' },
  { key: 'mouldBroken', label: 'MOULD\nBROKEN', group: 'MOULDING' },
  { key: 'amcCleaning', label: 'AMC\nCLEANING', group: 'MOULDING' },
  { key: 'mouldCrush', label: 'MOULD\nCRUSH', group: 'MOULDING' },
  { key: 'coreFalling', label: 'CORE\nFALLING', group: 'MOULDING' },
  { key: 'sandDelay', label: 'SAND\nDELAY', group: 'SAND PLANT' },
  { key: 'drySand', label: 'DRY\nSAND', group: 'SAND PLANT' },
  { key: 'nozzleChange', label: 'NOZZLE\nCHANGE', group: 'PREESPOUR' },
  { key: 'nozzleLeakage', label: 'NOZZLE\nLEAKAGE', group: 'PREESPOUR' },
  { key: 'spoutPocking', label: 'SPOUT\nPOCKING', group: 'PREESPOUR' },
  { key: 'stRod', label: 'ST\nROD', group: 'PREESPOUR' },
  { key: 'qcVent', label: 'QC\nVENT', group: 'QUALITY CONTROL' },
  { key: 'outMould', label: 'OUT\nMOULD', group: 'QUALITY CONTROL' },
  { key: 'lowMg', label: 'LOW\nMG', group: 'QUALITY CONTROL' },
  { key: 'gradeChange', label: 'GRADE\nCHANGE', group: 'QUALITY CONTROL' },
  { key: 'msiProblem', label: 'MSI\nPROBLEM', group: 'QUALITY CONTROL' },
  { key: 'brakeDown', label: 'BRAKE\nDOWN', group: 'MAINTENANCE' },
  { key: 'wom', label: 'WOM', group: 'FURNACE' },
  { key: 'devTrail', label: 'DEV\nTRAIL', group: 'TOOLING' },
  { key: 'powerCut', label: 'POWER\nCUT', group: 'OTHERS' },
  { key: 'plannedOff', label: 'PLANNED\nOFF', group: 'OTHERS' },
  { key: 'vatCleaning', label: 'VAT\nCLEANING', group: 'OTHERS' },
  { key: 'others', label: 'OTHERS', group: 'OTHERS' }
];

const UnPouredMouldDetails = () => {
  const [headerData, setHeaderData] = useState({ date: getShiftDate(), disaMachine: 'DISA - I' });
  const [shiftsData, setShiftsData] = useState({ 1: {}, 2: {}, 3: {} });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // 🔥 Dynamic Columns Setup
  const [allColumns, setAllColumns] = useState([...baseColumns]);

  const sigRefs = { 1: useRef(null), 2: useRef(null), 3: useRef(null) };

  useEffect(() => { loadSchemaAndData(); }, [headerData.date, headerData.disaMachine]);

  const loadSchemaAndData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Dynamic Master Columns
      const configRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/config/unpoured-mould-details/master`);
      const customCols = (configRes.data.config || []).map(c => ({
        key: `custom_${c.id}`,
        id: c.id,
        label: c.reasonName.toUpperCase().replace(' ', '\n'),
        group: c.department.toUpperCase(),
        isCustom: true
      }));

      const mergedColumns = [...baseColumns, ...customCols];
      setAllColumns(mergedColumns);

      // 2. Fetch Shift Data
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/unpoured-moulds/details`, {
        params: { date: headerData.date, disa: headerData.disaMachine }
      });

      const loadedData = { 1: { customValues: {} }, 2: { customValues: {} }, 3: { customValues: {} } };

      [1, 2, 3].forEach(shift => {
        mergedColumns.forEach(col => {
          if (col.isCustom) {
            loadedData[shift].customValues[col.id] = res.data[shift]?.customValues?.[col.id] || '';
          } else {
            loadedData[shift][col.key] = res.data[shift]?.[col.key.charAt(0).toUpperCase() + col.key.slice(1)] || '';
          }
        });

        loadedData[shift].operatorSignature = res.data[shift]?.OperatorSignature || '';

        if (loadedData[shift].operatorSignature && sigRefs[shift].current) {
          sigRefs[shift].current.fromDataURL(loadedData[shift].operatorSignature);
        } else if (sigRefs[shift].current) {
          sigRefs[shift].current.clear();
        }
      });

      setShiftsData(loadedData);
    } catch (error) {
      setNotification({ show: true, type: 'error', message: "Failed to load data." });
    }
    setLoading(false);
  };

  const handleInputChange = (shift, key, value, isCustom = false, colId = null) => {
    setShiftsData(prev => {
      const newShift = { ...prev[shift] };
      if (isCustom) {
        newShift.customValues = { ...newShift.customValues, [colId]: value };
      } else {
        newShift[key] = value;
      }
      return { ...prev, [shift]: newShift };
    });
  };

  const clearSignature = (shift) => {
    if (sigRefs[shift].current) {
      sigRefs[shift].current.clear();
      handleInputChange(shift, 'operatorSignature', '');
    }
  };

  const getRowTotal = (shift) => {
    let sum = 0;
    allColumns.forEach(col => {
      if (col.isCustom) sum += (parseInt(shiftsData[shift].customValues?.[col.id]) || 0);
      else sum += (parseInt(shiftsData[shift]?.[col.key]) || 0);
    });
    return sum;
  };

  const getColTotal = (col) => {
    return [1, 2, 3].reduce((sum, shift) => {
      if (col.isCustom) return sum + (parseInt(shiftsData[shift].customValues?.[col.id]) || 0);
      return sum + (parseInt(shiftsData[shift]?.[col.key]) || 0);
    }, 0);
  };

  const getGrandTotal = () => [1, 2, 3].reduce((sum, shift) => sum + getRowTotal(shift), 0);

  const handleSave = async () => {
    setLoading(true);
    const payloadData = { ...shiftsData };

    [1, 2, 3].forEach(s => {
      payloadData[s].rowTotal = getRowTotal(s);
      payloadData[s].operatorSignature = (sigRefs[s].current && !sigRefs[s].current.isEmpty())
        ? sigRefs[s].current.getCanvas().toDataURL('image/png') : '';
    });

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/unpoured-moulds/save`, {
        date: headerData.date, disa: headerData.disaMachine, shiftsData: payloadData
      });
      setNotification({ show: true, type: 'success', message: 'Data Saved Successfully!' });
      setTimeout(() => setNotification({ show: false }), 3000);
    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Failed to save data.' });
    }
    setLoading(false);
  };

  const generatePDF = () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text("UN POURED MOULD DETAILS", 148.5, 15, { align: 'center' });
      doc.setFontSize(11); doc.text(` ${headerData.disaMachine}`, 8, 25);
      const formattedDate = new Date(headerData.date).toLocaleDateString('en-GB');
      doc.text(`DATE: ${formattedDate}`, 289 - doc.getTextWidth(`DATE: ${formattedDate}`) - 8, 25);

      // Dynamically group headers for PDF
      const headRow1 = [{ content: 'SHIFT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }];
      let currentGroup = null; let groupSpan = 0;
      allColumns.forEach((col) => {
        if (!currentGroup) { currentGroup = col.group; groupSpan = 1; }
        else if (currentGroup === col.group) { groupSpan++; }
        else {
          headRow1.push({ content: currentGroup, colSpan: groupSpan, styles: { halign: 'center' } });
          currentGroup = col.group; groupSpan = 1;
        }
      });
      if (currentGroup) headRow1.push({ content: currentGroup, colSpan: groupSpan, styles: { halign: 'center' } });
      headRow1.push({ content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [220, 220, 220] } });

      const headRow2 = allColumns.map(col => ({ content: col.label, styles: { halign: 'center', valign: 'middle', fontSize: 5.5 } }));

      const bodyRows = [1, 2, 3].map(shift => {
        const row = [shift.toString()];
        allColumns.forEach(col => {
          const val = col.isCustom ? shiftsData[shift].customValues[col.id] : shiftsData[shift][col.key];
          row.push(val === '' || val === null || val === undefined ? '-' : val.toString());
        });
        const rowTotal = getRowTotal(shift);
        row.push(rowTotal === 0 ? '-' : rowTotal.toString());
        return row;
      });

      const totalRow = ['TOTAL'];
      allColumns.forEach(col => {
        const colTotal = getColTotal(col);
        totalRow.push(colTotal === 0 ? '-' : colTotal.toString());
      });
      totalRow.push(getGrandTotal() === 0 ? '-' : getGrandTotal().toString());
      bodyRows.push(totalRow);

      autoTable(doc, {
        startY: 32, margin: { left: 5, right: 5 }, head: [headRow1, headRow2], body: bodyRows, theme: 'grid',
        styles: { fontSize: 8, cellPadding: { top: 3.5, right: 1, bottom: 3.5, left: 1 }, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', minCellHeight: 12 }, bodyStyles: { minCellHeight: 10 },
        didParseCell: function (data) { if (data.section === 'body' && data.row.index === bodyRows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; } }
      });

      const finalY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      const shiftLabels = { 1: "1st shift", 2: "2nd shift", 3: "3rd shift" };

      [1, 2, 3].forEach((shift) => {
        const xPos = (pageWidth * shift) / 4;
        let sig = '';
        if (sigRefs[shift].current && !sigRefs[shift].current.isEmpty()) sig = sigRefs[shift].current.getCanvas().toDataURL('image/png');
        else if (shiftsData[shift].operatorSignature) sig = shiftsData[shift].operatorSignature;

        if (sig && sig.startsWith('data:image')) {
          try { doc.addImage(sig, 'PNG', xPos - 20, finalY, 40, 20); } catch (e) { doc.setFont('helvetica', 'normal').text("Error loading signature", xPos, finalY + 12, { align: 'center' }).setFont('helvetica', 'bold'); }
        } else { doc.setFont('helvetica', 'normal').text("-", xPos, finalY + 12, { align: 'center' }).setFont('helvetica', 'bold'); }
        doc.text(shiftLabels[shift], xPos, finalY + 28, { align: 'center' });
      });

      doc.save(`UnPoured_Mould_Details_${headerData.date}.pdf`);
      setNotification({ show: false, type: '', message: '' });
    } catch (error) { setNotification({ show: true, type: 'error', message: `PDF Generation Failed: ${error.message}` }); }
  };

  // HTML Rendering Group Headers Dynamically
  const renderGroupHeaders = () => {
    const groups = [];
    let currentGroup = null;
    allColumns.forEach(col => {
      if (!currentGroup || currentGroup.name !== col.group) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { name: col.group, count: 1 };
      } else { currentGroup.count++; }
    });
    if (currentGroup) groups.push(currentGroup);

    return groups.map((g, i) => (
      <th key={i} className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan={g.count}>{g.name}</th>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center pb-24">
      <NotificationModal data={notification} onClose={() => setNotification({ ...notification, show: false })} />
      <div className="w-full max-w-[98%] bg-white shadow-xl rounded-2xl flex flex-col overflow-hidden">
        <div className="bg-gray-900 py-6 px-8 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="text-orange-500 text-2xl">📉</span> Un Poured Mould Details
          </h2>
          <div className="flex items-center gap-3">
            <select value={headerData.disaMachine} onChange={(e) => setHeaderData({ ...headerData, disaMachine: e.target.value })} className="bg-gray-800 text-white font-bold border-2 border-orange-500 rounded-md p-2 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="DISA - I">DISA - I</option><option value="DISA - II">DISA - II</option><option value="DISA - III">DISA - III</option><option value="DISA - IV">DISA - IV</option><option value="DISA - V">DISA - V</option><option value="DISA - VI">DISA - VI</option>
            </select>
            <span className="text-orange-400 text-lg font-black uppercase tracking-wider">Date:</span>
            <input type="date" value={headerData.date} onChange={(e) => setHeaderData({ ...headerData, date: e.target.value })} className="bg-white text-gray-700 font-bold border-2 border-orange-500 rounded-md px-2 py-1.5 text-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" />
          </div>
        </div>

        <div className="p-6 overflow-x-auto min-h-[400px] custom-scrollbar border-b">
          <table className="w-full text-center border-collapse table-fixed min-w-[2300px]">
            <thead className="bg-gray-100">
              <tr className="text-xs text-gray-600 uppercase border-y-2 border-orange-200">
                <th className="border border-gray-300 p-3 w-20 bg-gray-100 z-10" rowSpan="2">SHIFT</th>
                {renderGroupHeaders()}
                <th className="border border-gray-300 p-3 w-24 bg-gray-200 z-10 border-l-2 border-l-orange-300" rowSpan="2">TOTAL</th>
              </tr>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50">
                {allColumns.map((col, idx) => {
                  const isNextGroupDifferent = allColumns[idx + 1] && allColumns[idx + 1].group !== col.group;
                  const isLastInGroup = !allColumns[idx + 1] || isNextGroupDifferent;
                  return (
                    <th key={idx} className={`border border-gray-300 p-2 align-bottom whitespace-pre-wrap leading-snug w-20 ${isLastInGroup ? 'border-r-2 border-r-gray-400' : ''}`}>{col.label}</th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map(shift => (
                <tr key={shift} className="hover:bg-orange-50/30 transition-colors group h-14">
                  <td className="border border-gray-300 font-black text-gray-700 bg-gray-50 z-10 group-hover:bg-orange-50/80">{shift}</td>
                  {allColumns.map((col, idx) => {
                    const isNextGroupDifferent = allColumns[idx + 1] && allColumns[idx + 1].group !== col.group;
                    const isLastInGroup = !allColumns[idx + 1] || isNextGroupDifferent;
                    const val = col.isCustom ? shiftsData[shift].customValues?.[col.id] : shiftsData[shift][col.key];
                    return (
                      <td key={col.key} className={`border border-gray-300 p-0 relative ${isLastInGroup ? 'border-r-2 border-r-gray-400' : ''}`}>
                        <input type="number" min="0" value={val || ''} onChange={(e) => handleInputChange(shift, col.key, e.target.value, col.isCustom, col.id)} onFocus={(e) => e.target.select()} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-800 bg-transparent outline-none focus:bg-orange-100 focus:ring-inset focus:ring-2 focus:ring-orange-500 [&::-webkit-inner-spin-button]:appearance-none transition-colors" />
                      </td>
                    )
                  })}
                  <td className="border border-gray-300 font-bold text-gray-800 bg-gray-100 z-10 border-l-2 border-l-orange-300">{getRowTotal(shift) || ''}</td>
                </tr>
              ))}
              <tr className="bg-gray-200 h-14 font-black">
                <td className="border border-gray-400 text-gray-800 z-10 bg-gray-200">TOTAL</td>
                {allColumns.map((col, idx) => {
                  const isNextGroupDifferent = allColumns[idx + 1] && allColumns[idx + 1].group !== col.group;
                  const isLastInGroup = !allColumns[idx + 1] || isNextGroupDifferent;
                  return (
                    <td key={col.key} className={`border border-gray-400 text-gray-800 ${isLastInGroup ? 'border-r-2 border-r-gray-500' : ''}`}>{getColTotal(col) || ''}</td>
                  )
                })}
                <td className="border border-gray-400 text-xl text-orange-800 bg-orange-200 z-10 border-l-2 border-l-orange-400 shadow-inner">{getGrandTotal() || '0'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-8 bg-white grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(shift => (
            <div key={`sig-${shift}`} className="flex flex-col items-center">
              <h3 className="font-bold text-gray-800 mb-3">{shift === 1 ? '1st' : shift === 2 ? '2nd' : '3rd'} Shift Operator</h3>
              <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg w-full max-w-[280px]">
                <SignatureCanvas ref={sigRefs[shift]} penColor="blue" canvasProps={{ className: 'w-full h-24 cursor-crosshair rounded-lg' }} />
              </div>
              <button onClick={() => clearSignature(shift)} className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wider">Clear Signature</button>
            </div>
          ))}
        </div>

        <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 bottom-0 z-20 flex justify-end gap-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors"><FileDown size={20} /> PDF</button>
          <button onClick={handleSave} disabled={loading} className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 px-12 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">{loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}{loading ? 'Saving...' : 'Save All Shifts'}</button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default UnPouredMouldDetails;