import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const getShiftAndDate = () => {
  const now = new Date();
  let hours = now.getHours();
  let shift = "";

  if (hours >= 7 && hours < 15) {
    shift = "I";
  } else if (hours >= 15 && hours < 23) {
    shift = "II";
  } else {
    shift = "III";
    if (hours < 7) {
      now.setDate(now.getDate() - 1);
    }
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { recordDate: `${year}-${month}-${day}`, shift };
};

const FourMChangeMonitoring = () => {
  const initialTimeData = getShiftAndDate();

  const [line, setLine] = useState("DISA - I");
  const [partName, setPartName] = useState("");

  const [recordDate, setRecordDate] = useState(initialTimeData.recordDate);
  const [shift, setShift] = useState(initialTimeData.shift);
  const [mcNo, setMcNo] = useState("");
  const [type4M, setType4M] = useState("");
  const [description, setDescription] = useState("");

  const [firstPart, setFirstPart] = useState("-");
  const [lastPart, setLastPart] = useState("-");
  const [inspFreq, setInspFreq] = useState("-");
  const [retroChecking, setRetroChecking] = useState("-");
  const [quarantine, setQuarantine] = useState("-");
  const [partId, setPartId] = useState("-");
  const [internalComm, setInternalComm] = useState("-");
  const [inchargeSign, setInchargeSign] = useState("");

  const [inchargeList, setInchargeList] = useState([]);
  const [showInchargeDropdown, setShowInchargeDropdown] = useState(false);
  const [fourMOptions, setFourMOptions] = useState([]);

  // HOD Assignment
  const [assignedHOD, setAssignedHOD] = useState("");
  const [hodList, setHodList] = useState([]);

  // Dynamic columns state
  const [customColumns, setCustomColumns] = useState([]);
  const [customValues, setCustomValues] = useState({});

  useEffect(() => {
    // Fetch Incharges & HODs
    axios.get(`${process.env.REACT_APP_API_URL}/api/4m-change/incharges`)
      .then((res) => {
        setInchargeList(res.data.supervisors);
        setHodList(res.data.hods);
      })
      .catch((err) => console.error("Error fetching incharges:", err));

    // Fetch 4M Types
    axios.get(`${process.env.REACT_APP_API_URL}/api/4m-change/types`)
      .then((res) => {
        setFourMOptions(res.data);
        if (res.data.length > 0) setType4M(res.data[0].typeName);
      })
      .catch((err) => console.error("Error fetching 4M types:", err));

    // Fetch Custom Columns
    axios.get(`${process.env.REACT_APP_API_URL}/api/4m-change/custom-columns`)
      .then((res) => {
        setCustomColumns(res.data);
        const initialVals = {};
        res.data.forEach(col => { initialVals[col.id] = ""; });
        setCustomValues(initialVals);
      })
      .catch((err) => console.error("Error fetching custom columns:", err));
  }, []);

  const handleCustomValueChange = (columnId, value) => {
    setCustomValues(prev => ({ ...prev, [columnId]: value }));
  };

  const handleSubmit = async () => {
    const missingCustom = customColumns.some(col => !customValues[col.id] || String(customValues[col.id]).trim() === "");
    if (!partName || !mcNo || !description || !type4M || missingCustom) {
      toast.warning("Please fill all input fields. Type '-' if empty.");
      return;
    }
    if (!inchargeSign) {
      toast.warning("Please assign a Supervisor (Incharge Sign).");
      return;
    }
    if (!assignedHOD) {
      toast.warning("Please select a HOD for final verification.");
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/4m-change/add`, {
        line, partName, recordDate, shift, mcNo, type4M, description,
        firstPart, lastPart, inspFreq, retroChecking, quarantine,
        partId, internalComm, inchargeSign, assignedHOD,
        customValues
      });

      toast.success("Record saved successfully!");

      setMcNo(""); setDescription("");
      if (fourMOptions.length > 0) setType4M(fourMOptions[0].typeName);
      setFirstPart("-"); setLastPart("-"); setInspFreq("-");
      setRetroChecking("-"); setQuarantine("-"); setPartId("-");
      setInternalComm("-"); setInchargeSign(""); setAssignedHOD("");

      const resetVals = {};
      customColumns.forEach(col => { resetVals[col.id] = ""; });
      setCustomValues(resetVals);

    } catch (err) {
      console.error(err);
      toast.error("Error saving record. Please try again.");
    }
  };

  const handleGenerateReport = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/4m-change/report?fromDate=${recordDate}&toDate=${recordDate}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `4M_Change_${recordDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Failed to download PDF. Please check your connection or login again.");
    }
  };

  const StatusSelect = ({ value, onChange, options = ["-", "OK", "Not OK"] }) => (
    <select
      className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm text-center appearance-none cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
        <div className="bg-white w-full max-w-[95rem] rounded-xl p-8 shadow-2xl overflow-x-auto">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            4M CHANGE MONITORING CHECK SHEET
          </h2>

          <div className="flex justify-between items-center mb-6 bg-gray-50 p-4 rounded border border-gray-300 shadow-sm">
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-700">Line:</label>
              <select
                className="border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm cursor-pointer"
                value={line}
                onChange={(e) => setLine(e.target.value)}
              >
                <option value="DISA - I">DISA - I</option>
                <option value="DISA - II">DISA - II</option>
                <option value="DISA - III">DISA - III</option>
                <option value="DISA - IV">DISA - IV</option>
                <option value="DISA - V">DISA - V</option>
                <option value="DISA - VI">DISA - VI</option>
              </select>
            </div>

            <div className="flex items-center gap-4 w-1/3">
              <label className="font-bold text-gray-700 whitespace-nowrap">Part Name:</label>
              <input
                type="text"
                className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm placeholder-gray-500"
                placeholder="Type '-' if empty"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
              />
            </div>
          </div>

          <div className="min-w-[1200px] pb-8">
            <table className="w-full border-collapse border border-gray-300 text-sm mb-6 relative">
              <thead className="bg-gray-200 text-gray-800 text-center text-xs">
                <tr>
                  <th className="border border-gray-300 p-2 w-24">Date / Shift</th>
                  <th className="border border-gray-300 p-2 w-24">M/c. No</th>
                  <th className="border border-gray-300 p-2 w-32">Type of 4M</th>
                  <th className="border border-gray-300 p-2 w-48">Description</th>
                  <th className="border border-gray-300 p-2 w-20">First Part</th>
                  <th className="border border-gray-300 p-2 w-20">Last Part</th>
                  <th className="border border-gray-300 p-2 w-24">Insp. Freq<br />(N/I)</th>
                  <th className="border border-gray-300 p-2 w-24">Retro<br />checking</th>
                  <th className="border border-gray-300 p-2 w-24">Quarantine</th>
                  <th className="border border-gray-300 p-2 w-24">Part<br />Ident.</th>
                  <th className="border border-gray-300 p-2 w-24">Internal<br />Comm.</th>
                  <th className="border border-gray-300 p-2 w-40">Incharge Sign</th>

                  {customColumns.map((col) => (
                    <th key={col.id} className="border border-gray-300 p-2 w-32 whitespace-pre-wrap">
                      {col.columnName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 align-middle text-center bg-gray-50 space-y-2">
                    <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="w-full bg-white text-gray-900 font-bold border border-gray-300 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-center" />
                    <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full bg-white text-gray-700 font-bold border border-gray-300 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-center outline-none">
                      <option value="I">Shift I</option>
                      <option value="II">Shift II</option>
                      <option value="III">Shift III</option>
                    </select>
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <input type="text" className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm placeholder-[10px] placeholder-gray-500" placeholder="Type '-' if empty" value={mcNo} onChange={(e) => setMcNo(e.target.value)} />
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <select
                      className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm appearance-none cursor-pointer"
                      value={type4M}
                      onChange={(e) => setType4M(e.target.value)}
                    >
                      {fourMOptions.map((opt, idx) => (
                        <option key={idx} value={opt.typeName}>
                          {opt.typeName}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="border border-gray-300 p-2 align-top">
                    <textarea className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm resize-y min-h-[40px] h-full placeholder-[10px] placeholder-gray-500" placeholder="Type '-' if empty" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </td>

                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={firstPart} onChange={setFirstPart} /></td>
                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={lastPart} onChange={setLastPart} /></td>
                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={inspFreq} onChange={setInspFreq} options={["-", "N", "I"]} /></td>
                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={retroChecking} onChange={setRetroChecking} /></td>
                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={quarantine} onChange={setQuarantine} /></td>
                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={partId} onChange={setPartId} /></td>
                  <td className="border border-gray-300 p-2 align-top"><StatusSelect value={internalComm} onChange={setInternalComm} /></td>

                  <td className="border border-gray-300 p-2 align-top relative">
                    <input
                      type="text"
                      className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm text-left placeholder-gray-500"
                      placeholder="Search Member..."
                      value={inchargeSign}
                      onChange={(e) => {
                        setInchargeSign(e.target.value);
                        setShowInchargeDropdown(true);
                      }}
                      onFocus={() => setShowInchargeDropdown(true)}
                      onBlur={() => setTimeout(() => setShowInchargeDropdown(false), 200)}
                    />

                    {showInchargeDropdown && (
                      <ul className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-400 rounded shadow-xl max-h-48 overflow-y-auto z-[9999]">
                        {inchargeList
                          .filter(person => {
                            const dbName = person.name || person.Name || "";
                            return dbName.toLowerCase().includes((inchargeSign || "").toLowerCase());
                          })
                          .map((person, index) => {
                            const dbName = person.name || person.Name || "";
                            return (
                              <li
                                key={index}
                                className="p-2 text-left hover:bg-gray-200 cursor-pointer text-sm text-gray-900 font-medium"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setInchargeSign(dbName);
                                  setShowInchargeDropdown(false);
                                }}
                              >
                                {dbName}
                              </li>
                            );
                          })
                        }
                        {inchargeList.filter(person => (person.name || person.Name || "").toLowerCase().includes((inchargeSign || "").toLowerCase())).length === 0 && (
                          <li className="p-2 text-left text-gray-500 text-sm italic">
                            No matches found
                          </li>
                        )}
                      </ul>
                    )}
                  </td>

                  {customColumns.map((col) => (
                    <td key={col.id} className="border border-gray-300 p-2 align-top">
                      <input
                        type="text"
                        className="w-full border border-gray-400 bg-white text-gray-900 p-2 rounded focus:outline-blue-500 focus:border-blue-500 text-sm placeholder-[10px] placeholder-gray-500"
                        placeholder="Type '-' if empty"
                        value={customValues[col.id] || ""}
                        onChange={(e) => handleCustomValueChange(col.id, e.target.value)}
                      />
                    </td>
                  ))}

                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gray-50 p-6 rounded border border-gray-200 mt-4">
            <div className="w-full md:w-1/3">
              <label className="font-bold text-gray-700 block mb-2 text-sm uppercase">Assign to HOD for Final Review:</label>
              <select className="w-full border-2 border-gray-300 p-3 rounded focus:outline-blue-500 text-sm font-bold bg-white cursor-pointer" value={assignedHOD} onChange={(e) => setAssignedHOD(e.target.value)}>
                <option value="">-- Select HOD --</option>
                {hodList.map((hod, i) => <option key={i} value={hod.name}>{hod.name}</option>)}
              </select>
            </div>

            <div className="flex gap-4">
              <button onClick={handleGenerateReport} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded font-bold transition-colors shadow">Preview PDF</button>
              <button onClick={handleSubmit} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow">Submit & Assign</button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default FourMChangeMonitoring;