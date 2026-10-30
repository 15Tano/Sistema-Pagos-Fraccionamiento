import { Link } from "react-router-dom";
import { Radio, Search } from "lucide-react";

export default function VigilanciaTabs({ active }) {
    return <nav aria-label="Secciones de vigilancia" className="flex gap-1 rounded-2xl border border-white/80 bg-white/45 p-1 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(83,55,25,0.04)]">
        {[{ key: "search", to: "/vigilancia", text: "Buscador", icon: Search },
            { key: "readings", to: "/vigilancia/lecturas", text: "Lecturas", icon: Radio }].map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} to={item.to} aria-current={active === item.key ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-300 ease-out active:scale-[0.98] ${active === item.key ? "bg-gradient-to-br from-white/95 to-orange-50/80 text-orange-700 shadow-[inset_0_1px_0_white,0_3px_10px_rgba(150,85,25,0.09)]" : "text-stone-500 hover:bg-white/60 hover:text-orange-700"}`}>
                <Icon size={17} />{item.text}</Link>;
        })}
    </nav>;
}
