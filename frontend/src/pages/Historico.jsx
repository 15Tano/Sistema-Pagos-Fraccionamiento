import { useState, useEffect } from "react";
import api from "../api";

function Historico() {
    const [pagos, setPagos] = useState([]);
    const [vecinos, setVecinos] = useState([]);
    const [selectedCalle, setSelectedCalle] = useState("");
    const [selectedVecino, setSelectedVecino] = useState("");
    const [searchTipo, setSearchTipo] = useState("");
    const [filterType, setFilterType] = useState("month"); // "month" or "year"
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().getMonth() + 1
    );
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        fetchVecinos();
    }, []);

    useEffect(() => {
        fetchPagos();
    }, [
        filterType,
        selectedMonth,
        selectedYear,
        selectedCalle,
        selectedVecino,
        searchTipo,
    ]);

    const fetchVecinos = async () => {
        try {
            const response = await api.get("/vecinos");
            setVecinos(response.data);
        } catch (error) {
            console.error("Error fetching vecinos:", error);
        }
    };

    const fetchPagos = async () => {
        try {
            const params = {};
            if (filterType === "month") {
                params.month = selectedMonth;
                params.year = selectedYear;
            } else {
                params.year = selectedYear;
            }
            if (selectedCalle) {
                params.calle = selectedCalle;
            }
            if (selectedVecino) {
                params.vecino = selectedVecino;
            }
            if (searchTipo) {
                params.tipo = searchTipo;
            }
            const response = await api.get("/pagos", { params });
            setPagos(response.data);
        } catch (error) {
            console.error("Error fetching pagos:", error);
        }
    };

    const uniqueCalles = [...new Set(vecinos.map((v) => v.calle))];
    const filteredVecinos = selectedCalle
        ? vecinos.filter((v) => v.calle === selectedCalle)
        : vecinos;

    const totalCantidad = pagos.reduce(
        (sum, p) => sum + parseFloat(p.cantidad),
        0
    );
    const totalRestante = pagos.reduce(
        (sum, p) => sum + parseFloat(p.restante),
        0
    );

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Histórico de Pagos</h2>

            {/* Deployable Menu */}
            <div className="mb-4">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    {isMenuOpen ? "Cerrar Filtros" : "Abrir Filtros"}
                </button>
                {isMenuOpen && (
                    <div className="mt-2 p-4 bg-gray-100 rounded">
                        <div className="mb-2">
                            <label className="mr-4">
                                <input
                                    type="radio"
                                    value="month"
                                    checked={filterType === "month"}
                                    onChange={(e) =>
                                        setFilterType(e.target.value)
                                    }
                                />
                                Filtrar por Mes
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    value="year"
                                    checked={filterType === "year"}
                                    onChange={(e) =>
                                        setFilterType(e.target.value)
                                    }
                                />
                                Filtrar por Año
                            </label>
                        </div>
                        {filterType === "month" && (
                            <div className="flex space-x-2">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) =>
                                        setSelectedMonth(e.target.value)
                                    }
                                    className="p-2 border rounded"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {new Date(0, i).toLocaleString(
                                                "es-ES",
                                                { month: "long" }
                                            )}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={selectedYear}
                                    onChange={(e) =>
                                        setSelectedYear(e.target.value)
                                    }
                                    className="p-2 border rounded"
                                >
                                    {Array.from({ length: 10 }, (_, i) => (
                                        <option
                                            key={selectedYear - 5 + i}
                                            value={selectedYear - 5 + i}
                                        >
                                            {selectedYear - 5 + i}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {filterType === "year" && (
                            <select
                                value={selectedYear}
                                onChange={(e) =>
                                    setSelectedYear(e.target.value)
                                }
                                className="p-2 border rounded"
                            >
                                {Array.from({ length: 10 }, (_, i) => (
                                    <option
                                        key={selectedYear - 5 + i}
                                        value={selectedYear - 5 + i}
                                    >
                                        {selectedYear - 5 + i}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}
            </div>

            {/* Search Filters */}
            <div className="mb-4 flex space-x-4">
                <select
                    value={selectedCalle}
                    onChange={(e) => {
                        setSelectedCalle(e.target.value);
                        setSelectedVecino(""); // Reset vecino when calle changes
                    }}
                    className="p-2 border rounded"
                >
                    <option value="">Todas las Calles</option>
                    {uniqueCalles.map((calle) => (
                        <option key={calle} value={calle}>
                            {calle}
                        </option>
                    ))}
                </select>
                <select
                    value={selectedVecino}
                    onChange={(e) => setSelectedVecino(e.target.value)}
                    className="p-2 border rounded"
                >
                    <option value="">Todos los Vecinos</option>
                    {filteredVecinos.map((v) => (
                        <option key={v.id} value={v.nombre}>
                            {v.nombre}
                        </option>
                    ))}
                </select>
                <select
                    value={searchTipo}
                    onChange={(e) => setSearchTipo(e.target.value)}
                    className="p-2 border rounded"
                >
                    <option value="">Todos los Tipos</option>
                    <option value="ordinario">Ordinario</option>
                    <option value="extraordinario">Extraordinario</option>
                </select>
            </div>

            {/* Table */}
            <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
                <thead className="bg-blue-600 text-white">
                    <tr>
                        <th className="p-3">Vecino</th>
                        <th className="p-3">Mes</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Cantidad</th>
                        <th className="p-3">Restante</th>
                        <th className="p-3">Fecha de Cobro</th>
                    </tr>
                </thead>
                <tbody>
                    {pagos.map((p) => (
                        <tr key={p.id} className="border-b">
                            <td className="p-3">{p.vecino.nombre}</td>
                            <td className="p-3">{p.mes}</td>
                            <td className="p-3 capitalize">{p.tipo}</td>
                            <td className="p-3">
                                ${parseFloat(p.cantidad).toFixed(2)}
                            </td>
                            <td className="p-3">
                                ${parseFloat(p.restante).toFixed(2)}
                            </td>
                            <td className="p-3">
                                {p.fecha_de_cobro
                                    ? new Date(
                                          p.fecha_de_cobro
                                      ).toLocaleDateString("es-ES")
                                    : "-"}
                            </td>
                        </tr>
                    ))}
                    <tr className="bg-gray-200 font-bold">
                        <td className="p-3">Total</td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3">${totalCantidad.toFixed(2)}</td>
                        <td className="p-3">${totalRestante.toFixed(2)}</td>
                        <td className="p-3"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default Historico;
