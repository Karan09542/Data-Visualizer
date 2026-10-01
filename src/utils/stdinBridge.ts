/**
 * Answers for code blocked in input() / prompt(). The code's worker waits on a synchronous
 * request to /api/stdin-get; the service worker holds it open (see sw.ts) until the console sends
 * the answer. The service worker is only registered in production builds, so on the dev server
 * the same endpoint is served by Vite instead (see the stdin-bridge plugin in vite.config.ts).
 */

/** Whether anything will answer /api/stdin-get. */
export const stdinBridgeAvailable = () =>
    !!navigator.serviceWorker?.controller || import.meta.env.DEV;

function send(message: { type: "STDIN_SUBMIT" | "STDIN_CANCEL"; sessionId: string; value?: any }) {
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
        controller.postMessage(message);
    } else if (import.meta.env.DEV) {
        fetch("/api/stdin-submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
        }).catch((err) => console.warn("[stdin]: Could not send the answer to the dev server", err));
    }
}

export const submitStdin = (sessionId: string, value: any) =>
    send({ type: "STDIN_SUBMIT", sessionId, value });

export const cancelStdin = (sessionId: string) =>
    send({ type: "STDIN_CANCEL", sessionId });
