import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { setAnnouncementChannel } from '../db.js';

const NEEDED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Choose the channel for league announcements')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post race scores, reminders and the season result')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    ),
  ephemeral: true,

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const me = await interaction.guild.members.fetchMe();
    if (!channel.permissionsFor?.(me)?.has(NEEDED)) {
      await interaction.editReply(`I need View Channel, Send Messages and Embed Links in ${channel} first.`);
      return;
    }

    await setAnnouncementChannel(interaction.guildId, channel.id);
    await interaction.editReply(`✅ League announcements will be posted in ${channel}.`);
  },
};
