import React from "react";
import { Link } from "react-router-dom";

const Dashboard = () => {
    return (
        <div>
            <nav className="p-4 bg-gray-800 text-white flex gap-4">
                <Link to="/vecinos">Vecinos</Link>
                <Link to="/pagos">Pagos</Link>
                <Link to="/tags">Tags</Link>
                <Link to="/historial">Historial</Link>
            </nav>
            <div className="p-6">
                <h1 className="text-2xl font-bold">Panel de Administración</h1>
            </div>
        </div>
    );
};

export default Dashboard;
