import { useCallback, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { displayDoor } from "../model";
import { EMPTY_READING_FILTERS, hasReadingFilters } from "../readingFilters";
import { useControlAccess } from "../hooks/useControlAccess";
import { useReadingHistory } from "../hooks/useReadingHistory";
import ControlAccessView from "./ControlAccessView";
import HistoryAccessSetting from "./HistoryAccessSetting";

export default function ControlAccessPanel({ client, displayBase }) {
    const [query, setQuery] = useSearchParams();
    const location = useLocation();
    const [gate, setGate] = useState("");
    const [filters, setFilters] = useState({ ...EMPTY_READING_FILTERS });
    const displayMode = displayDoor(query.get("display"));
    const selectedDoor = displayMode || gate;
    const monitor = useControlAccess(client, { door: selectedDoor, card: "", source: "rt" }, displayMode ? 1 : 2);
    const canViewHistory = monitor.permissions.can_view_history;
    const historyActive = canViewHistory && hasReadingFilters(filters);
    const history = useReadingHistory(client, monitor.agentId, filters,
        historyActive && !displayMode && monitor.online && !monitor.error?.clear);
    const closeDisplay = useCallback(() => {
        setQuery((current) => { const next = new URLSearchParams(current); next.delete("display"); return next; }, { replace: true });
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }, [setQuery]);
    const showDisplay = (door) => {
        setQuery({ display: door === "2" ? "salida" : "entrada" });
        document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const updateFilters = (patch) => {
        const next = { ...filters, ...patch };
        if (JSON.stringify(next) === JSON.stringify(filters)) {
            if (historyActive) history.refresh(); else monitor.refresh();
        } else setFilters(next);
    };
    return <ControlAccessView monitor={monitor} gate={selectedDoor} onGate={setGate} history={history} historyActive={historyActive}
        canViewHistory={canViewHistory} adminSettings={monitor.permissions.can_manage_history && typeof client.settings === "function" && typeof client.updateSettings === "function" ? <HistoryAccessSetting client={client} /> : null}
        filters={filters} onFilters={updateFilters}
        displayMode={displayMode} onDisplay={showDisplay} onCloseDisplay={closeDisplay}
        displayHref={(door) => `${displayBase || location.pathname}?display=${door === "2" ? "salida" : "entrada"}`} />;
}
