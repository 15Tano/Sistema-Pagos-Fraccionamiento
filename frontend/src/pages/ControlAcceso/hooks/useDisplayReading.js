import { useEffect, useEffectEvent, useState } from "react";
import { displayReading } from "../model";

// Admitir solo eventos frescos. Una vez presentados, conservarlos 8 s completos.
export function useDisplayReading(row, now, door, ready, catchingUp) {
    const [shown, setShown] = useState(null);
    const readClock = useEffectEvent(() => now);
    useEffect(() => {
        const at = readClock();
        const candidate = displayReading(row, at, { door, ready, catchingUp });
        const start = setTimeout(() => setShown(candidate ? { row: candidate, until: at + 8000 } : null), 0);
        const end = candidate ? setTimeout(() => setShown(null), 8000) : null;
        return () => { clearTimeout(start); if (end != null) clearTimeout(end); };
    }, [row, door, ready, catchingUp]);
    return ready && !catchingUp && shown && shown.row.id === row?.id && shown.row.door_id === door && now < shown.until ? shown.row : null;
}
