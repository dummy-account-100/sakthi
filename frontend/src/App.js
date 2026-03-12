import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Supervisor from "./pages/Supervisor";
import Operator from "./pages/Operator";
import Hod from "./pages/Hod";
import Hof from "./pages/Hof";
import ProtectedRoute from "./components/ProtectedRoutes";
import FormPlaceholder from "./pages/FormPlaceholder";
import AdminDashboard from "./pages/AdminDashboard";
import AddUser from "./pages/AddUser";
import { Import } from "lucide-react";
import ConfigDisaSettingAdjustment from "./pages/ConfigDisaSettingAdjustment";
function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
  path="/add-user"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AddUser />
    </ProtectedRoute>
  }
/>

        <Route
          path="/supervisor"
          element={
            <ProtectedRoute allowedRoles={["supervisor"]}>
              <Supervisor />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/config/disa-setting-adjustment" element={<ConfigDisaSettingAdjustment />} />

        <Route
          path="/operator"
          element={
            <ProtectedRoute allowedRoles={["operator", "supervisor"]}>
              <Operator />
            </ProtectedRoute>
          }
        />

        {/* Allow BOTH operators and supervisors to view the Operator Forms */}
        <Route
          path="/operator/:formName"
          element={
            <ProtectedRoute allowedRoles={["operator", "supervisor"]}>
              <FormPlaceholder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hod"
          element={
            <ProtectedRoute allowedRoles={["hod"]}>
              <Hod />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hof"
          element={
            <ProtectedRoute allowedRoles={["hof"]}>
              <Hof />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<h1>Unauthorized Access</h1>} />
        <Route path="*" element={<Login />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;