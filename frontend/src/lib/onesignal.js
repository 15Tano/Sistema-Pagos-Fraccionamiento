import OneSignal from "react-onesignal";

let initPromise = null;

export function initOneSignal() {
    if (!initPromise) {
        initPromise = OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
        });
    }
    return initPromise;
}

export async function linkOneSignalUser(vecinoId) {
    await initPromise; // espera a que init() haya terminado de verdad
    await OneSignal.login(String(vecinoId));
}

export async function unlinkOneSignalUser() {
    await initPromise;
    await OneSignal.logout();
}

export function promptPush() {
    OneSignal.Slidedown.promptPush();
}
