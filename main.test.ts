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
});
