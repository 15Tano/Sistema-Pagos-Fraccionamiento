import { useCallback, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { displayDoor } from "../model";
import { useControlAccess } from "../hooks/useControlAccess";
import { useReadingHistory } from "../hooks/useReadingHistory";
import ControlAccessView from "./ControlAccessView";

export default function ControlAccessPanel({ client, displayBase }) {
    const [query, setQuery] = useSearchParams();
    const location = useLocation();
    const [gate, setGate] = useState("");
    const [filters, setFilters] = useState({ card: "", source: "rt" });
    const displayMode = displayDoor(query.get("display"));
    const selectedDoor = displayMode || gate;
    const monitor = useControlAccess(client, { door: selectedDoor, card: "", source: "rt" }, displayMode ? 1 : 2);
    const historyActive = Boolean(filters.card || filters.source !== "rt");
    const history = useReadingHistory(client, monitor.agentId, { ...filters, door: selectedDoor },
        historyActive && !displayMode && monitor.online && !monitor.error?.clear);
    const closeDisplay = useCallback(() => {
        setQuery((current) => { const next = new URLSearchParams(current); next.delete("display"); return next; }, { replace: true });
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }, [setQuery]);
    const showDisplay = (door) => {
        setQuery({ display: door === "2" ? "salida" : "entrada" });
        document.documentElement.requestFullscreen?.().catch(() => {});
    };
    return <ControlAccessView monitor={monitor} gate={selectedDoor} onGate={setGate} history={history} historyActive={historyActive}
        filters={filters} onFilters={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        displayMode={displayMode} onDisplay={showDisplay} onCloseDisplay={closeDisplay}
        displayHref={(door) => `${displayBase || location.pathname}?display=${door === "2" ? "salida" : "entrada"}`} />;
}
