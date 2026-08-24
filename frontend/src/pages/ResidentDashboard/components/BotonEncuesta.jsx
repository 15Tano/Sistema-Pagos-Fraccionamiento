export default function BotonEncuesta({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-12 right-4 z-40 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
            style={{ touchAction: "manipulation" }}
        >
            <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            Encuesta activa
        </button>
    );
}
