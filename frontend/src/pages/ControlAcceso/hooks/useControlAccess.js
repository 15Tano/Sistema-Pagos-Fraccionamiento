import { useEffect, useRef, useState } from "react";
import { createMonitorSession, initialMonitor } from "../monitorSession";

export function useControlAccess(client, filters, maxPages = 2) {
    const key = JSON.stringify(filters);
    const [snapshot, setSnapshot] = useState(() => ({ key: "", ...initialMonitor() }));
    const [automatic, setAutomatic] = useState(true);
    const [online, setOnline] = useState(() => navigator.onLine !== false);
    const [tick, setTick] = useState(() => performance.now());
    const [localAnchor] = useState(() => ({ server: Date.now(), at: performance.now() }));
    const session = useRef(null);
    const automaticRef = useRef(automatic);
    useEffect(() => {
        const instance = createMonitorSession(client, JSON.parse(key), (value) => { setSnapshot({ ...value, key }); setTick(performance.now()); }, { maxPages });
        session.current = instance;
        instance.setEnabled(automaticRef.current);
        const visibility = () => {
            const available = navigator.onLine !== false;
            setOnline(available);
            setTick(performance.now());
            instance.setVisible(!document.hidden && available);
        };
        visibility(); instance.start();
        document.addEventListener("visibilitychange", visibility);
        window.addEventListener("online", visibility); window.addEventListener("offline", visibility);
        const clock = setInterval(() => { if (!document.hidden) setTick(performance.now()); }, 1000);
        return () => {
            instance.close(); clearInterval(clock);
            document.removeEventListener("visibilitychange", visibility);
            window.removeEventListener("online", visibility); window.removeEventListener("offline", visibility);
        };
    }, [client, key, maxPages]);
    useEffect(() => { automaticRef.current = automatic; session.current?.setEnabled(automatic); }, [automatic]);
    const value = snapshot.key === key ? snapshot : initialMonitor();
    const anchor = value.anchor || localAnchor;
    const now = anchor.server + tick - anchor.at;
    return { ...value, now, automatic, online, setAutomatic,
        refresh: () => session.current?.refresh(), loadOlder: () => session.current?.older() };
}
