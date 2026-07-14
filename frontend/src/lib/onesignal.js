import OneSignal from "react-onesignal";

export async function initOneSignal() {
    await OneSignal.init({
        appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
    });
}

export async function linkOneSignalUser(vecinoId) {
    await OneSignal.login(String(vecinoId));
}

export async function unlinkOneSignalUser() {
    await OneSignal.logout();
}

export function promptPush() {
    OneSignal.Slidedown.promptPush();
}
