import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getSchedule } from '../f1/jolpica.js';
import { getSeasonTotals } from '../db.js';
import { rankPlayers } from '../scoring.js';
import { leaderboardEmbed } from '../embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription("This season's prediction league standings")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const { season } = await getSchedule();
    const ranked = rankPlayers(await getSeasonTotals(interaction.guildId, season));
    const embed = leaderboardEmbed(season, ranked);

    const me = ranked.find((p) => p.userId === interaction.user.id);
    if (me) embed.setFooter({ text: `You're #${me.rank} with ${me.total} pts` });

    await interaction.editReply({ embeds: [embed] });
  },
};
