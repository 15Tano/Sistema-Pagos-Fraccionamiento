import { useState } from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    NavLink,
    Navigate,
} from "react-router-dom";
import Login from "./components/login";
import Pagos from "./components/Pagos";
import GuestView from "./pages/GuestView";
import Vecinos from "./pages/Vecinos";
import Tags from "./pages/Tags";
import Historico from "./pages/Historico";

function App() {
    const [user, setUser] = useState(null); // null = no logueado

    if (!user) {
        return <Login onLogin={setUser} />;
    }

    return (
        <Router>
            <div className="min-h-screen bg-gray-100">
                <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Sistema de Pagos</h1>
                    {user.role === "admin" && (
                        <nav className="flex space-x-0">
                            <NavLink
                                to="/vecinos"
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-t-lg ${
                                        isActive
                                            ? "bg-white text-indigo-600"
                                            : "text-white hover:bg-indigo-700"
                                    }`
                                }
                            >
                                Vecinos
                            </NavLink>
                            <NavLink
                                to="/pagos"
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-t-lg ${
                                        isActive
                                            ? "bg-white text-indigo-600"
                                            : "text-white hover:bg-indigo-700"
                                    }`
                                }
                            >
                                Pagos
                            </NavLink>
                            <NavLink
                                to="/tags"
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-t-lg ${
                                        isActive
                                            ? "bg-white text-indigo-600"
                                            : "text-white hover:bg-indigo-700"
                                    }`
                                }
                            >
                                Tags
                            </NavLink>
                            <NavLink
                                to="/historico"
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-t-lg ${
                                        isActive
                                            ? "bg-white text-indigo-600"
                                            : "text-white hover:bg-indigo-700"
                                    }`
                                }
                            >
                                Histórico
                            </NavLink>
                        </nav>
                    )}
                    <button
                        onClick={() => setUser(null)}
                        className="bg-white text-indigo-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                    >
                        Cerrar sesión
                    </button>
                </header>

                <main className="p-6">
                    <Routes>
                        {user.role === "admin" && (
                            <>
                                <Route path="/vecinos" element={<Vecinos />} />
                                <Route path="/pagos" element={<Pagos />} />
                                <Route path="/tags" element={<Tags />} />
                                <Route
                                    path="/historico"
                                    element={<Historico />}
                                />
                                <Route
                                    path="*"
                                    element={<Navigate to="/vecinos" replace />}
                                />
                            </>
                        )}
                        {user.role === "guest" && (
                            <>
                                <Route path="*" element={<GuestView />} />
                            </>
                        )}
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
