// Test runner that is loaded by VS Code's extension host (see runTest.ts)
import * as fs from 'fs';
import * as path from 'path';
import Mocha = require('mocha');

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true });
    for (const file of fs.readdirSync(__dirname)) {
        if (file.endsWith('.test.js')) {
            mocha.addFile(path.join(__dirname, file));
        }
    }
    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
            } else {
                resolve();
            }
        });
    });
}
