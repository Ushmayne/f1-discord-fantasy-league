import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getConstructorStandings, getDriverStandings } from '../f1/jolpica.js';
import { constructorStandingsEmbed, driverStandingsEmbed } from '../embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('standings')
    .setDescription('The current F1 championship standings')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Drivers or constructors (default: drivers)')
        .addChoices({ name: 'Drivers', value: 'drivers' }, { name: 'Constructors', value: 'constructors' }),
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type') ?? 'drivers';
    const standings = type === 'drivers' ? await getDriverStandings() : await getConstructorStandings();
    if (!standings) {
      await interaction.editReply('No standings yet. The season has not started.');
      return;
    }
    const embed = type === 'drivers' ? driverStandingsEmbed(standings) : constructorStandingsEmbed(standings);
    await interaction.editReply({ embeds: [embed] });
  },
};
