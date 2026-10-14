import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getPickableDrivers, getSchedule } from '../f1/jolpica.js';
import { findOpenRace } from '../season.js';
import { savePrediction } from '../db.js';
import { picksEmbed } from '../embeds.js';

const PICKS = [
  { option: 'winner', field: 'winner', label: 'Winner' },
  { option: 'pole', field: 'pole', label: 'Pole' },
  { option: 'fastest_lap', field: 'fastestLap', label: 'Fastest lap' },
];

/**
 * Discord does not force users to choose an autocomplete suggestion, so accept a
 * driverId (what a suggestion sends) or a typed code / surname / full name.
 */
export function resolveDriver(input, drivers) {
  const needle = input.trim().toLowerCase();
  return (
    drivers.find((d) => d.id === needle) ??
    drivers.find((d) => d.code.toLowerCase() === needle || d.name.toLowerCase() === needle) ??
    drivers.find((d) => d.name.toLowerCase().split(' ').at(-1) === needle) ??
    null
  );
}

const data = new SlashCommandBuilder()
  .setName('predict')
  .setDescription('Pick the race winner, pole sitter and fastest lap for the next Grand Prix')
  .setContexts(InteractionContextType.Guild);
for (const pick of PICKS) {
  data.addStringOption((o) =>
    o.setName(pick.option).setDescription(`${pick.label} pick`).setRequired(true).setAutocomplete(true),
  );
}

export default {
  data,
  ephemeral: true,

  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const { season } = await getSchedule();
    const drivers = await getPickableDrivers(season);
    const matches = drivers.filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(typed));
    await interaction.respond(matches.slice(0, 25).map((d) => ({ name: `${d.name} (${d.code})`, value: d.id })));
  },

  async execute(interaction) {
    const { season, races } = await getSchedule();
    const race = findOpenRace(races, new Date());
    if (!race) {
      await interaction.editReply('There are no more races to predict this season.');
      return;
    }

    const drivers = await getPickableDrivers(season);
    const picks = {};
    const unknown = [];
    for (const pick of PICKS) {
      const input = interaction.options.getString(pick.option, true);
      const driver = resolveDriver(input, drivers);
      if (driver) picks[pick.field] = driver.id;
      else unknown.push(`${pick.label}: "${input}"`);
    }
    if (unknown.length) {
      await interaction.editReply(
        `I couldn't find these drivers: ${unknown.join(', ')}. Choose from the suggestions as you type.`,
      );
      return;
    }

    await savePrediction({ guildId: interaction.guildId, season, round: race.round, userId: interaction.user.id, ...picks });
    await interaction.editReply({
      content: '✅ Picks saved!',
      embeds: [picksEmbed(race, picks, new Map(drivers.map((d) => [d.id, d])))],
    });
  },
};
