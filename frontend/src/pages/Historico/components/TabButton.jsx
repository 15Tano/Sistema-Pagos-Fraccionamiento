function TabButton({ id, label, count, activeTab, onSelect }) {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => onSelect(id)}
            className={`px-4 py-2 font-medium text-sm rounded-xl transition-all duration-300 active:scale-95 ${
                isActive
                    ? "bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-[0_4px_10px_rgba(249,115,22,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)]"
                    : "bg-white/40 backdrop-blur-md border border-white/60 text-stone-600 hover:bg-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]"
            }`}
        >
            <span>{label}</span>
            {count !== undefined && (
                <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded-lg font-medium shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)] ${
                        isActive
                            ? "bg-black/10 text-white"
                            : "bg-black/5 text-stone-500"
                    }`}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

export default TabButton;
