export default function TabSwitcher({ tabs, active, onChange }) {
    return (
        <div className="flex gap-2 bg-white/30 backdrop-blur-md border border-white/50 rounded-2xl p-1.5 mb-6">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        active === tab.id
                            ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                            : "text-stone-600 hover:bg-white/40"
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
