import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import VigilanciaTabs from "./VigilanciaTabs";

export default function VigilanciaLayout({ active, onLogout, showTabs = true, adminReturn = false, children }) {
    return <div className="app-shell"><div className="app-bg" />
        <div className="relative z-10 mx-auto w-full max-w-[1100px] px-4 pb-8 pt-5 sm:px-7 sm:pt-7">
            <header className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/60 text-orange-600 shadow-sm"><ShieldCheck size={21} /></span>
                    <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-orange-700">San Isidro</p><h1 className="text-xl font-bold tracking-tight text-stone-800">Vigilancia</h1></div></div>
                <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/55 px-3 py-2.5 text-xs font-semibold text-stone-600 hover:bg-white/80"><LogOut size={15} />Salir</button>
            </header>
            {adminReturn && <Link to="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-orange-700 transition-opacity hover:opacity-75"><ArrowLeft size={14} />Volver a administración</Link>}
            {showTabs && <div className="mb-5"><VigilanciaTabs active={active} /></div>}
            <main>{children}</main>
        </div>
    </div>;
}
