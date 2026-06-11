import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";

const prod = (process.argv[2] === "production");

const vaultPluginDir = "/mnt/workspace/MightyNight/MightyNight/.obsidian/plugins/obsidian-trader-cockpit";

function copyFiles() {
    try {
        if (!fs.existsSync(vaultPluginDir)) {
            fs.mkdirSync(vaultPluginDir, { recursive: true });
        }
        const filesToCopy = ["main.js", "preload.js", "manifest.json", "styles.css"];
        for (const file of filesToCopy) {
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, path.join(vaultPluginDir, file));
                console.log(`Copied ${file} to vault plugins.`);
            }
        }
    } catch (err) {
        console.error("Failed to copy files to vault:", err);
    }
}

const buildOptions = {
    entryPoints: ["main.ts", "preload.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        ...builtins
    ],
    format: "cjs",
    target: "es2020",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outdir: "./",
};

if (prod) {
    esbuild.build(buildOptions).then(() => {
        copyFiles();
    }).catch(() => process.exit(1));
} else {
    // Dev watch mode
    esbuild.context({
        ...buildOptions,
        plugins: [{
            name: 'copy-to-vault',
            setup(build) {
                build.onEnd(result => {
                    if (result.errors.length === 0) {
                        copyFiles();
                    }
                });
            }
        }]
    }).then(ctx => {
        ctx.watch();
    }).catch(() => process.exit(1));
}
