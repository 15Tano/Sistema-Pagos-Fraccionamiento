import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./store/authStore";
import Layout from "./components/layout/layout.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Vecinos from "./pages/Vecinos.jsx";
import Pagos from "./pages/Pagos.jsx";
import Tags from "./pages/Tags.jsx";
import Historico from "./pages/Historico.jsx";
import ResidentDashboard from "./pages/ResidentDashboard.jsx";
import GuestView from "./pages/GuestView.jsx";

const PrivateRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role))
        return <Navigate to="/login" replace />;
    return children;
};

const AdminRoute = ({ children }) => (
    <PrivateRoute allowedRoles={["admin"]}>
        <Layout>{children}</Layout>
    </PrivateRoute>
);

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/guest" element={<GuestView />} />
                <Route
                    path="/"
                    element={
                        <AdminRoute>
                            <Dashboard />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/vecinos"
                    element={
                        <AdminRoute>
                            <Vecinos />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/pagos"
                    element={
                        <AdminRoute>
                            <Pagos />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/tags"
                    element={
                        <AdminRoute>
                            <Tags />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/historico"
                    element={
                        <AdminRoute>
                            <Historico />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/residente"
                    element={
                        <PrivateRoute allowedRoles={["residente"]}>
                            <ResidentDashboard />
                        </PrivateRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
