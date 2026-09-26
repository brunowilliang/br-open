#!/usr/bin/env node
/**
 * DEV-only seed (kindred-yak-142) for the BUG-0033 repro scenario (IBX-0051):
 * (1) "Copa Teste 64 Dev" started (drawn -> ongoing, 64-entry bracket);
 * (2) a small drawn tournament "Copa Dracena 8 Dev" (8 active entries);
 * (3) real login-able accounts (better-auth credential) for the QA.
 * (4) IBX-0074 r27: FEMALE credential accounts with a defined username +
 *     gender, so the partner search can be exercised in Duplas Femininas /
 *     Mistas (the r25 gate only offers the gender the category demands, and
 *     the DEV had a single female profile, with no username at all).
 *
 * Accounts go through the real HTTP signUp flow (hashes stay in better-auth's
 * hands); membership/preference follow the data-import pattern, and the
 * female profiles are written through the app's own `player.profile.upsert`.
 * NEVER touches PROD: aborts
 * unless .env.local points to kindred-yak-142.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// ---------------------------------------------------------------------------
// Env guard: DEV only.
// ---------------------------------------------------------------------------
const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ])
);
const CONVEX_URL = env.EXPO_PUBLIC_CONVEX_URL;
const SITE_URL = env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (
  !(
    CONVEX_URL?.includes("kindred-yak-142") &&
    SITE_URL?.includes("kindred-yak-142")
  )
) {
  throw new Error(
    `ABORT: .env.local does not point to DEV (kindred-yak-142): ${CONVEX_URL}`
  );
}

const ORG_ID = "m1739ce37xf85jjjp40shgynnx8d513f"; // "Org do Bruno"
const BIG_TOURNAMENT_ID = "r579rpsjebz69d9ahew19samz58d55gs"; // Copa Teste 64 Dev
const SMALL_TOURNAMENT_NAME = "Copa Dracena 8 Dev";
const PASSWORD = "Dracena2026";
const OUT = "/tmp/seed-copa8-dev";
mkdirSync(OUT, { recursive: true });

const ORGANIZER = {
  email: "gustavo.lima@bropen.local",
  name: "Gustavo Lima",
  username: "gustavo.lima",
};
const PLAYERS = [
  {
    email: "pedro.souza@bropen.local",
    name: "Pedro Souza",
    username: "pedro.souza",
  },
  {
    email: "lucas.martins@bropen.local",
    name: "Lucas Martins",
    username: "lucas.martins",
  },
  {
    email: "joao.ribeiro@bropen.local",
    name: "Joao Ribeiro",
    username: "joao.ribeiro",
  },
  {
    email: "felipe.costa@bropen.local",
    name: "Felipe Costa",
    username: "felipe.costa",
  },
  {
    email: "mateus.oliveira@bropen.local",
    name: "Mateus Oliveira",
    username: "mateus.oliveira",
  },
  {
    email: "thiago.almeida@bropen.local",
    name: "Thiago Almeida",
    username: "thiago.almeida",
  },
  {
    email: "rafael.pereira@bropen.local",
    name: "Rafael Pereira",
    username: "rafael.pereira",
  },
  {
    email: "caio.nogueira@bropen.local",
    name: "Caio Nogueira",
    username: "caio.nogueira",
  },
];

// Conta de teste FEMININA do r27 (report): primeira da lista. Usernames
// agrupados por prefixo inicial (ca/ma/pa) de propósito — a busca por
// prefixo devolve VÁRIAS jogadoras, como o seed masculino já faz.
const FEMALE_TEST_ACCOUNT = "camila.rocha@bropen.local";
const FEMALE_PLAYERS = [
  {
    email: FEMALE_TEST_ACCOUNT,
    name: "Camila Rocha",
    nickname: "Cami",
    username: "camila.rocha",
  },
  {
    email: "carolina.mendes@bropen.local",
    name: "Carolina Mendes",
    nickname: "Carol",
    username: "carolina.mendes",
  },
  {
    email: "carla.fontes@bropen.local",
    name: "Carla Fontes",
    nickname: "Carla",
    username: "carla.fontes",
  },
  {
    email: "mariana.alves@bropen.local",
    name: "Mariana Alves",
    nickname: "Mari",
    username: "mariana.alves",
  },
  {
    email: "marina.prado@bropen.local",
    name: "Marina Prado",
    nickname: "Marina",
    username: "marina.prado",
  },
  {
    email: "marcela.duarte@bropen.local",
    name: "Marcela Duarte",
    nickname: "Marcela",
    username: "marcela.duarte",
  },
  {
    email: "patricia.nunes@bropen.local",
    name: "Patricia Nunes",
    nickname: "Paty",
    username: "patricia.nunes",
  },
  {
    email: "paula.souza@bropen.local",
    name: "Paula Souza",
    nickname: "Paula",
    username: "paula.souza",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function convex(args) {
  return execFileSync("bunx", ["convex", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180_000,
  });
}
function inlineQuery(query) {
  const out = convex(["run", "--inline-query", query]);
  return JSON.parse(out.trim());
}
function convexImport(table, file) {
  execFileSync(
    "bunx",
    ["convex", "import", "--table", table, "--append", file],
    { cwd: process.cwd(), encoding: "utf8", stdio: "inherit", timeout: 300_000 }
  );
}
function writeJsonl(name, rows) {
  const file = `${OUT}/${name}.jsonl`;
  writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
  console.log(`${name}: ${rows.length} docs -> ${file}`);
  return file;
}
function cookiesFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}
function authFetch(path, { method = "POST", body, cookie } = {}) {
  return fetch(`${SITE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "content-type": "application/json",
      // `buildTrustedOrigins` (convex/lib/auth-trusted-origins.ts) exige uma
      // origem confiável: sem header o better-auth devolve 403
      // MISSING_OR_NULL_ORIGIN e o re-run do seed morria no sign-in.
      origin: SITE_URL,
      ...(cookie ? { cookie } : {}),
    },
    method,
  });
}
async function accountSession(account) {
  const attempt = async (path) => {
    const res = await authFetch(path, {
      body: {
        email: account.email,
        name: account.name,
        password: PASSWORD,
        username: account.username,
      },
    });
    return res;
  };
  let res = await attempt("/api/auth/sign-up/email");
  let created = true;
  if (res.status !== 200) {
    const text = await res.text();
    res = await authFetch("/api/auth/sign-in/email", {
      body: { email: account.email, password: PASSWORD },
    });
    created = false;
    if (res.status !== 200) {
      throw new Error(
        `auth failed for ${account.email}: ${res.status} ${await res.text()} (sign-up said: ${text.slice(0, 200)})`
      );
    }
  }
  const cookie = cookiesFrom(res);
  if (!cookie) {
    throw new Error(`no session cookie returned for ${account.email}`);
  }
  return { cookie, created };
}
async function convexToken(cookie) {
  const res = await authFetch("/api/auth/convex/token", {
    cookie,
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`convex token failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const token = data.token ?? data;
  if (typeof token !== "string" || token.length < 20) {
    throw new Error(
      `unexpected convex token payload: ${JSON.stringify(data).slice(0, 200)}`
    );
  }
  return token;
}

// ---------------------------------------------------------------------------
// 1) Accounts (real credential accounts via HTTP)
// ---------------------------------------------------------------------------
console.log("== 1) contas ==");
for (const account of [ORGANIZER, ...PLAYERS]) {
  const { created } = await accountSession(account);
  console.log(
    `  ${account.email}: ${created ? "criada" : "ja existia (senha ok)"}`
  );
}

// ---------------------------------------------------------------------------
// 1b) Contas + perfis FEMININOS (IBX-0074 r27)
// ---------------------------------------------------------------------------
// O gate de gênero só oferece parceiras do gênero que a categoria exige, e o
// DEV tinha UM perfil feminino, sem username (invisível pra busca). Perfil
// escrito pelo caminho do app (`player.profile.upsert`), nunca por escrita
// direta na tabela; sign-up HTTP mantém o hash da senha no better-auth.
console.log("== 1b) contas e perfis femininos ==");
for (const account of FEMALE_PLAYERS) {
  const { cookie, created } = await accountSession(account);
  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(await convexToken(cookie));
  await client.mutation(anyApi.player.profile.upsert, {
    avatarStorageId: null,
    fullName: account.name,
    gender: "Feminino",
    nickname: account.nickname,
    phone: null,
  });
  console.log(
    `  ${account.username}: ${created ? "conta criada" : "conta ja existia"} + perfil Feminino`
  );
}

const femaleReadBack = inlineQuery(
  `const wanted = ${JSON.stringify(FEMALE_PLAYERS.map((a) => a.email))};
   const out = [];
   for await (const u of ctx.db.query("user")) {
     if (!wanted.includes(u.email)) continue;
     let profile = null;
     for await (const p of ctx.db.query("playerProfile")) {
       if (p.userId === u._id) profile = p;
     }
     out.push({ email: u.email, gender: profile?.gender ?? null, name: profile?.fullName ?? null, username: u.username ?? null });
   }
   return out.sort((a, b) => (a.username < b.username ? -1 : 1));`
);
console.log("  read-back:");
for (const row of femaleReadBack) {
  console.log(
    `    ${row.username} | ${row.name} | ${row.gender} | ${row.email}`
  );
}
if (femaleReadBack.length !== FEMALE_PLAYERS.length) {
  throw new Error(
    `read-back feminino incompleto: ${femaleReadBack.length}/${FEMALE_PLAYERS.length}`
  );
}
const badFemale = femaleReadBack.filter(
  (row) => row.gender !== "Feminino" || !row.username
);
if (badFemale.length > 0) {
  throw new Error(`perfil feminino invalido: ${JSON.stringify(badFemale)}`);
}

// ---------------------------------------------------------------------------
// 2) Organizer membership + active actor (data import)
// ---------------------------------------------------------------------------
console.log("== 2) membership + preferencia do organizador ==");
const organizerUser = inlineQuery(
  `const out = []; for await (const u of ctx.db.query("user")) { if (u.email === "${ORGANIZER.email}") out.push({ _id: u._id, email: u.email }); } return out;`
);
if (organizerUser.length !== 1) {
  throw new Error(`organizer user not found: ${organizerUser.length}`);
}
const organizerUserId = organizerUser[0]._id;

const existingMember = inlineQuery(
  `const out = []; for await (const m of ctx.db.query("member")) { if (m.organizationId === "${ORG_ID}" && m.userId === "${organizerUserId}") out.push(m); } return out;`
);
if (existingMember.length === 0) {
  const file = writeJsonl("member", [
    {
      createdAt: Date.now(),
      organizationId: ORG_ID,
      role: "admin",
      userId: organizerUserId,
    },
  ]);
  convexImport("member", file);
  console.log("  member row importada (role admin na Org do Bruno)");
} else {
  console.log("  member row ja existe");
}

// ---------------------------------------------------------------------------
// 3) Organizer session -> convex client -> setActiveActor + start big
// ---------------------------------------------------------------------------
console.log("== 3) sessao do organizador e torneio grande ==");
const { cookie } = await accountSession(ORGANIZER);
const token = await convexToken(cookie);

const client = new ConvexHttpClient(CONVEX_URL);
client.setAuth(token);

await client.mutation(anyApi.viewer.context.setActiveActor, {
  actorKind: "organization",
  organizationId: ORG_ID,
});
console.log("  active actor = organizacao");

const bigBefore = inlineQuery(
  `const t = await ctx.db.get("${BIG_TOURNAMENT_ID}"); return { status: t.status, name: t.name };`
);
console.log(`  big antes: ${bigBefore.name} status=${bigBefore.status}`);
if (bigBefore.status === "drawn") {
  await client.mutation(anyApi.tournament.bracket.start, {
    tournamentId: BIG_TOURNAMENT_ID,
  });
  console.log("  big INICIADO (drawn -> ongoing)");
} else {
  console.log("  big ja esta ongoing, nada a fazer");
}

// ---------------------------------------------------------------------------
// 4) Small drawn tournament (create -> publish -> entries -> draw)
// ---------------------------------------------------------------------------
console.log("== 4) torneio pequeno drawn ==");
const existingSmall = inlineQuery(
  `const out = []; for await (const t of ctx.db.query("tournament")) { if (t.name === "${SMALL_TOURNAMENT_NAME}") out.push({ _id: t._id, status: t.status }); } return out;`
);
let smallId;
if (existingSmall.length > 0) {
  smallId = existingSmall[0]._id;
  console.log(
    `  pequeno ja existe: ${smallId} status=${existingSmall[0].status}`
  );
} else {
  const created = await client.mutation(anyApi.tournament.management.create, {
    approvalMode: "auto",
    avatarStorageId: null,
    categories: [
      {
        entryFeeCents: 0,
        gender: "male",
        maxEntries: null,
        modality: "singles",
      },
    ],
    city: "Dracena",
    courts: [
      {
        availability: {
          fri: [],
          mon: [],
          sat: [],
          sun: [],
          thu: [],
          tue: [],
          wed: [],
        },
        id: "court-dev-copa8-1",
        name: "Quadra 1",
      },
    ],
    coverStorageId: null,
    description: "",
    matchConfig: {
      bestOfSets: 3,
      defaultDurationMinutes: 90,
      gamesPerSet: 6,
      hasTieBreak: true,
      scoringMode: "advantage",
      setMustWinByTwoGames: true,
      tieBreakMustWinByTwo: true,
      tieBreakPoints: 7,
    },
    name: SMALL_TOURNAMENT_NAME,
    registrationDeadlineAt: Date.now() + 2 * 86_400_000,
    startDate: Date.now() + 7 * 86_400_000,
    state: "SP",
    visibility: "public",
  });
  smallId = created.id;
  console.log(`  pequeno criado: ${smallId}`);
  await client.mutation(anyApi.tournament.management.publish, {
    tournamentId: smallId,
  });
  console.log("  pequeno publicado");
}

const smallCategory = inlineQuery(
  `const out = []; for await (const c of ctx.db.query("tournamentCategory")) { if (c.tournamentId === "${smallId}") out.push({ _id: c._id }); } return out;`
);
const smallCategoryId = smallCategory[0]._id;

const smallEntries = inlineQuery(
  `const out = []; for await (const e of ctx.db.query("tournamentEntry")) { if (e.categoryId === "${smallCategoryId}") out.push(e._id); } return out;`
);
if (smallEntries.length < 8) {
  const playerEmails = PLAYERS.map((p) => p.email);
  const playerUsers = inlineQuery(
    `const wanted = ${JSON.stringify(playerEmails)}; const out = []; for await (const u of ctx.db.query("user")) { if (wanted.includes(u.email)) out.push({ _id: u._id, email: u.email }); } return out;`
  );
  const profiles = inlineQuery(
    `const ids = ${JSON.stringify(playerUsers.map((u) => u._id))}; const out = []; for await (const p of ctx.db.query("playerProfile")) { if (ids.includes(p.userId)) out.push({ userId: p.userId, _id: p._id }); } return out;`
  );
  const profileByUser = Object.fromEntries(
    profiles.map((p) => [p.userId, p._id])
  );
  const now = Date.now();
  const docs = PLAYERS.map((p, i) => {
    const userId = playerUsers.find((u) => u.email === p.email)._id;
    const playerAId = profileByUser[userId];
    if (!playerAId) {
      throw new Error(`sem playerProfile para ${p.email}`);
    }
    return {
      categoryId: smallCategoryId,
      createdAt: now + i,
      createdByUserId: userId,
      playerAId,
      status: "active",
      updatedAt: now + i,
    };
  });
  const file = writeJsonl("entries-copa8", docs);
  convexImport("tournamentEntry", file);
  console.log("  8 entradas importadas (ativas)");
} else {
  console.log(`  pequeno ja tem ${smallEntries.length} entradas`);
}

const smallAfter = inlineQuery(
  `const t = await ctx.db.get("${smallId}"); return { status: t.status };`
);
if (smallAfter.status === "published") {
  await client.mutation(anyApi.tournament.bracket.draw, {
    tournamentId: smallId,
  });
  console.log("  pequeno SORTEADO");
} else {
  console.log(
    `  pequeno status=${smallAfter.status} (draw so roda em published)`
  );
}

// ---------------------------------------------------------------------------
// 5) Verify
// ---------------------------------------------------------------------------
console.log("== 5) verificacao ==");
const verify = inlineQuery(
  `const out = []; for await (const t of ctx.db.query("tournament")) { const cats = []; for await (const c of ctx.db.query("tournamentCategory")) { if (c.tournamentId !== t._id) continue; const byRound = {}; let entries = 0; for await (const m of ctx.db.query("tournamentMatch")) { if (m.categoryId !== c._id) continue; byRound[m.round] = (byRound[m.round] ?? 0) + 1; } for await (const e of ctx.db.query("tournamentEntry")) { if (e.categoryId === c._id) entries += 1; } cats.push({ name: c.displayName, entries, byRound }); } out.push({ name: t.name, status: t.status, cats }); } return out;`
);
console.log(JSON.stringify(verify, null, 2));

const credentialAccounts = inlineQuery(
  `const cred = new Set(); for await (const a of ctx.db.query("account")) { if (a.provider === "credential") cred.add(a.userId); } const out = []; for await (const u of ctx.db.query("user")) { if (cred.has(u._id)) out.push(u.email); } return out.sort();`
);
console.log("contas com senha no DEV:", credentialAccounts);
console.log("\nCREDENCIAIS DE LOGIN (DEV kindred-yak-142):");
console.log(`  organizador: ${ORGANIZER.email} / ${PASSWORD}`);
for (const p of PLAYERS) {
  console.log(`  jogador: ${p.email} / ${PASSWORD}`);
}
console.log(`  JOGADORA (teste r27): ${FEMALE_TEST_ACCOUNT} / ${PASSWORD}`);
for (const p of FEMALE_PLAYERS) {
  console.log(`  jogadora: ${p.email} / ${PASSWORD}`);
}
