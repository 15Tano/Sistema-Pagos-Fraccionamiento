import React, { useEffect, useState } from "react";
import "./index.css";

function App() {
    const [vecinos, setVecinos] = useState([]);

    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/vecinos")
            .then((res) => res.json())
            .then((data) => setVecinos(data));
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">
                Sistema de Pagos - Fraccionamiento
            </h1>
            <h2 className="text-xl font-semibold mb-2">Vecinos</h2>
            <ul className="list-disc ml-6">
                {vecinos.map((v) => (
                    <li key={v.id}>
                        {v.nombre} - Casa {v.numero_casa} - Tag {v.tag}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default App;
