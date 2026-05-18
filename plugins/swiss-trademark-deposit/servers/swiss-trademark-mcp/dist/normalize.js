export function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, " ")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}
export function collapseWhitespace(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
export function toFtsQuery(value) {
    const tokens = normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 3)
        .slice(0, 12);
    return tokens.map((token) => `${token.replace(/"/g, "")}*`).join(" ");
}
export function toFtsAnyQuery(value) {
    const tokens = normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 3)
        .slice(0, 12);
    return tokens.map((token) => `${token.replace(/"/g, "")}*`).join(" OR ");
}
export function truncate(value, max = 500) {
    const text = collapseWhitespace(value);
    if (text.length <= max)
        return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
}
export function detectLanguageHint(value) {
    const text = ` ${normalizeText(value)} `;
    const deHits = [" und ", " oder ", " fuer ", " fur ", " mit ", " waren ", " dienstleistungen ", " geraete "];
    const frHits = [" et ", " ou ", " pour ", " avec ", " services ", " produits ", " conseils "];
    const itHits = [" per ", " con ", " servizi ", " prodotti "];
    const enHits = [" and ", " or ", " for ", " with ", " services ", " products "];
    const score = (hits) => hits.reduce((total, hit) => total + (text.includes(hit) ? 1 : 0), 0);
    const scores = [
        ["de", score(deHits)],
        ["fr", score(frHits)],
        ["it", score(itHits)],
        ["en", score(enHits)],
    ].sort((a, b) => b[1] - a[1]);
    return scores[0][1] > 0 ? scores[0][0] : null;
}
export function levenshtein(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (left === right)
        return 0;
    if (!left)
        return right.length;
    if (!right)
        return left.length;
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = Array.from({ length: right.length + 1 }, () => 0);
    for (let i = 1; i <= left.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        }
        for (let j = 0; j <= right.length; j += 1)
            previous[j] = current[j];
    }
    return previous[right.length];
}
export function similarity(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);
    const maxLength = Math.max(left.length, right.length);
    if (maxLength === 0)
        return 1;
    return Math.max(0, 1 - levenshtein(left, right) / maxLength);
}
