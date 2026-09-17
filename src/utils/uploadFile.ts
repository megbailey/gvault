import { GVaultFile } from "../GVaultFile";

async function uploadFile( token: string, file: GVaultFile ) {
    const metadata = {
        name: `${file.filename}.gvault.json`,
        mimeType: 'application/json'
        //parents: [folderId] // The upload destination selected by the user
    };
    
    // Initiatialize a resumable upload session
    const initSession = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        {
            method:'POST',
            headers: { 
                Authorization:`Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': 'application/json' // Tells Google what the payload will be
            },
            body: JSON.stringify( metadata )
        }
    );

    if ( !initSession.ok ) {
        throw new Error(`Failed to initiate session: ${initSession.statusText}`);
    }

    // Google should provide back a unique tracking URL just for this upload
    const sessionURI = initSession.headers.get('Location');
    if ( !sessionURI ) {
        throw new Error('Did not receive a valid upload session URI from Google.');
    }

    // Continue request with the user-provided data using the session URI
    // Resumable data transfers strictly require PUT 
    // Note: Authorization header is NOT required here; the session URL is already authenticated!
    const uploadResponse = await fetch(sessionURI, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: file.toJsonString()
    });

    if ( !uploadResponse.ok ) {
        throw new Error(`Data upload failed: ${uploadResponse.statusText}`);
    }

    return await uploadResponse.json();
}

export default uploadFile;
