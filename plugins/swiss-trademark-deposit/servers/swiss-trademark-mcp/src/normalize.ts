export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function collapseWhitespace(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function toFtsQuery(value: string): string {
  const tokens = normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3)
    .slice(0, 12);
  return tokens.map((token) => `${token.replace(/"/g, "")}*`).join(" ");
}

export function toFtsAnyQuery(value: string): string {
  const tokens = normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3)
    .slice(0, 12);
  return tokens.map((token) => `${token.replace(/"/g, "")}*`).join(" OR ");
}

export function truncate(value: unknown, max = 500): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function detectLanguageHint(value: string): "fr" | "de" | "it" | "en" | null {
  const text = ` ${normalizeText(value)} `;
  // Avoid cognates such as "services", which is identical in French and
  // English. A false French classification could otherwise let an English-only
  // filing list pass without the warning required by the IPI language rule.
  const deHits = [
    " und ", " oder ", " fuer ", " fur ", " mit ", " waren ", " dienstleistungen ", " geraete ",
    " der ", " die ", " das ", " von ", " zur ", " zum ", " vermietung ", " beratung ", " entwicklung ",
  ];
  const frHits = [
    " et ", " ou ", " pour ", " avec ", " produits ", " conseils ", " de ", " des ", " du ", " la ",
    " le ", " les ", " location ", " formation ", " developpement ", " gestion ", " logiciel ", " logiciels ", " vente ",
  ];
  const itHits = [
    " per ", " con ", " servizi ", " prodotti ", " di ", " del ", " della ", " degli ", " noleggio ", " consulenza ",
  ];
  const enHits = [
    " and ", " or ", " for ", " with ", " products ", " of ", " the ", " software ", " consulting ",
    " management ", " retail ", " training ", " rental ", " development ",
  ];
  const score = (hits: string[]) => hits.reduce((total, hit) => total + (text.includes(hit) ? 1 : 0), 0);
  const scores = [
    ["de", score(deHits)] as const,
    ["fr", score(frHits)] as const,
    ["it", score(itHits)] as const,
    ["en", score(enHits)] as const,
  ].sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : null;
}

export function levenshtein(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
}

export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 1;
  return Math.max(0, 1 - levenshtein(left, right) / maxLength);
}
