import { EmbedBuilder } from 'discord.js';
import { discordTime, lockTime } from './season.js';

const F1_RED = 0xe10600;
const GOLD = 0xf1c40f;
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const DESCRIPTION_LIMIT = 4096;

function base() {
  return new EmbedBuilder().setColor(F1_RED);
}

/** Join lines, stopping before Discord's length limit and noting how many were cut. */
function joinLines(lines, limit = DESCRIPTION_LIMIT) {
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const more = `\n…and ${lines.length - i} more`;
    const next = (out ? '\n' : '') + lines[i];
    if (out.length + next.length + more.length > limit) return out + more;
    out += next;
  }
  return out;
}

export function driverLabel(driver) {
  return driver ? `**${driver.code}** ${driver.name}` : 'Unknown driver';
}

function placeLabel(rank) {
  return MEDALS[rank] ?? `**${rank}.**`;
}

function raceTitle(race) {
  return `Round ${race.round} · ${race.name}`;
}

export function raceInfoEmbed(race, title = raceTitle(race)) {
  return base()
    .setTitle(title)
    .setDescription(`${race.circuit}, ${race.country}`)
    .addFields(
      { name: 'Qualifying', value: race.qualifyingStart ? discordTime(race.qualifyingStart) : 'TBC', inline: true },
      { name: 'Race', value: discordTime(race.raceStart), inline: true },
      { name: 'Picks lock', value: `${discordTime(lockTime(race))} (${discordTime(lockTime(race), 'R')})` },
    );
}

export function predictionsOpenEmbed(race) {
  return raceInfoEmbed(race, `🏁 Predictions open: ${race.name}`).setFooter({
    text: 'Use /predict to pick the winner, pole and fastest lap.',
  });
}

export function reminderEmbed(race, predictedCount) {
  return base()
    .setTitle(`⏰ Last call: ${race.name} picks`)
    .setDescription(
      `Picks lock ${discordTime(lockTime(race), 'R')}, when qualifying starts. ` +
        `${predictedCount} player${predictedCount === 1 ? ' has' : 's have'} predicted so far. Use /predict now!`,
    );
}

export function picksEmbed(race, picks, driversById) {
  return base()
    .setTitle(`Your picks · ${race.name}`)
    .addFields(
      { name: 'Winner', value: driverLabel(driversById.get(picks.winner)), inline: true },
      { name: 'Pole', value: driverLabel(driversById.get(picks.pole)), inline: true },
      { name: 'Fastest lap', value: driverLabel(driversById.get(picks.fastestLap)), inline: true },
    )
    .setFooter({ text: 'Run /predict again to change them before they lock.' })
    .addFields({ name: 'Locks', value: discordTime(lockTime(race), 'R') });
}

/** ranked: output of rankPlayers. */
export function leaderboardEmbed(season, ranked, { title = `🏆 ${season} League Leaderboard`, max = 25 } = {}) {
  const lines = ranked
    .slice(0, max)
    .map((p) => `${placeLabel(p.rank)} <@${p.userId}> · **${p.total}** pts · ${p.races} race${p.races === 1 ? '' : 's'}`);
  if (ranked.length > max) lines.push(`…and ${ranked.length - max} more`);
  return base()
    .setTitle(title)
    .setDescription(lines.length ? joinLines(lines) : 'No races scored yet. Make your picks with /predict!');
}

export function seasonEndEmbed(season, ranked) {
  const champion = ranked[0];
  const lines = ranked.map(
    (p) => `${placeLabel(p.rank)} <@${p.userId}> · **${p.total}** pts · ${p.exact} exact pick${p.exact === 1 ? '' : 's'}`,
  );
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`🏆 ${season} League Champion`)
    .setDescription(
      joinLines([`Congratulations <@${champion.userId}>, the ${season} prediction champion!`, '', '**Final standings**', ...lines]),
    );
}

/**
 * results/qualifying: from jolpica.js. roundScores: [{ userId, winner, pole, fastestLap, total }].
 */
export function raceResultsEmbed(results, qualifying, roundScores = null) {
  const top10 = results.results
    .filter((r) => r.position != null && r.position <= 10)
    .map((r) => `${r.position}. ${driverLabel(r.driver)} · ${r.team}`);
  const fastest = results.results.find((r) => r.fastestLapRank === 1);
  const pole = qualifying?.order.find((q) => q.position === 1);

  const embed = base()
    .setTitle(`🏁 ${raceTitle(results)} results`)
    .setDescription(top10.join('\n'))
    .addFields(
      { name: 'Pole position', value: pole ? driverLabel(pole.driver) : 'Unavailable', inline: true },
      {
        name: 'Fastest lap',
        value: fastest ? `${driverLabel(fastest.driver)} (${fastest.fastestLapTime})` : 'Unavailable',
        inline: true,
      },
    );

  if (roundScores) {
    const lines = [...roundScores]
      .sort((a, b) => b.total - a.total)
      .map((s) => `<@${s.userId}> · **${s.total}** pts (W ${s.winner} · P ${s.pole} · FL ${s.fastestLap})`);
    embed.addFields({
      name: 'League points this round',
      value: lines.length ? joinLines(lines, 1024) : 'Nobody in this server made picks for this race.',
    });
  }
  return embed;
}

export function driverStandingsEmbed(standings) {
  const lines = standings.entries.map(
    (e) => `${e.position}. ${driverLabel(e.driver)} · ${e.team} · **${e.points}** pts${e.wins ? ` · ${e.wins} win${e.wins === 1 ? '' : 's'}` : ''}`,
  );
  return base()
    .setTitle(`${standings.season} Drivers' Championship`)
    .setDescription(joinLines(lines))
    .setFooter({ text: `After round ${standings.round}` });
}

export function constructorStandingsEmbed(standings) {
  const lines = standings.entries.map(
    (e) => `${e.position}. **${e.team}** · **${e.points}** pts${e.wins ? ` · ${e.wins} win${e.wins === 1 ? '' : 's'}` : ''}`,
  );
  return base()
    .setTitle(`${standings.season} Constructors' Championship`)
    .setDescription(joinLines(lines))
    .setFooter({ text: `After round ${standings.round}` });
}
