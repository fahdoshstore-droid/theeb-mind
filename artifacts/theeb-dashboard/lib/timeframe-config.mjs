// Timeframe configuration for LIVE = result of the latest Edge validation on real NQ data.
//   THEEB_TF_VALIDATION_PATH   validation report (default ./data/timeframe-validation.json)
//   THEEB_TF_STRUCTURE / THEEB_TF_EXECUTION   optional explicit choice — still gated by that config's evidence
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timeframesFromValidation } from './edge-stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VALIDATION_PATH = path.join(here, '..', 'data', 'timeframe-validation.json');
let cache = { path: null, mtime: 0, report: null };

export async function loadValidationReport(env = process.env) {
    const file = env.THEEB_TF_VALIDATION_PATH || DEFAULT_VALIDATION_PATH;
    try {
        const st = await stat(file);
        if (cache.path === file && cache.mtime === st.mtimeMs) return cache.report;
        const report = JSON.parse(await readFile(file, 'utf8'));
        cache = { path: file, mtime: st.mtimeMs, report };
        return report;
    } catch {
        return null;
    }
}

export async function currentTimeframes(env = process.env) {
    const report = await loadValidationReport(env);
    const tf = timeframesFromValidation(report, { structure: env.THEEB_TF_STRUCTURE, execution: env.THEEB_TF_EXECUTION });
    return Object.assign(tf, { validatedAt: report ? report.generatedAt : null, dataSpan: report ? report.data : null });
}

export function neededTimeframes(tf) {
    return [...new Set([tf.structure, tf.execution].filter(Boolean))];
}
