import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

export default function VigilanciaShortcut() {
    return <Link to="/vigilancia/lecturas" className="group flex items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/55 px-5 py-4 text-stone-700 shadow-[inset_0_1px_0_white,0_8px_25px_-15px_#a16e3e50] backdrop-blur-md transition duration-300 hover:bg-white/80 hover:shadow-md active:scale-[.99]">
        <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-white bg-orange-100/70 text-orange-600"><ShieldCheck size={22} /></span>
            <span><span className="block text-sm font-bold">Vigilancia</span><span className="block text-xs text-stone-500">Buscador, lecturas e historial de acceso</span></span></span>
        <ArrowUpRight size={19} className="shrink-0 text-orange-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>;
}
