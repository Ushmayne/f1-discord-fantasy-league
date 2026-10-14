// Background loop: posts "predictions open" and reminders, scores finished races,
// and announces the season champion. Every step is safe to repeat: the
// `announcements` collection records what was already posted.
import * as db from './db.js';
import { getQualifying, getRaceResults, getSchedule } from './f1/jolpica.js';
import { findOpenRace, findRace, isOpenPostDue, isReminderDue, isScoringDue, isVoidDue } from './season.js';
import { buildOutcome, rankPlayers, scorePicks } from './scoring.js';
import {
  leaderboardEmbed,
  predictionsOpenEmbed,
  raceResultsEmbed,
  reminderEmbed,
  seasonEndEmbed,
} from './embeds.js';

const TICK_MS = 15 * 60 * 1000;
const SEASON_END_ROUND = 0;

export function startScheduler(client) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick(client, new Date());
    } catch (err) {
      console.error('[scheduler] tick failed:', err);
    } finally {
      running = false;
    }
  };
  run();
  return setInterval(run, TICK_MS);
}

async function tick(client, now) {
  const { season, races } = await getSchedule();
  for (const { _id: guildId, channelId } of await db.getConfiguredGuilds()) {
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      const ctx = { guildId, channel, season, races, now };
      await postOpenAndReminder(ctx);
      await scoreFinishedRounds(ctx);
      await announceSeasonEnd(ctx);
    } catch (err) {
      console.error(`[scheduler] guild ${guildId} failed:`, err);
    }
  }
}

/** Post once per (round, type). If posting fails it is retried next tick. */
async function announceOnce({ guildId, channel, season }, round, type, buildMessage) {
  if (await db.hasAnnounced(guildId, season, round, type)) return;
  if (!channel?.isTextBased()) {
    console.warn(`[scheduler] guild ${guildId}: announcement channel missing, skipped ${type} for round ${round}`);
    return;
  }
  try {
    await channel.send({ ...(await buildMessage()), allowedMentions: { parse: [] } });
  } catch (err) {
    console.error(`[scheduler] guild ${guildId}: could not post ${type} for round ${round}:`, err.message);
    return;
  }
  await db.markAnnounced(guildId, season, round, type);
}

async function postOpenAndReminder(ctx) {
  const race = findOpenRace(ctx.races, ctx.now);
  if (!race) return;
  if (isOpenPostDue(ctx.races, race, ctx.now)) {
    await announceOnce(ctx, race.round, 'open', () => ({ embeds: [predictionsOpenEmbed(race)] }));
  }
  if (isReminderDue(race, ctx.now)) {
    await announceOnce(ctx, race.round, 'reminder', async () => ({
      embeds: [reminderEmbed(race, await db.countRoundPredictions(ctx.guildId, ctx.season, race.round))],
    }));
  }
}

async function scoreFinishedRounds(ctx) {
  const { guildId, season, races, now } = ctx;
  for (const round of await db.getUnscoredRounds(guildId, season)) {
    const race = findRace(races, round);
    if (race && !isScoringDue(race, now)) continue;

    const [results, qualifying] = race
      ? await Promise.all([getRaceResults(season, round), getQualifying(season, round)])
      : [null, null];

    if (!results || !qualifying) {
      // Dropped from the calendar, or still no results a week later: treat as cancelled.
      if (!race || isVoidDue(race, now)) {
        await announceOnce(ctx, round, 'voided', () => ({
          content: `⚠️ ${race?.name ?? `Round ${round}`} has no results, so its picks will not be scored.`,
        }));
      }
      continue;
    }

    const outcome = buildOutcome(results, qualifying);
    const predictions = await db.getRoundPredictions(guildId, season, round);
    const scores = predictions.map((p) => ({ userId: p.userId, ...scorePicks(p, outcome) }));
    await db.saveRoundScores(guildId, season, round, scores);

    const ranked = rankPlayers(await db.getSeasonTotals(guildId, season));
    await announceOnce(ctx, round, 'scored', () => ({
      embeds: [raceResultsEmbed(results, qualifying, scores), leaderboardEmbed(season, ranked, { max: 10 })],
    }));
  }
}

async function announceSeasonEnd(ctx) {
  const { guildId, season, races, now } = ctx;
  const finalRace = races.at(-1);
  if (!finalRace || !isScoringDue(finalRace, now)) return;
  if (await db.hasAnnounced(guildId, season, SEASON_END_ROUND, 'season_end')) return;
  if (!(await db.hasSeasonPredictions(guildId, season))) return;
  if ((await db.getUnscoredRounds(guildId, season)).length > 0) return;
  if (!(await getRaceResults(season, finalRace.round))) return;

  const ranked = rankPlayers(await db.getSeasonTotals(guildId, season));
  if (ranked.length === 0) return;
  await announceOnce(ctx, SEASON_END_ROUND, 'season_end', () => ({ embeds: [seasonEndEmbed(season, ranked)] }));
}
