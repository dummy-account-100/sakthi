import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Header from "../components/Header";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

const MAX_MOULDS = 600000;

const getDefaultDate = () => {
  const now = new Date();
  if (now.getHours() < 7) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DISASettingAdjustment = () => {
  const [recordId, setRecordId] = useState(null); // Tracks if editing
  const [recordDate, setRecordDate] = useState(getDefaultDate());
  
  const [mouldCountNo, setMouldCountNo] = useState("");
  const [prevMouldCountNo, setPrevMouldCountNo] = useState(0);
  const [noOfMoulds, setNoOfMoulds] = useState(0);

  const [workCarriedOut, setWorkCarriedOut] = useState([""]);
  const [preventiveWorkCarried, setPreventiveWorkCarried] = useState([""]);
  const [remarks, setRemarks] = useState("");

  const [customColumns, setCustomColumns] = useState([]);
  const [customValues, setCustomValues] = useState({});

  const fetchLastMouldCount = useCallback(() => {
    axios.get(`${API_BASE}/disa/last-mould-count`)
      .then((res) => setPrevMouldCountNo(res.data.prevMouldCountNo))
      .catch((err) => console.error("Error fetching last count:", err));
  }, []);

  // 1. Fetch initial configurations on mount
  useEffect(() => {
    axios.get(`${API_BASE}/disa/custom-columns`)
      .then((res) => setCustomColumns(res.data || []))
      .catch((err) => console.error("Error fetching custom columns:", err));
  }, []);

  // 2. 🔥 CHECK EXISTING DATA WHEN DATE CHANGES
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/disa/check`, {
          params: { date: recordDate }
        });
        
        if (res.data && res.data.id) {
          // Data found -> Populate Form
          setRecordId(res.data.id);
          setMouldCountNo(res.data.mouldCountNo || "");
          setPrevMouldCountNo(res.data.prevMouldCountNo || 0);
          setNoOfMoulds(res.data.noOfMoulds || 0);
          setRemarks(res.data.remarks || "");

          // Parse bulleted strings back into arrays
          const parsedWork = res.data.workCarriedOut 
            ? res.data.workCarriedOut.split('\n').map(w => w.replace(/^•\s*/, '')) 
            : [""];
          const parsedPrev = res.data.preventiveWorkCarried 
            ? res.data.preventiveWorkCarried.split('\n').map(p => p.replace(/^•\s*/, '')) 
            : [""];

          setWorkCarriedOut(parsedWork);
          setPreventiveWorkCarried(parsedPrev);

          if (res.data.customValues) {
            setCustomValues(prev => ({ ...prev, ...res.data.customValues }));
          }
          toast.info("Loaded existing record for this date.");
        } else {
          // No Data -> Reset Form Fields
          setRecordId(null);
          setMouldCountNo("");
          fetchLastMouldCount(); // Get the actual current DB count since it's a new entry
          setWorkCarriedOut([""]);
          setPreventiveWorkCarried([""]);
          setRemarks("");
          
          const resetVals = {};
          customColumns?.forEach(col => { resetVals[col.id] = ""; });
          setCustomValues(resetVals);
        }
      } catch (err) {
        console.error("Failed to check existing data", err);
      }
    };
    
    if (recordDate) {
      fetchExistingData();
    }
  }, [recordDate, customColumns, fetchLastMouldCount]);

  // Calculate Moulds automatically when counter changes
  useEffect(() => {
    if (mouldCountNo === "") {
      setNoOfMoulds(0);
      return;
    }

    const current = Number(mouldCountNo);
    let calculatedMoulds = 0;

    if (current >= prevMouldCountNo) {
      calculatedMoulds = current - prevMouldCountNo;
    } else {
      calculatedMoulds = (MAX_MOULDS - prevMouldCountNo) + current;
    }

    setNoOfMoulds(calculatedMoulds);
  }, [mouldCountNo, prevMouldCountNo]);

  const handleWorkCarriedOutChange = (index, value) => {
    const newFields = [...workCarriedOut];
    newFields[index] = value;
    setWorkCarriedOut(newFields);
  };

  const handlePreventiveWorkChange = (index, value) => {
    const newFields = [...preventiveWorkCarried];
    newFields[index] = value;
    setPreventiveWorkCarried(newFields);
  };

  const handleCustomValueChange = (columnId, value) => {
    setCustomValues((prev) => ({ ...prev, [columnId]: value }));
  };

  const handleSubmit = async () => {
    const missingWork = workCarriedOut.some(w => !w || String(w).trim() === "");
    const missingPrev = preventiveWorkCarried.some(p => !p || String(p).trim() === "");
    const missingRemarks = !remarks || String(remarks).trim() === "";
    const missingCustom = customColumns.some(col => !customValues[col.id] || String(customValues[col.id]).trim() === "");

    if (!mouldCountNo || missingWork || missingPrev || missingRemarks || missingCustom) {
      toast.warning("Please fill all input fields. Type '-' if empty.");
      return;
    }

    const finalWorkCarriedOut = workCarriedOut
      .filter((item) => item.trim() !== "")
      .map((item) => `• ${item.trim()}`)
      .join("\n");

    const finalPreventiveWork = preventiveWorkCarried
      .filter((item) => item.trim() !== "")
      .map((item) => `• ${item.trim()}`)
      .join("\n");

    const payload = {
      recordDate,
      mouldCountNo: Number(mouldCountNo),
      prevMouldCountNo,
      noOfMoulds: Number(noOfMoulds),
      workCarriedOut: finalWorkCarriedOut,
      preventiveWorkCarried: finalPreventiveWork,
      operatorSignature: "APPROVED",
      remarks,
      customValues,
    };

    try {
      if (recordId) {
        // 🔥 UPDATE EXISTING RECORD
        await axios.put(`${API_BASE}/disa/records/${recordId}`, payload);
        toast.success("Record updated successfully!");
      } else {
        // 🔥 CREATE NEW RECORD
        const res = await axios.post(`${API_BASE}/disa/add`, payload);
        if(res.data.id) setRecordId(res.data.id); // Switch to edit mode automatically
        setPrevMouldCountNo(Number(mouldCountNo));
        toast.success("Record saved successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving record. Please try again.");
    }
  };

  const handleGenerateReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/disa/report`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DISA_SettingAdjustment_Report_${recordDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Failed to download PDF. Please check your connection or login again.");
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
        <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            DISA Setting Adjustment Record
            {recordId && <span className="ml-4 text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full align-middle">(Editing Mode)</span>}
          </h2>

          <div className="min-w-[1200px]">
            <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 w-32">Date</th>
                  <th className="border border-gray-300 p-2 w-36">Current Mould Counter</th>
                  <th className="border border-gray-300 p-2 w-36">Previous Mould Counter</th>
                  <th className="border border-gray-300 p-2 w-36">Calculated No. of Moulds</th>

                  <th className="border border-gray-300 p-2 w-48">
                    <div className="flex items-center justify-between">
                      <span>Work Carried Out</span>
                      <button onClick={() => setWorkCarriedOut([...workCarriedOut, ""])} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none" title="Add another row">+</button>
                    </div>
                  </th>

                  <th className="border border-gray-300 p-2 w-48">
                    <div className="flex items-center justify-between">
                      <span>Preventive Work Carried</span>
                      <button onClick={() => setPreventiveWorkCarried([...preventiveWorkCarried, ""])} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none" title="Add another row">+</button>
                    </div>
                  </th>

                  {customColumns.map((col) => (
                    <th key={col.id} className="border border-gray-300 p-2 w-40">
                      {col.columnName}
                    </th>
                  ))}

                  <th className="border border-gray-300 p-2 w-40">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 align-top">
                    <input type="date" className="w-full border p-2 rounded focus:outline-blue-500 text-sm bg-white cursor-pointer" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <input type="number" className="w-full border p-2 rounded focus:outline-blue-500 text-sm" placeholder="Enter count" value={mouldCountNo} onChange={(e) => setMouldCountNo(e.target.value)} />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <input type="number" className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none text-sm" value={prevMouldCountNo} readOnly />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    {/* 🔥 Make Calculated Moulds Editable */}
                    <input 
                      type="number" 
                      className="w-full border p-2 rounded focus:outline-blue-500 text-sm bg-white text-gray-900" 
                      value={noOfMoulds} 
                      onChange={(e) => setNoOfMoulds(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col gap-2">
                      {workCarriedOut.map((work, index) => (
                        <input key={`work-${index}`} type="text" className="w-full border p-2 rounded focus:outline-blue-500 text-sm placeholder-[10px] placeholder-gray-500" placeholder="Type '-' if empty" value={work} onChange={(e) => handleWorkCarriedOutChange(index, e.target.value)} />
                      ))}
                    </div>
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <div className="flex flex-col gap-2">
                      {preventiveWorkCarried.map((preventive, index) => (
                        <input key={`prev-${index}`} type="text" className="w-full border p-2 rounded focus:outline-blue-500 text-sm placeholder-[10px] placeholder-gray-500" placeholder="Type '-' if empty" value={preventive} onChange={(e) => handlePreventiveWorkChange(index, e.target.value)} />
                      ))}
                    </div>
                  </td>

                  {customColumns.map((col) => (
                    <td key={col.id} className="border border-gray-300 p-2 align-top">
                      <textarea
                        className="w-full border p-2 rounded focus:outline-blue-500 text-sm resize-y min-h-[40px] h-full placeholder-[10px] placeholder-gray-500"
                        placeholder="Type '-' if empty"
                        value={customValues[col.id] || ""}
                        onChange={(e) => handleCustomValueChange(col.id, e.target.value)}
                      />
                    </td>
                  ))}

                  <td className="border border-gray-300 p-2 align-top">
                    <textarea className="w-full border p-2 rounded focus:outline-blue-500 text-sm resize-y min-h-[40px] h-full placeholder-[10px] placeholder-gray-500" placeholder="Type '-' if empty" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-4 mt-4">
            <button onClick={handleGenerateReport} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors">
              Generate Report (PDF)
            </button>
            <button onClick={handleSubmit} className={`${recordId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'} text-white px-8 py-2 rounded font-bold transition-colors`}>
              {recordId ? 'Update Data' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DISASettingAdjustment;