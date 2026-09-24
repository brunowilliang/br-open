// Gates de higiene de codigo deste repo (rodar: bun run hygiene).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

type Level = "error" | "warn";

type Finding = {
  rule: string;
  level: Level;
  file: string;
  line: number;
  detail: string;
};

// Sem argumento varre src + convex; com argumento(s), varre so os caminhos passados.
const ROOTS =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["src", "convex"];
const SOURCE_EXT: Record<string, true> = { ".ts": true, ".tsx": true };
const SKIPPED_DIR = /(^|\/)(_generated|generated|node_modules)$/;

// Card, rodada ou contagem de gate citados em comentario: narrativa, nao codigo.
const CARD_REF =
  /(IBX|RUL|BUG|PLN|DEC|BAC)-\d{2,}|\br\d{2,}\b|rodada \d|round \d+ /;
// Comentario de linha inteira: //, /*...*/, e o comentario JSX {/* ... */} (abertura e cauda).
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*)/;
const COMMENT_TAIL = /\*\/\}\s*$/;
const isCommentLine = (line: string) =>
  COMMENT_LINE.test(line) || COMMENT_TAIL.test(line);
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const INTERPOLATION = /\$\{[^}]*\}/g;
const USER_TEXT_DASH = /[A-Za-zÀ-ÿ0-9]\s-\s[A-Za-zÀ-ÿ0-9]/;
const RENDER_JSX_FN =
  /function\s+(render[A-Z]\w*)\s*\([^)]*\)[^{]*\{[^}]*?return\s*\(?\s*</gs;
const RENDER_JSX_ARROW =
  /const\s+(render[A-Z]\w*)\s*=\s*\([^)]*\)\s*=>\s*\(?\s*</gs;
const NAMED_CLASS_CONST =
  /const\s+([A-Za-z_$][\w$]*(?:STYLE|STYLES|CLASSES|CLASS_NAME|CLASSNAMES)\w*)\s*(?::[^=]+)?=\s*["'`]/;
const TEST_FILE = /\/tests\/|\.test\.tsx?$/;

// Legado tolerado (RUL-0012: arquivo antigo com render* nao se copia, mas nao se reescreve de graca).
const RENDER_JSX_LEGACY: Record<string, string[]> = {
  "src/app/(private)/(tabs)/competitions.tsx": ["renderCompetitionItem"],
  "src/app/(private)/(tabs)/search.tsx": ["renderListEmptyComponent"],
  "src/app/(private)/leagues/[leagueId]/challenges.tsx": [
    "renderChallengeItem",
  ],
  "src/app/(private)/leagues/[leagueId]/ranking.tsx": [
    "renderViewerActions",
    "renderPlayerMedia",
  ],
  "src/app/(private)/settings/leagues/index.tsx": ["renderListEmptyComponent"],
};

const MIN_COMMENT_LINES = 40;
const MAX_COMMENT_RATIO = 0.12;

function walk(target: string, out: string[] = []): string[] {
  if (statSync(target).isFile()) {
    if (SOURCE_EXT[extname(target)]) {
      out.push(target);
    }
    return out;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const path = join(target, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIR.test(path)) {
        walk(path, out);
      }
      continue;
    }
    if (SOURCE_EXT[extname(entry.name)]) {
      out.push(path);
    }
  }
  return out;
}

// Texto do comentario de FIM DE LINHA (o "// ..." que nao faz parte de uma URL).
const TRAILING_COMMENT = /(^|[^:])\/\//;
const trailingComment = (line: string): string => {
  const match = TRAILING_COMMENT.exec(line);
  if (!match) {
    return "";
  }
  return line.slice(match.index + match[0].length - 2);
};

// Marca cada linha que e comentario, inclusive o CORPO de um comentario JSX multi-linha.
function commentFlags(lines: string[]): boolean[] {
  let insideJsx = false;
  return lines.map((line) => {
    const opens = line.includes("{/*");
    const closes = line.includes("*/}");
    const flag = insideJsx || opens || isCommentLine(line);
    if (opens && !closes) {
      insideJsx = true;
    }
    if (closes) {
      insideJsx = false;
    }
    return flag;
  });
}

function checkComments(
  file: string,
  lines: string[],
  flags: boolean[],
  out: Finding[]
): void {
  let commentLines = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trailing = flags[index] ? "" : trailingComment(line);
    if (flags[index]) {
      commentLines += 1;
    }
    const target = flags[index] ? line : trailing;
    if (target && CARD_REF.test(target)) {
      out.push({
        detail: line.trim().slice(0, 100),
        file,
        level: "error",
        line: index + 1,
        rule: "comment-card-ref",
      });
    }
  }
  const ratio = commentLines / lines.length;
  if (commentLines > MIN_COMMENT_LINES && ratio > MAX_COMMENT_RATIO) {
    out.push({
      detail: `${commentLines} comentarios em ${lines.length} linhas (${Math.round(ratio * 100)}%)`,
      file,
      level: "warn",
      line: 1,
      rule: "comment-ratio",
    });
  }
}

function checkUserText(
  file: string,
  lines: string[],
  flags: boolean[],
  out: Finding[]
): void {
  if (TEST_FILE.test(file)) {
    return;
  }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (flags[index]) {
      continue;
    }
    for (const match of line.matchAll(STRING_LITERAL)) {
      const text = (match[2] ?? "").replace(INTERPOLATION, "X");
      if (text.includes("://") || text.includes("@")) {
        continue;
      }
      if (USER_TEXT_DASH.test(text)) {
        out.push({
          detail: text.trim().slice(0, 100),
          file,
          level: "error",
          line: index + 1,
          rule: "user-text-dash",
        });
      }
    }
  }
}

function checkRenderJsx(file: string, source: string, out: Finding[]): void {
  const allowed = RENDER_JSX_LEGACY[file] ?? [];
  for (const match of [
    ...source.matchAll(RENDER_JSX_FN),
    ...source.matchAll(RENDER_JSX_ARROW),
  ]) {
    const name = match[1] ?? "";
    if (allowed.includes(name)) {
      continue;
    }
    out.push({
      detail: `${name}() devolve JSX (RUL-0012: JSX inline no return)`,
      file,
      level: "error",
      line: 1,
      rule: "render-jsx",
    });
  }
}

function checkNamedClassConst(
  file: string,
  lines: string[],
  out: Finding[]
): void {
  for (let index = 0; index < lines.length; index += 1) {
    const match = NAMED_CLASS_CONST.exec(lines[index] ?? "");
    if (match) {
      out.push({
        detail: `${match[1]} guarda className (RUL-0026: classe direto no cn/className)`,
        file,
        level: "error",
        line: index + 1,
        rule: "named-class-const",
      });
    }
  }
}

const findings: Finding[] = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");
    const flags = commentFlags(lines);
    checkComments(file, lines, flags, findings);
    checkUserText(file, lines, flags, findings);
    checkNamedClassConst(file, lines, findings);
    checkRenderJsx(file, source, findings);
  }
}

const errors = findings.filter((finding) => finding.level === "error");
const warnings = findings.filter((finding) => finding.level === "warn");

for (const finding of findings) {
  process.stdout.write(
    `${finding.level === "error" ? "ERRO " : "AVISO"} ${finding.rule} ${finding.file}:${finding.line} ${finding.detail}\n`
  );
}
process.stdout.write(
  `\nhigiene: ${errors.length} erro(s), ${warnings.length} aviso(s) em ${ROOTS.join(" + ")}\n`
);
process.exitCode = errors.length > 0 ? 1 : 0;
