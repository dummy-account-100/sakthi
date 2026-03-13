import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react"; 
import logo from "../Assets/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem("user");
    if (data) {
      setUser(JSON.parse(data));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  if (!user) return null;

  // List of all root dashboard paths where the back arrow should be hidden
  const dashboardPaths = ['/operator', '/hod', '/hof', '/admin', '/supervisor'];
  const isDashboard = dashboardPaths.includes(location.pathname);

  // Dynamically navigate to the user's specific dashboard
  const handleBack = () => {
    const backPath = user.role ? `/${user.role.toLowerCase()}` : '/operator';
    navigate(backPath);
  };

  // Extract first letter for the Avatar
  const userInitial = user.username ? user.username.charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-[100] w-full bg-[#0B1727] border-b-[3px] border-[#ff9100] shadow-lg">
      
      <div className="flex justify-between items-center px-5 md:px-8 py-3 max-w-[1600px] mx-auto">
        
        {/* 1. LEFT: Back Button & Logo */}
        <div className="flex-1 flex justify-start items-center gap-4 md:gap-5">
          {!isDashboard && (
            <button 
              onClick={handleBack} 
              className="flex items-center justify-center w-10 h-10 bg-[#1A2A40] hover:bg-[#ff9100] text-gray-300 hover:text-white rounded-lg transition-colors border border-[#2D3E56] hover:border-[#ff9100] shadow-sm group"
              title={`Back to ${user.role.toUpperCase()} Dashboard`}
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
          )}
          
          {/* Solid White Logo Box */}
          <div className="bg-white px-3 py-1.5 rounded flex items-center justify-center shadow-sm">
            <img
              src={logo}
              alt="Sakthi Auto"
              className="h-7 md:h-9 w-auto object-contain"
            />
          </div>
        </div>

        {/* 2. CENTER: Main Title */}
        <div className="flex-1 text-center flex flex-col items-center justify-center cursor-default">
          <p className="text-[9px] md:text-[10px] font-bold text-[#ff9100] uppercase tracking-[0.3em] mb-0.5">
            Sakthi Auto Component
          </p>
          <h1 className="text-lg md:text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
            {user.role}
            <span className="text-[#3A506B] font-medium hidden md:inline">|</span>
            <span className="text-[#89A1BE] font-bold hidden md:inline">PORTAL</span>
          </h1>
        </div>

        {/* 3. RIGHT: User Profile Chip & Logout */}
        <div className="flex-1 flex justify-end items-center gap-4">
          
          {/* Solid User Profile Chip */}
          <div className="hidden lg:flex items-center gap-3 bg-[#132235] border border-[#2D3E56] rounded-full pl-1.5 pr-5 py-1.5 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-[#ff9100] flex items-center justify-center text-white font-black text-sm">
              {userInitial}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[8px] text-[#89A1BE] font-bold uppercase tracking-widest leading-none mb-0.5">
                Logged In
              </span>
              <span className="text-xs text-white font-bold tracking-wide leading-none">
                {user.username}
              </span>
            </div>
          </div>

          {/* Minimalist Mobile Avatar */}
          <div className="lg:hidden w-8 h-8 rounded-full bg-[#ff9100] flex items-center justify-center text-white font-black text-sm shadow-sm">
            {userInitial}
          </div>

          {/* Solid Separation Line */}
          <div className="hidden sm:block w-px h-8 bg-[#2D3E56]"></div>

          {/* Solid Outline Logout Button */}
          <button
            onClick={handleLogout}
            className="group flex items-center gap-2 bg-transparent border-2 border-[#E11D48] hover:bg-[#E11D48] text-[#E11D48] hover:text-white px-4 md:px-5 py-2 rounded-lg transition-colors shadow-sm"
          >
            <span className="hidden sm:block text-xs font-bold uppercase tracking-widest">Logout</span>
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform stroke-[2.5]" />
          </button>

        </div>
      </div>
    </header>
  );
};

export default Header;