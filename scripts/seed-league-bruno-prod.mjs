#!/usr/bin/env node
/**
 * Data-only seed for "Liga do Bruno" (PROD deployment amiable-albatross-845).
 *
 * Creates 41 human players (36 ranked + 5 pending join requests) and 21
 * league challenges covering every challenge state in the domain, plus
 * coherent notification rows. Everything is inserted with `convex import
 * --append` (no code deploy, no triggers, no provider calls).
 *
 * Stages (run in order, each stage is idempotent-safe: it aborts if the
 * target emails/usernames already exist):
 *   node scripts/seed-league-bruno-prod.mjs check
 *   node scripts/seed-league-bruno-prod.mjs users
 *   node scripts/seed-league-bruno-prod.mjs profiles
 *   node scripts/seed-league-bruno-prod.mjs memberships
 *   node scripts/seed-league-bruno-prod.mjs challenges
 *   node scripts/seed-league-bruno-prod.mjs children
 *   node scripts/seed-league-bruno-prod.mjs verify
 *
 * Out dir (JSONL + maps): /tmp/seed-liga-bruno/out
 * Baseline snapshots:      /tmp/seed-liga-bruno/before
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "/tmp/seed-liga-bruno/out";
const LEAGUE_ID = "k974qb3fms7yta95xcfdb8zr718bpeja";
const ORG_ID = "mx78z00enm3s3vkbk2znktsy218bq95g";
const BRUNO = {
  membershipId: "kx72s0t62kxzpxjs3067mvqkzh8bqg8w",
  profileId: "n17ag7cjd6x6dy1awypm0tkbws88rryn",
  userId: "nh765kgdy9p2yagzh5g0wy6xsd88r06x",
};
const COURT_ID = "court-1785663747216-1-zo0sag";
const LEAGUE_NAME = "Liga do Bruno";
const EMAIL_DOMAIN = "bropen.local";
const EMAIL_PREFIX = "seed+ligabruno-";
const NOW = Date.now();
const H = 3_600_000;

// ---------------------------------------------------------------------------
// People: 36 ranked (positions 1..36 in listed order) + 5 join requesters.
// Full names are plausible Brazilian humans; usernames are ASCII nome.sobrenome.
// `check` stage asserts none of these emails/usernames exist in prod yet.
// ---------------------------------------------------------------------------
const PEOPLE = [
  ["Rafaela Monteiro", "rafaela.monteiro", "Feminino", "Rafa"],
  ["Eduardo Simas", "eduardo.simas", "Masculino", null],
  ["Camila Duarte", "camila.duarte", "Feminino", "Cami"],
  ["Vinícius Prado", "vinicius.prado", "Masculino", null],
  ["Letícia Andrade", "leticia.andrade", "Feminino", null],
  ["Gustavo Bertoni", "gustavo.bertoni", "Masculino", "Guga"],
  ["Marina Peixoto", "marina.peixoto", "Feminino", null],
  ["Thiago Ribeiro", "thiago.ribeiro", "Masculino", null],
  ["Aline Fontes", "aline.fontes", "Feminino", null],
  ["Rodrigo Bittencourt", "rodrigo.bittencourt", "Masculino", null],
  ["Priscila Ozório", "priscila.ozorio", "Feminino", null],
  ["Fábio Junqueira", "fabio.junqueira", "Masculino", null],
  ["Renata Coelho", "renata.coelho", "Feminino", null],
  ["Alexandre Kraus", "alexandre.kraus", "Masculino", null],
  ["Bianca Sampaio", "bianca.sampaio", "Feminino", null],
  ["Murilo Graziano", "murilo.graziano", "Masculino", null],
  ["Tatiane Bueno", "tatiane.bueno", "Feminino", null],
  ["Diego Sallum", "diego.sallum", "Masculino", null],
  ["Vanessa Restier", "vanessa.restier", "Feminino", null],
  ["Cauê Bonaguro", "caue.bonaguro", "Masculino", null],
  ["Elisa Vandame", "elisa.vandame", "Feminino", null],
  ["Otávio Carvalheira", "otavio.carvalheira", "Masculino", null],
  ["Juliana Moscardi", "juliana.moscardi", "Feminino", null],
  ["Fernando Colombo", "fernando.colombo", "Masculino", null],
  ["Gabriela Rezek", "gabriela.rezek", "Feminino", null],
  ["Leandro Bins", "leandro.bins", "Masculino", null],
  ["Cristina Vilar", "cristina.vilar", "Feminino", null],
  ["Anderson Pilar", "anderson.pilar", "Masculino", null],
  ["Fabrícia Lopes", "fabricia.lopes", "Feminino", null],
  ["Marcello Tossin", "marcello.tossin", "Masculino", null],
  ["Ilana Frydman", "ilana.frydman", "Feminino", null],
  ["Jonatas Farah", "jonatas.farah", "Masculino", null],
  ["Simone Grecco", "simone.grecco", "Feminino", null],
  ["Paulo Brossi", "paulo.brossi", "Masculino", null],
  ["Maitê Bertuol", "maite.bertuol", "Feminino", null],
  ["Claudio Heinzen", "claudio.heinzen", "Masculino", null],
  // Join requesters (organizer queue)
  ["Sérgio Balthazar", "sergio.balthazar", "Masculino", null],
  ["Débora Nunes", "debora.nunes", "Feminino", null],
  ["Adriano Kuntze", "adriano.kuntze", "Masculino", null],
  ["Luana Schmitt", "luana.schmitt", "Feminino", null],
  ["Igor Bialer", "igor.bialer", "Masculino", null],
].map(([fullName, username, gender, nickname], i) => ({
  // Staggered signups Jul 20 - Aug 28 2026, 12h-21h UTC
  createdAt:
    Date.UTC(2026, 6, 20, 12, 0, 0) + ((i * 43_721_234) % (38 * 24 * H)),
  email: `${EMAIL_PREFIX}${String(i + 1).padStart(2, "0")}@${EMAIL_DOMAIN}`,
  fullName,
  gender,
  index: i + 1,
  nickname,
  username,
}));

const RANKED_COUNT = 36;
const MATCH_CONFIG = {
  bestOfSets: 3,
  defaultDurationMinutes: 90,
  finalSetGamesPerSet: 6,
  finalSetHasTieBreak: true,
  finalSetMode: "same_as_previous",
  finalSetMustWinByTwoGames: true,
  finalSetScoringMode: "advantage",
  finalSetSuperTieBreakMustWinByTwo: true,
  finalSetSuperTieBreakPoints: 10,
  finalSetTieBreakAtGamesAll: 6,
  finalSetTieBreakMustWinByTwo: true,
  finalSetTieBreakPoints: 7,
  gamesPerSet: 6,
  hasTieBreak: true,
  scoringMode: "advantage",
  setMustWinByTwoGames: true,
  tieBreakAtGamesAll: 6,
  tieBreakMustWinByTwo: true,
  tieBreakPoints: 7,
};

// Monday date-keys (UTC). Today is Mon 2026-08-31.
const MON = {
  aug3: "2026-08-03",
  aug10: "2026-08-10",
  aug17: "2026-08-17",
  aug24: "2026-08-24",
  aug31: "2026-08-31",
  sep7: "2026-09-07",
  sep14: "2026-09-14",
};
function mondaysAgo(dateKey, weeks) {
  return Date.parse(`${dateKey}T00:00:00Z`) - weeks * 7 * 24 * H;
}
// minutes since midnight -> epoch ms of that slot end on matchDate
function atMinute(dateKey, minute) {
  return Date.parse(`${dateKey}T00:00:00Z`) + minute * 60_000;
}

// Bruno = membership index 0 (special). Ranked people are indexes 1..36.
function membershipRef(i) {
  return i === 0
    ? { ...BRUNO, fullName: "Bruno Garcia", label: "Bruno Garcia" }
    : PEOPLE[i - 1];
}

// Scenario definitions. challenger/challenged are membership indexes
// (0 = Bruno, 1..36 ranked people, 37..41 requesters - unused in matches).
// All slots land on Mondays 05:00-18:00 (the league court availability) and
// never overlap on the same day.
const CHALLENGES = [
  // --- Bruno's challenges -------------------------------------------------
  {
    challenged: 5,
    challenger: 0,
    date: MON.sep7,
    end: 630,
    key: "B1",
    start: 540,
    status: "pending_opponent_response",
  },
  {
    challenged: 8,
    challenger: 0,
    counter: true,
    date: MON.sep7,
    end: 900,
    key: "B2",
    start: 810,
    status: "pending_creator_reapproval",
  },
  {
    challenged: 12,
    challenger: 0,
    date: MON.aug31,
    end: 1020,
    key: "B3",
    start: 930,
    status: "confirmed",
  },
  {
    challenged: 3,
    challenger: 0,
    date: MON.aug24,
    end: 570,
    key: "B4",
    start: 480,
    status: "pending_result_submission",
  },
  {
    challenged: 0,
    challenger: 15,
    date: MON.aug24,
    end: 690,
    key: "B5",
    result: { submittedBy: "challenger", winner: "challenger" },
    start: 600,
    status: "pending_result_confirmation",
  },
  {
    challenged: 20,
    challenger: 0,
    date: MON.aug17,
    end: 570,
    key: "B6",
    result: {
      confirmedBy: "challenged",
      submittedBy: "challenger",
      winner: "challenger",
    },
    resultValidationMode: "manual",
    start: 480,
    status: "pending_organizer_result_validation",
  },
  {
    challenged: 0,
    challenger: 9,
    date: MON.aug10,
    end: 570,
    key: "B7",
    result: {
      confirmedBy: "challenged",
      organizerCorrection: true,
      submittedBy: "challenger",
      winner: "challenger",
    },
    start: 480,
    status: "pending_result_correction",
  },
  {
    challenged: 2,
    challenger: 0,
    date: MON.aug3,
    end: 570,
    key: "B8",
    result: {
      confirmedBy: "challenged",
      score: [
        [6, 4],
        [3, 6],
        [7, 5],
      ],
      submittedBy: "challenger",
      winner: "challenger",
    },
    start: 480,
    status: "finished",
  },
  {
    challenged: 0,
    challenger: 7,
    date: MON.aug3,
    end: 810,
    key: "B9",
    result: {
      confirmedBy: "challenged",
      score: [
        [6, 3],
        [6, 4],
      ],
      submittedBy: "challenger",
      winner: "challenger",
    },
    start: 720,
    status: "finished",
  },
  {
    cancelRequestedBy: "challenger",
    challenged: 11,
    challenger: 0,
    date: MON.sep14,
    end: 1080,
    key: "B10",
    start: 990,
    status: "pending_cancellation_acceptance",
  },
  {
    challenged: 1,
    challenger: 0,
    date: MON.aug17,
    end: 930,
    key: "B11",
    start: 840,
    status: "declined",
  },
  {
    challenged: 4,
    challenger: 0,
    challengeValidationMode: "manual",
    date: MON.sep14,
    end: 570,
    key: "B12",
    start: 480,
    status: "pending_organizer_decision",
  },
  // --- Among new players (organizer dashboard + agenda life) --------------
  {
    challenged: 13,
    challenger: 16,
    date: MON.sep7,
    end: 510,
    key: "N1",
    start: 420,
    status: "confirmed",
  },
  {
    challenged: 17,
    challenger: 21,
    date: MON.sep7,
    end: 750,
    key: "N2",
    start: 660,
    status: "confirmed",
  },
  {
    challenged: 24,
    challenger: 28,
    date: MON.sep7,
    end: 990,
    key: "N3",
    start: 900,
    status: "confirmed",
  },
  {
    challenged: 29,
    challenger: 33,
    date: MON.sep14,
    end: 750,
    key: "N4",
    start: 660,
    status: "confirmed",
  },
  {
    challenged: 19,
    challenger: 23,
    date: MON.sep14,
    end: 930,
    key: "N5",
    start: 840,
    status: "pending_opponent_response",
  },
  {
    challenged: 26,
    challenger: 31,
    date: MON.aug24,
    end: 810,
    key: "N6",
    result: { submittedBy: "challenger", winner: "challenger" },
    start: 720,
    status: "pending_result_confirmation",
  },
  {
    challenged: 22,
    challenger: 27,
    date: MON.aug17,
    end: 780,
    key: "N7",
    result: {
      confirmedBy: "challenged",
      score: [
        [6, 4],
        [6, 3],
      ],
      submittedBy: "challenger",
      winner: "challenger",
    },
    start: 690,
    status: "finished",
  },
  {
    challenged: 30,
    challenger: 35,
    date: MON.aug24,
    end: 930,
    key: "N8",
    start: 840,
    status: "pending_result_submission",
  },
  {
    challenged: 14,
    challenger: 18,
    date: MON.aug24,
    end: 1050,
    key: "N9",
    start: 960,
    status: "cancelled",
  },
];

const LOCKED = new Set([
  "confirmed",
  "finished",
  "pending_organizer_result_validation",
  "pending_result_confirmation",
  "pending_result_submission",
  "pending_result_correction",
  "pending_cancellation_acceptance",
  "declined",
  "cancelled",
]);

function side(challenge, which) {
  return which === "challenger" ? challenge.challenger : challenge.challenged;
}
function sideId(challenge, which, membershipMap) {
  return membershipMap[`${side(challenge, which)}`];
}

function buildScore(challenge, result, membershipMap) {
  const sets = result.score
    ? result.score.map(([a, b]) => ({
        challengedGames: b,
        challengerGames: a,
        kind: "set",
      }))
    : [
        [6, 4],
        [6, 3],
      ].map(([a, b]) => ({
        challengedGames: b,
        challengerGames: a,
        kind: "set",
      }));
  const winnerMembershipId = sideId(challenge, result.winner, membershipMap);
  return { sets, winnerMembershipId };
}

// ---------------------------------------------------------------------------
// Doc builders
// ---------------------------------------------------------------------------
function userDocs() {
  return PEOPLE.map((p) => ({
    createdAt: p.createdAt,
    displayUsername: null,
    email: p.email,
    emailVerified: true,
    image: null,
    lastActiveOrganizationId: null,
    name: p.fullName,
    personalOrganizationId: null,
    updatedAt: p.createdAt,
    userId: null,
    username: p.username,
  }));
}

function profileDocs(userMap) {
  return PEOPLE.map((p) => ({
    avatarStorageId: null,
    createdAt: p.createdAt + 5 * 60_000,
    fullName: p.fullName,
    gender: p.gender,
    nickname: p.nickname,
    phone: null,
    updatedAt: p.createdAt + 5 * 60_000,
    userId: userMap[p.email],
  }));
}

function membershipDocs(profileMap) {
  return PEOPLE.map((p, i) => {
    const isRequester = i + 1 > RANKED_COUNT;
    const requestedAt =
      Date.UTC(2026, 7, 29, 13, 0, 0) + (i - RANKED_COUNT) * 9 * H;
    const createdAt = isRequester
      ? requestedAt
      : Date.UTC(2026, 7, 2, 12, 0, 0) + i * 7 * H;
    return {
      createdAt,
      lastRenewalReminderSentAt: null,
      leagueId: LEAGUE_ID,
      playerProfileId: profileMap[p.email],
      rankingPosition: isRequester ? null : i + 1,
      reviewedAt: isRequester ? null : createdAt + 3 * H,
      status: isRequester ? "pending" : "active",
      updatedAt: isRequester ? createdAt : createdAt + 3 * H,
    };
  });
}

function challengeDocs(membershipMap) {
  return CHALLENGES.map((c) => {
    const challengerMembershipId = membershipMap[`${c.challenger}`];
    const challengedMembershipId = membershipMap[`${c.challenged}`];
    const createdAt = mondaysAgo(c.date, 0) - 2 * 24 * H;
    const isLocked = LOCKED.has(c.status);
    const finishedAt = c.status === "finished" ? atMinute(c.date, c.end) : null;
    const cancelledAt =
      c.status === "cancelled" ? mondaysAgo(c.date, 0) - H : null;
    const confirmedAt = isLocked ? createdAt + 20 * H : null;
    const challengeValidationMode =
      c.challengeValidationMode === "manual" ? "manual" : "automatic";
    const resultValidationMode =
      c.resultValidationMode === "manual" ? "manual" : "automatic";
    return {
      cancellationRequestedAt:
        c.status === "pending_cancellation_acceptance" ? NOW - 5 * H : null,
      cancellationRequestedByMembershipId:
        c.status === "pending_cancellation_acceptance"
          ? sideId(c, c.cancelRequestedBy ?? "challenger", membershipMap)
          : null,
      cancelledAt,
      challengedMembershipId,
      challengerMembershipId,
      challengeValidationMode,
      confirmedAt,
      createdAt,
      currentProposalId: null, // serializers fall back to the only proposal
      finishedAt,
      invalidatedAt: null,
      leagueId: LEAGUE_ID,
      lockedAt: confirmedAt,
      matchConfigSnapshot: MATCH_CONFIG,
      rankingAppliedAt: null,
      rankingSnapshotAfterResult: null,
      rankingSnapshotBeforeResult: null,
      resultValidationMode,
      status: c.status,
      updatedAt: finishedAt ?? cancelledAt ?? confirmedAt ?? createdAt,
    };
  });
}

function proposalStatus(c, revision) {
  if (revision === 2) {
    return "active"; // counter-proposal awaiting re-approval
  }
  if (c.counter) {
    return "replaced"; // original proposal superseded by the counter
  }
  if (c.status === "declined") {
    return "declined";
  }
  if (c.status === "cancelled") {
    return "cancelled";
  }
  return LOCKED.has(c.status) ? "accepted" : "active";
}

function proposalDocs(challengeMap, membershipMap) {
  const rows = [];
  for (const c of CHALLENGES) {
    const challengeId = challengeMap[c.key];
    const createdAt = mondaysAgo(c.date, 0) - 2 * 24 * H;
    const deadlineFuture =
      c.status === "pending_opponent_response" ||
      c.status === "pending_creator_reapproval" ||
      c.status === "pending_organizer_decision";
    const responseDeadlineAt = deadlineFuture
      ? NOW + 44 * H
      : createdAt + 48 * H;
    rows.push({
      challengeId,
      courtId: COURT_ID,
      createdAt,
      endMinute: c.end,
      matchDate: c.date,
      proposedByMembershipId: sideId(c, "challenger", membershipMap),
      responseDeadlineAt,
      revisionNumber: 1,
      startMinute: c.start,
      status: proposalStatus(c, 1),
    });
    if (c.counter) {
      // Opponent countered 4h ago (moved the slot 3h later, same day); the
      // challenger must re-approve (rev 2 active).
      rows.push({
        challengeId,
        courtId: COURT_ID,
        createdAt: NOW - 4 * H,
        endMinute: c.end + 180,
        matchDate: c.date,
        proposedByMembershipId: sideId(c, "challenged", membershipMap),
        responseDeadlineAt: NOW + 44 * H,
        revisionNumber: 2,
        startMinute: c.start + 180,
        status: "active",
      });
    }
  }
  return rows;
}

function submissionDocs(challengeMap, membershipMap) {
  const rows = [];
  for (const c of CHALLENGES) {
    if (!c.result) {
      continue;
    }
    const challengeId = challengeMap[c.key];
    const submittedAt = atMinute(c.date, c.end) + 25 * 60_000;
    const score = buildScore(c, c.result, membershipMap);
    const confirmedBy = c.result.confirmedBy
      ? sideId(c, c.result.confirmedBy, membershipMap)
      : null;
    const organizerReviewed = Boolean(c.result.organizerCorrection);
    rows.push({
      challengeId,
      confirmedAt: confirmedBy ? submittedAt + 45 * 60_000 : null,
      confirmedByMembershipId: confirmedBy,
      organizerReviewedByUserId: organizerReviewed ? BRUNO.userId : null,
      reviewAction: organizerReviewed ? "correction_requested" : null,
      reviewedAt: organizerReviewed ? submittedAt + 26 * H : null,
      score,
      submittedAt,
      submittedByMembershipId: sideId(c, c.result.submittedBy, membershipMap),
      winnerMembershipId: score.winnerMembershipId,
    });
  }
  return rows;
}

function feedDoc(input) {
  return {
    actorUserId: input.actorUserId ?? null,
    body: input.body,
    data: {
      eventType: input.eventType,
      ...(input.metadata ?? {}),
      leagueId: LEAGUE_ID,
      url: input.url,
    },
    eventType: input.eventType,
    isRead: input.isRead ?? false,
    occurredAt: input.occurredAt,
    readAt: input.isRead ? input.occurredAt + 6 * H : null,
    recipientActorKind: input.actorKind ?? "player",
    recipientOrganizationId: input.actorKind === "organization" ? ORG_ID : null,
    recipientPlayerProfileId:
      input.actorKind === "organization" ? null : input.recipientProfileId,
    recipientUserId: input.recipientUserId,
    retractedAt: null,
    sourceEntityId: input.sourceEntityId,
    sourceEntityType: input.sourceEntityType,
    status: "active",
    title: input.title,
  };
}

function notificationDocs(challengeMap, membershipMap, userMap, profileMap) {
  const rows = [];
  const byEmail = (i) => PEOPLE[i - 1];
  const actorOf = (i) => byEmail(i).email && userMap[byEmail(i).email];

  const challengeUrl = `${LEAGUE_ID}/challenges`;
  const challengesUrl = `/leagues/${challengeUrl}`;

  const pushChallenge = (
    cKey,
    eventType,
    title,
    body,
    recipientIdx,
    actorIdx,
    occurredAt,
    isRead
  ) => {
    const recipientUserId =
      recipientIdx === 0 ? BRUNO.userId : userMap[byEmail(recipientIdx).email];
    const recipientProfileId =
      recipientIdx === 0
        ? BRUNO.profileId
        : profileMap[byEmail(recipientIdx).email];
    rows.push(
      feedDoc({
        actorKind: "player",
        actorUserId: actorIdx === 0 ? BRUNO.userId : actorOf(actorIdx),
        body,
        eventType,
        isRead,
        occurredAt,
        recipientProfileId,
        recipientUserId,
        sourceEntityId: challengeMap[cKey],
        sourceEntityType: "leagueChallenge",
        title,
        url: challengesUrl,
      })
    );
  };

  for (const c of CHALLENGES) {
    switch (c.status) {
      case "pending_opponent_response":
        pushChallenge(
          c.key,
          "league.challenge.created",
          "Novo desafio recebido",
          `${membershipRef(c.challenger).fullName} desafiou você na liga ${LEAGUE_NAME}.`,
          c.challenged,
          c.challenger,
          NOW - 2 * H
        );
        break;
      case "pending_creator_reapproval":
        pushChallenge(
          c.key,
          "league.challenge.counter_proposed",
          "Contraproposta recebida",
          `${membershipRef(c.challenged).fullName} sugeriu outro horário em ${LEAGUE_NAME}.`,
          c.challenger,
          c.challenged,
          NOW - 4 * H
        );
        break;
      case "confirmed":
        pushChallenge(
          c.key,
          "league.challenge.proposal_accepted",
          "Desafio aceito",
          `${membershipRef(c.challenged).fullName} aceitou o desafio em ${LEAGUE_NAME}.`,
          c.challenger,
          c.challenged,
          mondaysAgo(c.date, 0) - 24 * H,
          c.date !== MON.aug31 && c.date !== MON.sep7
        );
        break;
      case "pending_result_confirmation":
        pushChallenge(
          c.key,
          "league.challenge.result_submitted",
          "Placar enviado",
          `${membershipRef(side(c, c.result.submittedBy)).fullName} enviou o placar do desafio em ${LEAGUE_NAME}.`,
          c.result.submittedBy === "challenger" ? c.challenged : c.challenger,
          c.result.submittedBy === "challenger" ? c.challenger : c.challenged,
          atMinute(c.date, c.end) + 25 * 60_000
        );
        break;
      case "pending_result_correction":
        for (const r of [c.challenger, c.challenged]) {
          pushChallenge(
            c.key,
            "league.challenge.result_correction_requested",
            "Correção de placar",
            `O organizador pediu correção no placar da liga ${LEAGUE_NAME}.`,
            r,
            0,
            atMinute(c.date, c.end) + 26 * H,
            r !== 0
          );
        }
        break;
      case "finished":
        for (const r of ["challenger", "challenged"]) {
          pushChallenge(
            c.key,
            "league.challenge.result_confirmed",
            "Placar confirmado",
            `${membershipRef(side(c, c.result.confirmedBy)).fullName} confirmou o placar em ${LEAGUE_NAME}.`,
            side(c, r),
            side(c, c.result.confirmedBy),
            atMinute(c.date, c.end) + 70 * 60_000,
            true
          );
        }
        break;
      case "pending_cancellation_acceptance":
        pushChallenge(
          c.key,
          "league.challenge.cancellation_requested",
          "Pedido de cancelamento",
          `${membershipRef(c.challenger).fullName} pediu para cancelar o desafio em ${LEAGUE_NAME}.`,
          c.challenged,
          c.challenger,
          NOW - 5 * H
        );
        break;
      case "declined":
        pushChallenge(
          c.key,
          "league.challenge.proposal_declined",
          "Desafio recusado",
          `${membershipRef(c.challenged).fullName} recusou o desafio em ${LEAGUE_NAME}.`,
          c.challenger,
          c.challenged,
          mondaysAgo(c.date, 0) - 24 * H,
          true
        );
        break;
      default:
        break;
    }
  }
  // Organizer asked P30 (N8) to submit the missing score.
  {
    const c = CHALLENGES.find((x) => x.key === "N8");
    pushChallenge(
      c.key,
      "league.challenge.result_reminder_requested",
      "Lembrete do organizador",
      `O organizador da liga ${LEAGUE_NAME} está aguardando o placar do seu desafio.`,
      c.challenger,
      0,
      NOW - 8 * H
    );
  }
  // Organizer-side: 5 join requests (mirrors the free-league pipeline payload).
  for (let i = RANKED_COUNT + 1; i <= PEOPLE.length; i++) {
    const p = byEmail(i);
    rows.push(
      feedDoc({
        actorKind: "organization",
        actorUserId: userMap[p.email],
        body: `${p.fullName} pediu para entrar na liga ${LEAGUE_NAME}.`,
        eventType: "league.membership.requested",
        metadata: { membershipId: membershipMap[`${i}`] },
        occurredAt:
          Date.UTC(2026, 7, 29, 13, 0, 0) + (i - RANKED_COUNT - 1) * 9 * H + H,
        recipientProfileId: null,
        recipientUserId: BRUNO.userId,
        sourceEntityId: membershipMap[`${i}`],
        sourceEntityType: "leagueMembership",
        title: "Nova solicitação de entrada",
        url: `/leagues/${LEAGUE_ID}/requests`,
      })
    );
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Prod access helpers
// ---------------------------------------------------------------------------
function convexRun(inlineQuery) {
  const out = execFileSync(
    "bunx",
    ["convex", "run", "--inline-query", inlineQuery, "--prod"],
    {
      cwd: "/Users/brunogarcia/Development/projects/br-open",
      encoding: "utf8",
      timeout: 120_000,
    }
  );
  const trimmed = out.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(
      `convex run returned non-JSON output: ${trimmed.slice(0, 400)}`
    );
  }
}
function convexImport(table, file) {
  execFileSync(
    "bunx",
    ["convex", "import", "--prod", "--table", table, "--append", file],
    {
      cwd: "/Users/brunogarcia/Development/projects/br-open",
      encoding: "utf8",
      stdio: "inherit",
      timeout: 300_000,
    }
  );
}
function writeJsonl(name, rows) {
  const file = join(OUT, `${name}.jsonl`);
  writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
  console.log(`${name}: ${rows.length} docs -> ${file}`);
}
function readMap(name) {
  return JSON.parse(readFileSync(join(OUT, `${name}.json`), "utf8"));
}
function writeMap(name, value) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(value, null, 2));
}

const mapKeys = (rows, keyField) =>
  Object.fromEntries(rows.map((r) => [r[keyField], r._id]));

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------
const stage = process.argv[2];
mkdirSync(OUT, { recursive: true });

if (stage === "check") {
  const res = convexRun(
    `const users = []; for await (const u of ctx.db.query("user")) users.push({ e: u.email, un: u.username ?? null }); return users;`
  );
  const emails = new Set(res.map((u) => u.e));
  const usernames = new Set(res.map((u) => u.un).filter(Boolean));
  const clashes = [];
  for (const p of PEOPLE) {
    if (emails.has(p.email)) {
      clashes.push(`email ${p.email}`);
    }
    if (usernames.has(p.username)) {
      clashes.push(`username ${p.username}`);
    }
  }
  if (clashes.length > 0) {
    console.error(
      `ABORT: seed already applied or name collision:\n${clashes.join("\n")}`
    );
    process.exit(1);
  }
  writeMap(
    "people",
    PEOPLE.map(({ email, fullName, username, index }) => ({
      email,
      fullName,
      index,
      username,
    }))
  );
  console.log(
    `check ok: ${PEOPLE.length} people, no collisions against ${res.length} existing users.`
  );
} else if (stage === "users") {
  writeJsonl("1-users", userDocs());
  convexImport("user", join(OUT, "1-users.jsonl"));
  const rows = convexRun(
    `const out = []; for await (const u of ctx.db.query("user")) { if (u.email != null && u.email.startsWith("${EMAIL_PREFIX}")) out.push({ email: u.email, _id: u._id }); } return out;`
  );
  if (rows.length !== PEOPLE.length) {
    throw new Error(`expected ${PEOPLE.length} users, got ${rows.length}`);
  }
  writeMap("users", mapKeys(rows, "email"));
} else if (stage === "profiles") {
  const userMap = readMap("users");
  writeJsonl("2-profiles", profileDocs(userMap));
  convexImport("playerProfile", join(OUT, "2-profiles.jsonl"));
  const rows = convexRun(
    `const ids = ${JSON.stringify(Object.values(userMap))}; const out = []; for await (const p of ctx.db.query("playerProfile")) { if (ids.includes(p.userId)) out.push({ userId: p.userId, _id: p._id }); } return out;`
  );
  if (rows.length !== PEOPLE.length) {
    throw new Error(`expected ${PEOPLE.length} profiles, got ${rows.length}`);
  }
  const emailByUser = Object.fromEntries(
    Object.entries(readMap("users")).map(([email, uid]) => [uid, email])
  );
  writeMap(
    "profiles",
    Object.fromEntries(rows.map((r) => [emailByUser[r.userId], r._id]))
  );
} else if (stage === "memberships") {
  const profileMap = readMap("profiles");
  writeJsonl("3-memberships", membershipDocs(profileMap));
  convexImport("leagueMembership", join(OUT, "3-memberships.jsonl"));
  const rows = convexRun(
    `const ids = ${JSON.stringify(Object.values(profileMap))}; const out = []; for await (const m of ctx.db.query("leagueMembership")) { if (m.leagueId === "${LEAGUE_ID}" && ids.includes(m.playerProfileId)) out.push({ playerProfileId: m.playerProfileId, _id: m._id }); } return out;`
  );
  if (rows.length !== PEOPLE.length) {
    throw new Error(
      `expected ${PEOPLE.length} memberships, got ${rows.length}`
    );
  }
  const emailByProfile = Object.fromEntries(
    Object.entries(profileMap).map(([email, pid]) => [pid, email])
  );
  const emailMap = Object.fromEntries(
    rows.map((r) => [emailByProfile[r.playerProfileId], r._id])
  );
  // keyed by membership index (0 = Bruno, 1..41 people index)
  writeMap("memberships", {
    0: BRUNO.membershipId,
    ...Object.fromEntries(
      Object.entries(emailMap).map(([email, mid]) => [
        String(
          Number(email.slice(EMAIL_PREFIX.length, EMAIL_PREFIX.length + 2))
        ),
        mid,
      ])
    ),
  });
} else if (stage === "challenges") {
  const membershipMap = readMap("memberships");
  writeJsonl("4-challenges", challengeDocs(membershipMap));
  convexImport("leagueChallenge", join(OUT, "4-challenges.jsonl"));
  const mids = [...new Set(Object.values(membershipMap))];
  const rows = convexRun(
    `const mids = ${JSON.stringify(mids)}; const out = []; for await (const c of ctx.db.query("leagueChallenge")) { if (c.leagueId === "${LEAGUE_ID}" && (mids.includes(c.challengerMembershipId) || mids.includes(c.challengedMembershipId))) out.push({ challengerMembershipId: c.challengerMembershipId, challengedMembershipId: c.challengedMembershipId, createdAt: c.createdAt, status: c.status, _id: c._id }); } return out;`
  );
  const byKey = new Map();
  for (const c of CHALLENGES) {
    const createdAt = mondaysAgo(c.date, 0) - 2 * 24 * H;
    const match = rows.find(
      (r) =>
        r.challengerMembershipId === membershipMap[`${c.challenger}`] &&
        r.challengedMembershipId === membershipMap[`${c.challenged}`] &&
        r.createdAt === createdAt &&
        r.status === c.status
    );
    if (!match) {
      throw new Error(`challenge ${c.key} not found in readback`);
    }
    byKey.set(c.key, match._id);
  }
  writeMap("challenges", Object.fromEntries(byKey));
} else if (stage === "preview") {
  // Local dry run: fake id maps, no convex access. Validates doc construction.
  const fakeMemberships = Object.fromEntries([
    ["0", "fake-m-bruno"],
    ...PEOPLE.map((p) => [String(p.index), `fake-m-${p.index}`]),
  ]);
  const fakeChallenges = Object.fromEntries(
    CHALLENGES.map((c) => [c.key, `fake-c-${c.key}`])
  );
  const fakeUsers = Object.fromEntries(
    PEOPLE.map((p) => [p.email, `fake-u-${p.index}`])
  );
  const fakeProfiles = Object.fromEntries(
    PEOPLE.map((p) => [p.email, `fake-p-${p.index}`])
  );
  const proposals = proposalDocs(fakeChallenges, fakeMemberships);
  const submissions = submissionDocs(fakeChallenges, fakeMemberships);
  const notifications = notificationDocs(
    fakeChallenges,
    fakeMemberships,
    fakeUsers,
    fakeProfiles
  );
  const requiredRecipient = notifications.filter(
    (r) =>
      typeof r.recipientUserId !== "string" ||
      r.recipientUserId.length === 0 ||
      (r.recipientActorKind === "player" &&
        typeof r.recipientPlayerProfileId !== "string")
  );
  const bad = [
    ...requiredRecipient,
    ...proposals.filter((r) => JSON.stringify(r).includes("undefined")),
    ...submissions.filter((r) => JSON.stringify(r).includes("undefined")),
    ...notifications.filter((r) => JSON.stringify(r).includes("undefined")),
    ...challengeDocs(fakeMemberships).filter((r) =>
      JSON.stringify(r).includes("undefined")
    ),
    ...membershipDocs({}).filter((r) =>
      JSON.stringify(r).includes("undefined")
    ),
  ];
  if (bad.length > 0) {
    throw new Error(
      `undefined fields in ${bad.length} docs: ${JSON.stringify(bad[0])}`
    );
  }
  // Slot overlap assertion per court+date (half-open ranges).
  const bySlot = new Map();
  for (const p of proposals) {
    const key = `${p.matchDate}`;
    for (const other of bySlot.get(key) ?? []) {
      if (p.startMinute < other.endMinute && other.startMinute < p.endMinute) {
        throw new Error(
          `slot overlap on ${p.matchDate}: ${p.startMinute}-${p.endMinute} vs ${other.startMinute}-${other.endMinute}`
        );
      }
    }
    bySlot.set(key, [...(bySlot.get(key) ?? []), p]);
  }
  console.log(
    JSON.stringify(
      {
        challenges: challengeDocs(fakeMemberships).length,
        memberships: membershipDocs({}).length,
        notifications: notifications.length,
        proposals: proposals.length,
        submissions: submissions.length,
        users: PEOPLE.length,
      },
      null,
      2
    )
  );
} else if (stage === "children") {
  const challengeMap = readMap("challenges");
  const membershipMap = readMap("memberships");
  const userMap = readMap("users");
  const profileMap = readMap("profiles");
  const challengeIds = Object.values(challengeMap);
  const existing = convexRun(
    `const cids = ${JSON.stringify(challengeIds)}; const proposals = []; for await (const p of ctx.db.query("leagueChallengeProposal")) { if (cids.includes(p.challengeId)) proposals.push(p.challengeId + ':' + p.revisionNumber); } const submissions = []; for await (const s of ctx.db.query("leagueChallengeResultSubmission")) { if (cids.includes(s.challengeId)) submissions.push(s.challengeId + ':' + s.submittedByMembershipId); } return { proposals, submissions };`
  );
  const proposals = proposalDocs(challengeMap, membershipMap);
  const missingProposals = proposals.filter(
    (p) => !existing.proposals.includes(`${p.challengeId}:${p.revisionNumber}`)
  );
  if (missingProposals.length > 0) {
    writeJsonl("5-proposals", missingProposals);
    convexImport("leagueChallengeProposal", join(OUT, "5-proposals.jsonl"));
  } else {
    console.log("proposals already imported, skipping");
  }
  const submissions = submissionDocs(challengeMap, membershipMap);
  const missingSubmissions = submissions.filter(
    (s) =>
      !existing.submissions.includes(
        `${s.challengeId}:${s.submittedByMembershipId}`
      )
  );
  if (missingSubmissions.length > 0) {
    writeJsonl("6-submissions", missingSubmissions);
    convexImport(
      "leagueChallengeResultSubmission",
      join(OUT, "6-submissions.jsonl")
    );
  } else {
    console.log("submissions already imported, skipping");
  }
  const notifications = notificationDocs(
    challengeMap,
    membershipMap,
    userMap,
    profileMap
  );
  const myUserIds = [...new Set(notifications.map((n) => n.recipientUserId))];
  const existingFeeds = convexRun(
    `const uids = ${JSON.stringify(myUserIds)}; const evts = ${JSON.stringify([...new Set(notifications.map((n) => n.eventType))])}; let n = 0; for await (const f of ctx.db.query("notificationFeed")) { if (evts.includes(f.eventType) && uids.includes(f.recipientUserId)) n++; } return n;`
  );
  if (existingFeeds < notifications.length) {
    writeJsonl("7-notifications", notifications);
    convexImport("notificationFeed", join(OUT, "7-notifications.jsonl"));
  } else {
    console.log("notifications already imported, skipping");
  }
} else if (stage === "verify") {
  const res = convexRun(
    `const out = []; for await (const c of ctx.db.query("leagueChallenge")) { if (c.leagueId === "${LEAGUE_ID}") out.push(c.status); } const mem = []; for await (const m of ctx.db.query("leagueMembership")) { if (m.leagueId === "${LEAGUE_ID}") mem.push(m.status); } const feeds = []; for await (const f of ctx.db.query("notificationFeed")) { if (f.recipientUserId === "${BRUNO.userId}" || f.recipientOrganizationId === "${ORG_ID}") feeds.push({ eventType: f.eventType, isRead: f.isRead, kind: f.recipientActorKind }); } const counts = {}; for (const t of ["charge","paymentProviderRequest"]) { let n = 0; for await (const d of ctx.db.query(t)) n++; counts[t] = n; } return { challenges: out, memberships: mem, feeds, counts };`
  );
  const tally = {};
  for (const s of res.challenges) {
    tally[s] = (tally[s] ?? 0) + 1;
  }
  console.log(
    JSON.stringify(
      {
        activeMembers: res.memberships.filter((s) => s === "active").length,
        challengeCount: res.challenges.length,
        challengeStates: tally,
        membershipCount: res.memberships.length,
        moneyTables: res.counts,
        notificationCount: res.feeds.length,
        pendingRequests: res.memberships.filter((s) => s === "pending").length,
      },
      null,
      2
    )
  );
} else {
  console.error("unknown stage");
  process.exit(1);
}
