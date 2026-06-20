
export default async function getAccessToken() {
    return new Promise((resolve,reject) => {
        chrome.identity.getAuthToken({ interactive:true }, token => {
            if(chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(token);
        });
    });
}
