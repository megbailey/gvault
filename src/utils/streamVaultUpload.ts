import { encryptVaultToSink, type VaultProgress } from "./fileVault";
import { startResumableUpload } from "./uploadFile";

export async function encryptAndStreamUploadVault(options: {
    file: File;
    passphrase: string;
    token: string;
    parentFolderId?: string;
    onProgress?: (progress: VaultProgress) => void;
}): Promise<void> {
    await encryptVaultToSink(
        options.file,
        options.passphrase,
        (total) => startResumableUpload({
            token: options.token,
            filename: options.file.name,
            total,
            parentFolderId: options.parentFolderId,
            onProgress: options.onProgress,
        }),
        options.onProgress
    );
}
