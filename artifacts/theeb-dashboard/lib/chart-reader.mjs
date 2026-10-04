// ═══════════════════════════════════════════════════════════════
// THEEB Market Analyst — optional AI chart reading (server-side)
// The API key lives ONLY in the server environment (ANTHROPIC_API_KEY).
// The model reads a chart screenshot and returns a structured TRIL
// reading. It never sizes positions and never makes the decision:
// the deterministic engine does that.
// ═══════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

const STATUS = ['PASS', 'FAIL', 'UNCLEAR'];
const BIAS = ['BULLISH', 'BEARISH', 'RANGE', 'UNCLEAR'];

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['readable', 'timeframe', 'structure', 'direction', 'trend', 'raid', 'imbalance', 'location', 'notes'],
    properties: {
        readable: { type: 'boolean', description: 'false if the image is not a readable price chart' },
        timeframe: { type: 'string', description: 'Timeframe visible on the chart, or "unknown"' },
        structure: { type: 'string', enum: BIAS },
        direction: { type: 'string', enum: ['LONG', 'SHORT', 'NONE'] },
        trend: { type: 'string', enum: STATUS },
        raid: { type: 'string', enum: STATUS },
        imbalance: { type: 'string', enum: STATUS },
        location: { type: 'string', enum: STATUS },
        notes: { type: 'string', description: 'Max 2 short sentences, Arabic' },
    },
};

const SYSTEM = `You read NQ / MNQ futures chart screenshots for an ICT / SMC trader using the TRIL checklist.
Report only what is visible on the image. If something cannot be seen, answer UNCLEAR — never guess.
- structure: last market structure on the chart (BOS / MSS direction) → BULLISH, BEARISH, RANGE or UNCLEAR.
- direction: the setup direction the structure supports (LONG, SHORT or NONE).
- trend: PASS if the visible structure supports that direction, FAIL if it opposes it.
- raid: PASS if opposing liquidity was swept (sell-side for longs, buy-side for shorts) before the move.
- imbalance: PASS if an unmitigated fair value gap exists in the setup direction.
- location: PASS if price / entry is in discount (longs) or premium (shorts) of the dealing range.
Do not predict prices and do not give trade advice.`;

let client = null;
export function aiConfigured() { return Boolean(process.env.ANTHROPIC_API_KEY); }

/** Validate & normalise model output — anything off-schema becomes UNCLEAR. */
export function normalizeReading(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const pick = (v, allowed) => (allowed.includes(v) ? v : 'UNCLEAR');
    const readable = r.readable === true;
    return {
        readable,
        timeframe: typeof r.timeframe === 'string' ? r.timeframe.slice(0, 20) : 'unknown',
        structure: readable ? pick(r.structure, BIAS) : 'UNCLEAR',
        direction: readable && ['LONG', 'SHORT', 'NONE'].includes(r.direction) ? r.direction : 'NONE',
        trend: readable ? pick(r.trend, STATUS) : 'UNCLEAR',
        raid: readable ? pick(r.raid, STATUS) : 'UNCLEAR',
        imbalance: readable ? pick(r.imbalance, STATUS) : 'UNCLEAR',
        location: readable ? pick(r.location, STATUS) : 'UNCLEAR',
        notes: typeof r.notes === 'string' ? r.notes.slice(0, 400) : '',
    };
}

export async function readChart({ imageBase64, mediaType }) {
    if (!aiConfigured()) {
        const err = new Error('AI layer not configured (ANTHROPIC_API_KEY is not set on the server)');
        err.code = 'AI_NOT_CONFIGURED';
        throw err;
    }
    client = client || new Anthropic();
    const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{
            role: 'user',
            content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
                { type: 'text', text: 'Read this chart with the TRIL checklist and return the JSON object.' },
            ],
        }],
    });
    if (response.stop_reason === 'refusal') {
        const err = new Error('The model declined to read this image');
        err.code = 'AI_REFUSED';
        throw err;
    }
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let parsed;
    try { parsed = JSON.parse(text); } catch {
        const err = new Error('AI returned invalid JSON');
        err.code = 'AI_BAD_OUTPUT';
        throw err;
    }
    return { reading: normalizeReading(parsed), model: response.model };
}
