import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('WebView sandbox contract', () => {
    const mainTs = fs.readFileSync(path.join(__dirname, 'main.ts'), 'utf8');

    it('pins the cockpit webview to the persistent trader partition', () => {
        expect(mainTs).toContain("setAttribute('partition', partition)");
        expect(mainTs).toContain("this.plugin.settings.partition");
        expect(mainTs).toContain("partition: 'persist:trader-cockpit'");
    });

    it('disables node integration and enables context isolation explicitly', () => {
        expect(mainTs).toContain("setAttribute('nodeintegration', 'false')");
        expect(mainTs).toContain("setAttribute('contextisolation', 'true')");
    });

    it('does not import or contain node http server', () => {
        expect(mainTs).not.toContain("import * as http");
        expect(mainTs).not.toContain("http.createServer");
        expect(mainTs).not.toContain("this.receiverServer");
    });

    it('contains the writeNoteToVault helper and write-note IPC event channel', () => {
        expect(mainTs).toContain("writeNoteToVault");
        expect(mainTs).toContain("channel === 'write-note'");
    });

    it('contains the refresh reload action in views', () => {
        expect(mainTs).toContain("this.addAction('refresh-cw'");
        expect(mainTs).toContain(".reload()");
    });
});
