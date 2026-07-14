import { useEffect, useState } from "react";
import OneSignal from "react-onesignal";
import { promptPush } from "../lib/onesignal";

function NotificationBanner() {
    const [isSubscribed, setIsSubscribed] = useState(true); // true por default para no parpadear

    useEffect(() => {
        const checkSubscription = () => {
            setIsSubscribed(OneSignal.User.PushSubscription.optedIn ?? false);
        };

        checkSubscription();

        OneSignal.User.PushSubscription.addEventListener(
            "change",
            checkSubscription,
        );
        return () => {
            OneSignal.User.PushSubscription.removeEventListener(
                "change",
                checkSubscription,
            );
        };
    }, []);

    if (isSubscribed) return null;

    return (
        <div className="glass-card p-4 mb-4 flex items-center justify-between">
            <div>
                <p className="font-semibold text-[#1c1917]">
                    Activa las notificaciones
                </p>
                <p className="text-sm text-[#1c1917]/70">
                    Entérate al instante de avisos y estado de tus pagos.
                </p>
            </div>
            <button
                onClick={promptPush}
                className="px-4 py-2 rounded-full bg-[#f97316] text-white font-medium"
            >
                Activar
            </button>
        </div>
    );
}

export default NotificationBanner;
