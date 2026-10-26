import { Link } from "react-router-dom";
import { Radio, Search } from "lucide-react";

export default function VigilanciaTabs({ active }) {
    return <nav aria-label="Secciones de vigilancia" className="flex gap-1 rounded-2xl border border-white/80 bg-white/45 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(83,55,25,0.04)]">
        {[{ key: "search", to: "/vigilancia", text: "Buscador", icon: Search },
            { key: "readings", to: "/vigilancia/lecturas", text: "Lecturas", icon: Radio }].map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} to={item.to} aria-current={active === item.key ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${active === item.key ? "bg-white/90 text-orange-700 shadow-sm" : "text-stone-500 hover:bg-white/50"}`}>
                <Icon size={17} />{item.text}</Link>;
        })}
    </nav>;
}
