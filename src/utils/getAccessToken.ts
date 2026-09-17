
export default async function getAccessToken(): Promise<string> {
    if (typeof chrome === "undefined" || !chrome.identity?.getAuthToken) {
        throw new Error("Sign in with Google in the GVault extension to use Drive folders.");
    }

    return requestAuthToken(true);
}

export async function refreshAccessToken(currentToken?: string): Promise<string> {
    if (currentToken && chrome.identity?.removeCachedAuthToken) {
        await new Promise<void>((resolve) => {
            chrome.identity.removeCachedAuthToken({ token: currentToken }, () => resolve());
        });
    }

    return requestAuthToken(true);
}

function requestAuthToken(interactive: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (result) => {
            const token = typeof result === "string" ? result : result?.token;
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError?.message || "Google sign-in was cancelled."));
                return;
            }
            resolve(token);
        });
    });
}
