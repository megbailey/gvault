import getAccessToken from "./getAccessToken";
import {
    deleteDriveFile,
    listDriveVaultTree,
    openDriveFileStream,
    type DriveFile,
    type DriveFolder,
} from "./driveFolder";
import { unpackVaultFromByteStream, type VaultProgress } from "./fileVault";
import { loadSettings } from "./settings";
import { decryptedOutputPath, saveDecryptedFile, triggerLocalDownload } from "./localSave";
import { MAX_DRIVE_FOLDER_FILES } from "./limits";

export type DownloadDecryptRequest =
    | { kind: "files"; files: DriveFile[] }
    | { kind: "folder"; folder: DriveFolder };

export type DownloadDecryptResult = {
    message: string;
    isError: boolean;
    clearSelection: boolean;
};

async function decryptVaultStream(
    stream: ReadableStream<Uint8Array>,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    try {
        return await unpackVaultFromByteStream(stream, passphrase, onProgress);
    } catch (error) {
        if (error instanceof Error && (
            error.message === "Unsupported vault file version."
            || error.message === "The passphrase was incorrect. Please try again."
        )) {
            throw error;
        }
        throw new Error("That file is not a valid .gvault package.");
    }
}

export async function downloadAndDecrypt(
    request: DownloadDecryptRequest,
    passphrase: string,
    hooks: {
        onProgress?: (progress: VaultProgress) => void;
        onFile?: (index: number, total: number) => void;
    } = {}
): Promise<DownloadDecryptResult> {
    const token = await getAccessToken();
    const settings = await loadSettings();
    const { onProgress, onFile } = hooks;

    if (request.kind === "files") {
        const pickedFiles = request.files;
        if (pickedFiles.length === 0) {
            throw new Error("Choose a .gvault file first.");
        }

        onFile?.(0, pickedFiles.length);
        let deleteFailures = 0;
        const decryptedNames: string[] = [];

        for (let index = 0; index < pickedFiles.length; index++) {
            const picked = pickedFiles[index];
            onFile?.(index, pickedFiles.length);
            onProgress?.({ phase: "download", completed: 0, total: 1 });
            const stream = await openDriveFileStream(token, picked.id);
            onProgress?.({ phase: "download", completed: 1, total: 1 });
            const result = await decryptVaultStream(stream, passphrase, onProgress);
            if (pickedFiles.length === 1) {
                triggerLocalDownload(result.filename, result.data);
            } else {
                await saveDecryptedFile(result.filename, result.data);
            }
            decryptedNames.push(result.filename);

            if (settings.deleteEncryptedFileAfterDownload) {
                try {
                    await deleteDriveFile(token, picked.id);
                } catch (deleteError) {
                    deleteFailures += 1;
                    if (pickedFiles.length === 1) {
                        return {
                            isError: true,
                            clearSelection: false,
                            message: `Downloaded and decrypted ${result.filename}, but the encrypted Drive file could not be deleted.`
                                + (deleteError instanceof Error ? ` ${deleteError.message}` : ""),
                        };
                    }
                }
            }
        }

        if (settings.deleteEncryptedFileAfterDownload && deleteFailures > 0) {
            return {
                isError: true,
                clearSelection: false,
                message: `Downloaded and decrypted ${decryptedNames.length} files, but ${deleteFailures} encrypted Drive file${deleteFailures === 1 ? "" : "s"} could not be deleted.`,
            };
        }

        if (settings.deleteEncryptedFileAfterDownload) {
            return {
                isError: false,
                clearSelection: true,
                message: pickedFiles.length === 1
                    ? `Downloaded and decrypted ${decryptedNames[0]}. The encrypted Drive file was deleted.`
                    : `Downloaded and decrypted ${decryptedNames.length} files. The encrypted Drive files were deleted.`,
            };
        }

        return {
            isError: false,
            clearSelection: false,
            message: pickedFiles.length === 1
                ? `Downloaded and decrypted ${decryptedNames[0]}.`
                : `Downloaded and decrypted ${decryptedNames.length} files.`,
        };
    }

    const entries = await listDriveVaultTree(token, request.folder.id, {
        maxFiles: MAX_DRIVE_FOLDER_FILES,
    });
    if (entries.length === 0) {
        throw new Error("No .gvault files were found in that folder.");
    }

    onFile?.(0, entries.length);
    let deleteFailures = 0;

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        onFile?.(index, entries.length);
        onProgress?.({ phase: "download", completed: 0, total: 1 });
        const stream = await openDriveFileStream(token, entry.file.id);
        onProgress?.({ phase: "download", completed: 1, total: 1 });
        const result = await decryptVaultStream(stream, passphrase, onProgress);
        const outputPath = decryptedOutputPath(
            request.folder.name,
            entry.relativePath,
            result.filename
        );
        await saveDecryptedFile(outputPath, result.data);

        if (settings.deleteEncryptedFileAfterDownload) {
            try {
                await deleteDriveFile(token, entry.file.id);
            } catch {
                deleteFailures += 1;
            }
        }
    }

    if (settings.deleteEncryptedFileAfterDownload && deleteFailures > 0) {
        return {
            isError: true,
            clearSelection: false,
            message: `Downloaded and decrypted ${entries.length} files from ${request.folder.name}, but ${deleteFailures} encrypted Drive file${deleteFailures === 1 ? "" : "s"} could not be deleted.`,
        };
    }

    return {
        isError: false,
        clearSelection: settings.deleteEncryptedFileAfterDownload,
        message: `Downloaded and decrypted ${entries.length} files from ${request.folder.name}.`,
    };
}
