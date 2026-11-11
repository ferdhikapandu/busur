import { getStore } from "@netlify/blobs";

const store = getStore("busur-data");
const matchPrefix = "matches/";

class RequestError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

function response(statusCode, body) {
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}

async function parseBody(request) {
    try {
        return await request.json();
    } catch {
        throw new RequestError("Isi permintaan bukan JSON yang valid.");
    }
}

function boundedInteger(value, minimum, maximum, label) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new RequestError(`${label} harus antara ${minimum} sampai ${maximum}.`);
    }
    return parsed;
}

function validateMatch(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new RequestError("Data pertandingan tidak valid.");
    }
    if (typeof input.event_name !== "string") {
        throw new RequestError("Nama pertandingan wajib diisi.");
    }
    const eventName = input.event_name.trim();
    if (!eventName || Array.from(eventName).length > 100) {
        throw new RequestError("Nama pertandingan wajib diisi dan maksimal 100 karakter.");
    }

    const setCount = boundedInteger(input.set_count, 1, 12, "Jumlah set");
    const arrowsPerSet = boundedInteger(input.arrows_per_set, 1, 12, "Jumlah panah per set");
    if (!Array.isArray(input.archers) || input.archers.length < 1 || input.archers.length > 50) {
        throw new RequestError("Tambahkan minimal satu dan maksimal 50 pemanah.");
    }

    const archers = input.archers.map((archer) => {
        if (!archer || typeof archer !== "object" || Array.isArray(archer)
            || typeof archer.name !== "string" || !Array.isArray(archer.sets)) {
            throw new RequestError("Data pemanah tidak valid.");
        }
        const name = archer.name.trim();
        if (!name || Array.from(name).length > 80) {
            throw new RequestError("Nama setiap pemanah wajib diisi dan maksimal 80 karakter.");
        }
        if (archer.sets.length !== setCount) {
            throw new RequestError("Jumlah set pada skor tidak sesuai.");
        }

        const sets = archer.sets.map((scores) => {
            if (!Array.isArray(scores) || scores.length !== arrowsPerSet) {
                throw new RequestError("Jumlah panah pada set tidak sesuai.");
            }
            const validatedScores = scores.map((score) => {
                if (score === "M") return null;
                if (typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 10) {
                    return score;
                }
                if (typeof score === "string" && /^(?:0|[1-9]|10)$/.test(score)) {
                    return Number(score);
                }
                throw new RequestError("Nilai setiap panah harus M atau angka dari 0 sampai 10.");
            });
            return {
                scores: validatedScores,
                total: validatedScores.reduce((sum, score) => sum + (score ?? 0), 0),
            };
        });

        return {
            name,
            sets,
            total: sets.reduce((sum, set) => sum + set.total, 0),
        };
    });

    return {
        event_name: eventName,
        set_count: setCount,
        arrows_per_set: arrowsPerSet,
        archers,
    };
}

async function listMatches() {
    const { blobs } = await store.list({ prefix: matchPrefix });
    const matches = await Promise.all(blobs.map(({ key }) =>
        store.get(key, { type: "json" })
    ));
    return matches
        .filter((match) => match !== null)
        .sort((first, second) =>
            second.created_at.localeCompare(first.created_at) || second.id.localeCompare(first.id)
        );
}

export default async function handler(request) {
    try {
        if (request.method === "GET") {
            return response(200, {
                settings: { default_set_count: 3, default_arrows_per_set: 3 },
                matches: await listMatches(),
            });
        };

        if (request.method === "POST") {
            const input = await parseBody(request);
            const validated = validateMatch(input);
            const match = {
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                ...validated,
            };
            await store.setJSON(`${matchPrefix}${match.id}`, match);
            return response(201, { match });
        }

        if (request.method === "DELETE") {
            const input = await parseBody(request);
            if (typeof input.id !== "string" || !/^[\da-f-]{36}$/i.test(input.id)) {
                throw new RequestError("ID pertandingan tidak valid.");
            }
            const key = `${matchPrefix}${input.id}`;
            const existing = await store.get(key);
            if (existing === null) {
                throw new RequestError("Pertandingan tidak ditemukan atau sudah dihapus.", 404);
            }
            await store.delete(key);
            return response(200, { deleted: true });
        }

        return response(405, { error: "Metode permintaan tidak didukung." });
    } catch (error) {
        if (error instanceof RequestError) {
            return response(error.statusCode, { error: error.message });
        }
        console.error("Busur API error:", error);
        return response(500, { error: "Layanan penyimpanan sedang bermasalah. Coba lagi nanti." });
    }
}
