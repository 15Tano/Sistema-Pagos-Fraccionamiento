// Campo de input tipo Liquid Glass, reutilizado para identificador y contraseña.
// El único dato que cambia entre ambos usos es el icono, el tipo/valor y
// si tiene una acción a la derecha (mostrar/ocultar contraseña).
function CampoInput({
    label,
    type,
    value,
    onChange,
    placeholder,
    disabled,
    loginType, // "admin" | "residente" — define el color de acento
    iconoIzquierdo: IconoIzquierdo,
    accionDerecha, // { icono: Componente, onClick } — opcional
}) {
    const colorAnillo =
        loginType === "admin"
            ? "focus:ring-4 focus:ring-orange-500/20 focus:border-orange-400"
            : "focus:ring-4 focus:ring-green-500/20 focus:border-green-400";
    const colorIcono =
        loginType === "admin"
            ? "text-orange-400 group-focus-within:text-orange-600"
            : "text-green-500 group-focus-within:text-green-700";

    return (
        <div>
            <label className="block text-sm font-bold text-stone-700 mb-2 ml-1">
                {label}
            </label>
            <div className="relative group">
                <input
                    type={type}
                    className={`w-full px-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] focus:outline-none focus:bg-white/60 transition-all duration-300 pl-11 ${
                        accionDerecha ? "pr-11" : ""
                    } ${colorAnillo}`}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required
                    disabled={disabled}
                />
                <div
                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors duration-300 ${colorIcono}`}
                >
                    <IconoIzquierdo className="w-5 h-5" />
                </div>
                {accionDerecha && (
                    <button
                        type="button"
                        onClick={accionDerecha.onClick}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors p-1"
                    >
                        <accionDerecha.icono className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
}

export default CampoInput;
