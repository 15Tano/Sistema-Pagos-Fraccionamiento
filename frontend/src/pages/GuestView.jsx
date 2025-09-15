import React, { useState } from "react";
import api from "../api";

const GuestView = () => {
    const [query, setQuery] = useState("");
    const [historial, setHistorial] = useState([]);

    const buscarVecino = async () => {
        try {
            const res = await api.get(`/vecinos/${query}/historial`);
            setHistorial(res.data);
        } catch {
            alert("Vecino no encontrado");
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-3">
                Consulta de Pagos (Invitado)
            </h2>
            <input
                type="text"
                placeholder="Nombre o ID del vecino"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border p-2 mr-2 rounded"
            />
            <button
                onClick={buscarVecino}
                className="bg-green-500 text-white px-4 py-2 rounded"
            >
                Buscar
            </button>

            <ul className="mt-4">
                {historial.map((h) => (
                    <li
                        key={h.id}
                        className="border p-2 mb-2 rounded bg-gray-100"
                    >
                        {h.mes} - {h.tipo} - ${h.cantidad}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GuestView;
