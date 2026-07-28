import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./store/authStore";
import Layout from "./components/layout/layout.jsx";
import { linkOneSignalUser, unlinkOneSignalUser } from "./lib/onesignal";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vecinos from "./pages/Vecinos.jsx";
import Pagos from "./pages/Pagos.jsx";
import Tags from "./pages/Tags.jsx";
import Historico from "./pages/Historico.jsx";
import ResidentDashboard from "./pages/ResidentDashboard";
import GuestView from "./pages/GuestView.jsx";
import RegistroAccesoVecino from "./pages/RegistroAccesoVecino";
import VistaVigilancia from "./pages/VistaVigilancia";

const PrivateRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role))
        return <Navigate to="/login" replace />;
    return children;
};

const AdminRoute = ({ children }) => (
    <PrivateRoute allowedRoles={["admin", "capturista"]}>
        <Layout>{children}</Layout>
    </PrivateRoute>
);

const RootRoute = () => {
    const { isAuthenticated, user } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role === "residente") return <Navigate to="/residente" replace />;
    return (
        <AdminRoute>
            <Dashboard />
        </AdminRoute>
    );
};

function App() {
    const { isAuthenticated, user } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated && user?.id) {
            linkOneSignalUser(user.id);
        } else {
            unlinkOneSignalUser();
        }
    }, [isAuthenticated, user?.id]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/guest" element={<GuestView />} />
                <Route path="/" element={<RootRoute />} />
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

                <Route
                    path="/capturista/registro-acceso"
                    element={<RegistroAccesoVecino />}
                />

                <Route path="/vigilancia" element={<VistaVigilancia />} />

                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
