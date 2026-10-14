import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getQualifying, getRaceResults, getSchedule } from '../f1/jolpica.js';
import { countRoundPredictions, getRoundScores } from '../db.js';
import { raceResultsEmbed } from '../embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('results')
    .setDescription('Race results and league points for a round (latest race by default)')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('round').setDescription('Round number').setMinValue(1).setMaxValue(30)),

  async execute(interaction) {
    const { season } = await getSchedule();
    const round = interaction.options.getInteger('round');
    const results = await getRaceResults(season, round ?? 'last');
    if (!results || results.season !== season) {
      await interaction.editReply(round ? `There are no results for round ${round} yet.` : 'No races have finished this season yet.');
      return;
    }

    const [qualifying, scores, predicted] = await Promise.all([
      getQualifying(season, results.round),
      getRoundScores(interaction.guildId, season, results.round),
      countRoundPredictions(interaction.guildId, season, results.round),
    ]);

    // Picks exist but the scheduler hasn't scored them yet (it runs every 15 minutes).
    const scoringPending = scores.length === 0 && predicted > 0;
    const embed = raceResultsEmbed(results, qualifying, scoringPending ? null : scores);
    if (scoringPending) embed.setFooter({ text: 'League points for this round are still being scored.' });
    await interaction.editReply({ embeds: [embed] });
  },
};
