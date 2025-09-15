import { useState, useEffect } from "react";
import api from "../api";

function Historico() {
    const [pagos, setPagos] = useState([]);

    useEffect(() => {
        fetchPagos();
    }, []);

    const fetchPagos = async () => {
        try {
            const response = await api.get("/pagos");
            setPagos(response.data);
        } catch (error) {
            console.error("Error fetching pagos:", error);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Histórico de Pagos</h2>

            <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                <thead className="bg-blue-600 text-white">
                    <tr>
                        <th className="p-3">Vecino</th>
                        <th className="p-3">Cantidad</th>
                        <th className="p-3">Mes</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3">Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    {pagos.map((p) => (
                        <tr key={p.id} className="border-b">
                            <td className="p-3">{p.vecino.nombre}</td>
                            <td className="p-3">${p.cantidad}</td>
                            <td className="p-3">{p.mes}</td>
                            <td className="p-3">{p.tipo}</td>
                            <td className="p-3">{p.estado}</td>
                            <td className="p-3">
                                {new Date(p.created_at).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Historico;
