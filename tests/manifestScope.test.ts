import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

describe("OAuth scope", () => {
    it("requests only drive.file and does not call Google's token endpoint", () => {
        expect(manifest.oauth2.scopes).toEqual([
            "https://www.googleapis.com/auth/drive.file",
        ]);
        expect(manifest.host_permissions).toEqual([
            "https://www.googleapis.com/*",
            "https://drive.google.com/*",
        ]);
        expect(manifest.externally_connectable).toBeUndefined();
    });
});