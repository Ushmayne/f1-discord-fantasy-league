import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getPickableDrivers, getSchedule } from '../f1/jolpica.js';
import { findOpenRace } from '../season.js';
import { getPrediction } from '../db.js';
import { picksEmbed } from '../embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mypicks')
    .setDescription('See your picks for the next Grand Prix')
    .setContexts(InteractionContextType.Guild),
  ephemeral: true,

  async execute(interaction) {
    const { season, races } = await getSchedule();
    const race = findOpenRace(races, new Date());
    if (!race) {
      await interaction.editReply('There are no more races to predict this season.');
      return;
    }

    const picks = await getPrediction(interaction.guildId, season, race.round, interaction.user.id);
    if (!picks) {
      await interaction.editReply(`You haven't made picks for the ${race.name} yet. Use /predict!`);
      return;
    }

    const drivers = await getPickableDrivers(season);
    await interaction.editReply({ embeds: [picksEmbed(race, picks, new Map(drivers.map((d) => [d.id, d])))] });
  },
};
