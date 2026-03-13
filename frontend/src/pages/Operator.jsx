import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { 
  BarChart3, 
  Factory, 
  Layers, 
  ClipboardCheck, 
  SlidersHorizontal, 
  ListChecks, 
  FileSearch, 
  Cpu, 
  ShieldCheck, 
  ShieldAlert, 
  Activity 
} from "lucide-react";

const Operator = () => {
  const navigate = useNavigate();

  const buttons = [
    { name: "Daily Performance Report", path: "/operator/product", icon: BarChart3 },
    { name: "DISAmatic Production Report", path: "/operator/disamatic-report", icon: Factory },
    { name: "Unpoured Mould Details", path: "/operator/unpoured-mould", icon: Layers },
    { name: "Moulding Quality Inspection", path: "/operator/moulding-quality-inspection", icon: ClipboardCheck },
    
    // ✅ MATCHES FORM PLACEHOLDER KEY
    { name: "DISA Setting Adjustment", path: "/operator/disa-setting-adjustment", icon: SlidersHorizontal },
    
    { name: "DISA Operator Checklist", path: "/operator/disa-operator", icon: ListChecks },
    { name: "Layered Process Audit", path: "/operator/lpa", icon: FileSearch },
    { name: "DMM setting parameters checklist", path: "/operator/dmm-setting-parameters-checklist", icon: Cpu },
    { name: "Error Proof Verification", path: "/operator/error-proof", icon: ShieldCheck },
    { name: "Error Proof Verification 2", path: "/operator/error-proof-2", icon: ShieldAlert },
    { name: "4M Change Monitoring", path: "/operator/4m-change-monitoring", icon: Activity },
  ];

  return (
    <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col relative font-sans">
      
      {/* Subtle Background Radial Glow for Depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,145,0,0.03)_0%,transparent_70%)] pointer-events-none"></div>

      <Header />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center px-6 py-12 relative z-10">
        
        {/* Section Title */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] uppercase mb-3 drop-shadow-md">
            Operator Control Panel
          </h2>
          <div className="w-20 h-1.5 bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 mx-auto rounded-full shadow-[0_0_10px_rgba(255,145,0,0.5)]"></div>
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1400px] w-full pb-10">
          {buttons.map((btn, index) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.path}
                onClick={() => navigate(btn.path)}
                style={{ animationDelay: `${index * 50}ms` }}
                className="
                  group relative flex flex-col items-center justify-center p-8 
                  bg-[#383838] border border-[#4a4a4a] rounded-2xl
                  shadow-[0_8px_20px_rgba(0,0,0,0.3)]
                  hover:border-transparent hover:bg-gradient-to-br hover:from-[#ff9100] hover:to-[#e68200] 
                  hover:shadow-[0_15px_30px_rgba(255,145,0,0.3)]
                  hover:-translate-y-1.5 active:translate-y-0
                  transition-all duration-300 ease-out
                  animate-in fade-in zoom-in-95 fill-mode-both
                "
              >
                {/* Icon Container */}
                <div className="mb-5 p-4 bg-[#2d2d2d] group-hover:bg-white/20 rounded-full border border-[#4a4a4a] group-hover:border-white/30 shadow-inner transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#ff9100] group-hover:text-white drop-shadow-md transition-colors duration-300" strokeWidth={2.5} />
                </div>

                {/* Button Text */}
                <span className="text-[15px] font-bold text-gray-200 group-hover:text-white text-center tracking-wide leading-snug drop-shadow-sm transition-colors duration-300">
                  {btn.name}
                </span>

                {/* Bottom Highlight Line on Hover */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-white rounded-t-full group-hover:w-1/3 transition-all duration-300 opacity-50"></div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Border */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 relative z-20 shadow-[0_-2px_10px_rgba(255,145,0,0.5)]" />
    </div>
  );
};

export default Operator;