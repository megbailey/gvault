import { type VaultProgress } from "./fileVault";
import { ensureDriveFolderPath } from "./driveFolder";
import { parentFolderSegments, relativePathForFile } from "./drivePage";
import { encryptAndStreamUploadVault } from "./streamVaultUpload";

export async function encryptAndUploadFiles(options: {
    files: File[];
    relativePaths?: string[];
    passphrase: string;
    token: string;
    destinationFolderId: string;
    onProgress?: (progress: VaultProgress) => void;
    onFile?: (index: number, total: number) => void;
}): Promise<string[]> {
    const folderCache = new Map<string, string>();
    const uploadedNames: string[] = [];

    for (let index = 0; index < options.files.length; index++) {
        const file = options.files[index];
        const relativePath = relativePathForFile(file, options.relativePaths?.[index]);
        options.onFile?.(index, options.files.length);
        const parentId = await ensureDriveFolderPath(
            options.token,
            options.destinationFolderId,
            parentFolderSegments(relativePath),
            folderCache
        );
        await encryptAndStreamUploadVault({
            file,
            passphrase: options.passphrase,
            token: options.token,
            parentFolderId: parentId,
            onProgress: options.onProgress,
        });
        uploadedNames.push(`${file.name}.gvault`);
    }

    return uploadedNames;
}
