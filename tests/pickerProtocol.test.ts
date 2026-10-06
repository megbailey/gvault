import { describe, expect, it } from "vitest";
import { onePickAuthUrl, onePickRedirectUri, parseOnePickRedirect } from "../src/utils/onePick";
import {
    folderItem,
    resultFromDriveItems,
    takeMatchingResult,
    vaultFileItems,
} from "../src/utils/pickerProtocol";

const authUrl = () => onePickAuthUrl({
    clientId: "client-id",
    redirectUri: onePickRedirectUri("mojepdfcjcohdhdhpaaeiaidmclioici"),
    mode: "folder",
    state: "req-1",
    fileId: "folder-1",
});

describe("OAuth file picker", () => {
    it("requests only drive.file and opens Google's picker for one folder", () => {
        const url = new URL(authUrl());
        expect(url.origin).toBe("https://accounts.google.com");
        expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
        expect(url.searchParams.get("trigger_onepick")).toBe("true");
        expect(url.searchParams.get("prompt")).toBe("consent");
        expect(url.searchParams.get("include_granted_scopes")).toBe("false");
        expect(url.searchParams.get("response_type")).toBe("token");
        expect(url.searchParams.get("allow_folder_selection")).toBe("true");
        expect(url.searchParams.get("file_ids")).toBe("folder-1");
        expect(url.searchParams.get("redirect_uri")).toBe("https://mojepdfcjcohdhdhpaaeiaidmclioici.chromiumapp.org");
        expect(url.searchParams.has("client_secret")).toBe(false);
        expect(url.searchParams.has("code_challenge")).toBe(false);
    });

    it("asks for several .gvault files and skips My Drive root as a preselected id", () => {
        const url = new URL(onePickAuthUrl({
            clientId: "client-id",
            redirectUri: onePickRedirectUri("mojepdfcjcohdhdhpaaeiaidmclioici"),
            mode: "files",
            state: "req-2",
            fileId: "root",
        }));
        expect(url.searchParams.get("allow_multiple")).toBe("true");
        expect(url.searchParams.get("mimetypes")).toBe("application/octet-stream");
        expect(url.searchParams.has("file_ids")).toBe(false);
        expect(url.searchParams.has("allow_folder_selection")).toBe(false);
    });

    it("reads the access token and chosen file ids from the redirect", () => {
        const redirect = "https://mojepdfcjcohdhdhpaaeiaidmclioici.chromiumapp.org#access_token=tok&picked_file_ids=file-3,file-4&state=req-2&token_type=Bearer&scope=https://www.googleapis.com/auth/drive.file";
        expect(parseOnePickRedirect(redirect)).toEqual({
            fileIds: ["file-3", "file-4"],
            code: undefined,
            token: "tok",
            state: "req-2",
        });

        const split = "https://mojepdfcjcohdhdhpaaeiaidmclioici.chromiumapp.org?picked_file_ids=folder-9&state=req-1#access_token=tok";
        expect(parseOnePickRedirect(split)).toMatchObject({
            fileIds: ["folder-9"],
            token: "tok",
            state: "req-1",
        });

        const codeOnly = "https://mojepdfcjcohdhdhpaaeiaidmclioici.chromiumapp.org?picked_file_ids=folder-9&code=auth-code&state=req-1";
        expect(parseOnePickRedirect(codeOnly).token).toBeUndefined();
        expect(parseOnePickRedirect("https://mojepdfcjcohdhdhpaaeiaidmclioici.chromiumapp.org?error=access_denied&state=req-1").cancelled).toBe(true);
    });
});

describe("picker results", () => {
    it("keeps chosen .gvault files and folders, and drops other files", () => {
        const record = resultFromDriveItems({
            requestId: "req-1",
            target: "upload-folder",
            mode: "folder",
        }, [
            { id: "folder-9", name: "Taxes", mimeType: "application/vnd.google-apps.folder" },
        ], 2_000);

        expect(record.items).toEqual([
            { id: "folder-9", name: "Taxes", mimeType: "application/vnd.google-apps.folder" },
        ]);
        expect(record).not.toHaveProperty("token");
        expect(folderItem(record.items ?? [])?.id).toBe("folder-9");

        const files = vaultFileItems([
            { id: "1", name: "notes.txt.gvault", mimeType: "application/octet-stream" },
            { id: "2", name: "photo.jpg", mimeType: "image/jpeg" },
            { id: "3", name: "Taxes", mimeType: "application/vnd.google-apps.folder" },
        ]);
        expect(files.files.map((file) => file.id)).toEqual(["1"]);
        expect(files.skipped).toBe(2);
        expect(takeMatchingResult(record, "upload-folder", 2_000)?.requestId).toBe("req-1");
        expect(takeMatchingResult(record, "decrypt-files", 2_000)).toBeNull();
    });
});
