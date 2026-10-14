import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getSchedule } from '../f1/jolpica.js';
import { findOpenRace } from '../season.js';
import { raceInfoEmbed } from '../embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nextrace')
    .setDescription('When the next Grand Prix is and when picks lock')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const { races } = await getSchedule();
    const race = findOpenRace(races, new Date());
    if (!race) {
      await interaction.editReply('The season is over. See you next year!');
      return;
    }
    await interaction.editReply({ embeds: [raceInfoEmbed(race)] });
  },
};
