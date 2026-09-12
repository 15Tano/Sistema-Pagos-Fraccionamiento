import GlassPanel from "../../components/GlassPanel";
import TabButton from "./components/TabButton";
import HeaderHistorico from "./components/HeaderHistorico";
import FiltrosPanel from "./components/FiltrosPanel";
import ResumenGeneral from "./components/ResumenGeneral";
import DesgloseFinanciero from "./components/DesgloseFinanciero";
import TablaPagos from "./components/TablaPagos";
import { useHistoricoData } from "./useHistoricoData";
import { formatMonth, formatDate, formatCurrency } from "./formatters";
import TotalPill from "./components/TotalPill";

const TITULOS = {
    individual: "Historial Individual",
    mensual: (m) => `Pagos del Mes: ${formatMonth(m)}`,
    mes_cobro: (m) => `Pagos Cobrados en: ${formatMonth(m)}`,
    por_dia: (d) => `Pagos del Día: ${formatDate(d)}`,
    adelantados: "Pagos Adelantados",
};

function Historico() {
    const data = useHistoricoData();
    const {
        esCapturista,
        loadingInicial,
        loadingTabla,
        activeTab,
        setActiveTab,
        pagos,
        vecinos,
        selectedMonth,
        selectedDate,
        selectedCollectionMonth,
        selectedVecino,
        sortConfig,
        toggleSort,
        desgloseFinanciero,
        CURRENT_MONTH_ISO,
    } = data;

    if (loadingInicial) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin drop-shadow-md" />
                    <span className="text-stone-500 text-sm font-medium tracking-wide">
                        Cargando historial...
                    </span>
                </div>
            </div>
        );
    }

    const tablaTabs = [
        "individual",
        "mensual",
        "mes_cobro",
        "por_dia",
        "adelantados",
    ];
    const mostrarDesgloseArriba =
        activeTab === "por_dia" || activeTab === "mes_cobro";

    return (
        <div className="flex flex-col gap-5 h-full pb-20 md:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <HeaderHistorico esCapturista={esCapturista} />
                {activeTab === "resumen" && (
                    <TotalPill total={desgloseFinanciero.total} />
                )}
            </div>

            <GlassPanel size="lg">
                <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                    {!esCapturista && (
                        <TabButton
                            id="resumen"
                            label="Resumen General"
                            count={vecinos.length}
                            activeTab={activeTab}
                            onSelect={setActiveTab}
                        />
                    )}
                    {!esCapturista && (
                        <TabButton
                            id="individual"
                            label="Por Vecino"
                            activeTab={activeTab}
                            onSelect={setActiveTab}
                        />
                    )}
                    {!esCapturista && (
                        <TabButton
                            id="mensual"
                            label="Por Mes Pagado"
                            activeTab={activeTab}
                            onSelect={setActiveTab}
                        />
                    )}
                    {!esCapturista && (
                        <TabButton
                            id="mes_cobro"
                            label="Por Mes de Cobro"
                            activeTab={activeTab}
                            onSelect={setActiveTab}
                        />
                    )}
                    <TabButton
                        id="por_dia"
                        label="Por Día de Cobro"
                        activeTab={activeTab}
                        onSelect={setActiveTab}
                    />
                    {!esCapturista && (
                        <TabButton
                            id="adelantados"
                            label="Pagos Adelantados"
                            count={
                                pagos.filter((p) => p.mes > CURRENT_MONTH_ISO)
                                    .length
                            }
                            activeTab={activeTab}
                            onSelect={setActiveTab}
                        />
                    )}
                </div>

                <FiltrosPanel data={data} />
            </GlassPanel>

            <GlassPanel size="lg" className="!p-0">
                {loadingTabla && (
                    <div className="flex items-center justify-center py-10 gap-3">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-stone-500 text-sm font-medium">
                            Actualizando...
                        </span>
                    </div>
                )}

                {!loadingTabla && activeTab === "resumen" && (
                    <ResumenGeneral data={data} />
                )}

                {!loadingTabla && tablaTabs.includes(activeTab) && (
                    <div className="flex flex-col h-full min-h-[400px]">
                        <div className="px-6 py-5 border-b border-white/40 bg-white/20">
                            <h3 className="text-lg font-semibold text-stone-800">
                                {typeof TITULOS[activeTab] === "function"
                                    ? TITULOS[activeTab](
                                          activeTab === "mensual"
                                              ? selectedMonth
                                              : activeTab === "mes_cobro"
                                                ? selectedCollectionMonth
                                                : selectedDate,
                                      )
                                    : TITULOS[activeTab]}
                            </h3>
                        </div>

                        {mostrarDesgloseArriba && (
                            <DesgloseFinanciero
                                desglose={desgloseFinanciero}
                                periodoLabel={
                                    activeTab === "por_dia"
                                        ? formatDate(selectedDate)
                                        : formatMonth(selectedCollectionMonth)
                                }
                            />
                        )}

                        {activeTab === "individual" && !selectedVecino ? (
                            <div className="flex flex-col items-center justify-center p-16 text-center text-stone-400 flex-1">
                                <div className="text-6xl mb-4 opacity-50 drop-shadow-sm">
                                    👤
                                </div>
                                <div className="text-lg font-medium text-stone-600 mb-2">
                                    Seleccione un vecino
                                </div>
                                <div className="text-sm max-w-xs">
                                    Use los filtros de arriba para ver el
                                    historial de pagos de un residente
                                    específico.
                                </div>
                            </div>
                        ) : (
                            <TablaPagos
                                pagos={pagos}
                                sortConfig={sortConfig}
                                onSort={toggleSort}
                            />
                        )}

                        {pagos.length > 0 && (
                            <div className="px-6 py-10 border-t border-white/40 bg-gradient-to-b from-white/10 to-white/30 mt-auto flex flex-col items-center justify-center">
                                <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                                    Suma Recaudada
                                </p>
                                <p className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-orange-700 drop-shadow-md">
                                    {formatCurrency(
                                        pagos.reduce(
                                            (sum, p) =>
                                                sum + parseFloat(p.cantidad),
                                            0,
                                        ),
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </GlassPanel>
        </div>
    );
}

export default Historico;
