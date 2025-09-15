import { useState } from "react";

function Login({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleAdminLogin = (e) => {
        e.preventDefault();
        if (email === "admin@fracc.com" && password === "admin123") {
            onLogin({ role: "admin", name: "Administrador" });
        } else {
            alert("Credenciales incorrectas");
        }
    };

    const handleGuestLogin = () => {
        onLogin({ role: "guest", name: "Invitado" });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
            <div className="bg-white p-10 rounded-3xl shadow-2xl w-96 max-w-full">
                <h2 className="text-3xl font-extrabold text-center text-gradient bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 mb-8">
                    Iniciar sesión
                </h2>

                <form onSubmit={handleAdminLogin} className="space-y-6">
                    <div>
                        <label className="block text-gray-800 font-semibold mb-2">
                            Correo
                        </label>
                        <input
                            type="email"
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-400 transition"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@fracc.com"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-800 font-semibold mb-2">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-400 transition"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="********"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white py-3 rounded-xl hover:brightness-110 transition"
                    >
                        Entrar como Admin
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button
                        onClick={handleGuestLogin}
                        className="text-blue-600 font-semibold hover:underline"
                    >
                        Entrar como Invitado
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;
