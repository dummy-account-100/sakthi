import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react"; 
import logo from "../Assets/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current route
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
  const dashboardPaths = ['/operator', '/hod', '/hof', '/admin','/supervisor'];
  const isDashboard = dashboardPaths.includes(location.pathname);

  // Dynamically navigate to the user's specific dashboard
  const handleBack = () => {
    const backPath = user.role ? `/${user.role.toLowerCase()}` : '/operator';
    navigate(backPath);
  };

  return (
    <div className="flex justify-between items-center px-6 py-3 bg-gray-800 text-white shadow-md">

      {/* 1. Logo & Back Button Section (Left) */}
      <div className="flex-1 flex justify-start items-center gap-4">
        
        {/* Only show the back arrow if we are NOT on any of the main dashboards */}
        {!isDashboard && (
          <button 
            onClick={handleBack} 
            className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            title={`Back to ${user.role.toUpperCase()} Dashboard`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        
        <img
          src={logo}
          alt="Sakthi Auto"
          className="h-10 w-auto object-contain bg-white p-1 rounded"
        />
      </div>

      {/* 2. User Role Section (Middle) */}
      <div className="flex-1 text-center">
        <h1 className="text-xl font-semibold tracking-wide">
          {user.role.toUpperCase()} DASHBOARD
        </h1>
      </div>

      {/* 3. Logout Section (Right) */}
      <div className="flex-1 flex justify-end">
        <button
          onClick={handleLogout}
          className="bg-orange-600 hover:bg-red-600 px-5 py-2 rounded font-medium transition-colors"
        >
          Logout
        </button>
      </div>

    </div>
  );
};

export default Header;