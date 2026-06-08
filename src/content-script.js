/*
 * https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
*/
const input = document.querySelector('input[type="file"]');
if (input) {
    input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        // Send files to background
        chrome.runtime.sendMessage({ type: 'UPLOAD_FILES', files, options: { readAs: 'dataURL', saveToStorage: true } }, (resp) => {
            console.log('Background response', resp);
        });
    });
}