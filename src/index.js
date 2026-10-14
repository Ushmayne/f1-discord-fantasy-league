import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { loadConfig } from './config.js';
import { closeDb, connectDb } from './db.js';
import { F1DataError } from './f1/jolpica.js';
import { commands } from './commands/index.js';
import { startScheduler } from './scheduler.js';

const config = loadConfig();
const commandsByName = new Map(commands.map((c) => [c.data.name, c]));

async function registerCommands() {
  const rest = new REST().setToken(config.discordToken);
  const route = config.devGuildId
    ? Routes.applicationGuildCommands(config.clientId, config.devGuildId)
    : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body: commands.map((c) => c.data.toJSON()) });
  console.log(`Registered ${commands.length} commands ${config.devGuildId ? `in server ${config.devGuildId}` : 'globally'}`);
}

async function handleInteraction(interaction) {
  const command = commandsByName.get(interaction.commandName);
  if (!command) return;

  if (interaction.isAutocomplete()) {
    // Autocomplete must answer within 3 seconds; on failure show no suggestions.
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(`/${interaction.commandName} autocomplete failed:`, err);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  try {
    // Defer first: F1 API calls can take longer than Discord's 3-second reply window.
    await interaction.deferReply(command.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    await command.execute(interaction);
  } catch (err) {
    console.error(`/${interaction.commandName} failed:`, err);
    const message =
      err instanceof F1DataError
        ? 'F1 data is unavailable right now. Try again in a few minutes.'
        : 'Something went wrong running that command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, embeds: [] }).catch(() => {});
    }
  }
}

await connectDb(config.mongoUri, config.mongoDb);
console.log('Connected to MongoDB');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on(Events.InteractionCreate, handleInteraction);
client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  await registerCommands().catch((err) => console.error('Failed to register slash commands:', err));
  startScheduler(c);
});

async function shutdown() {
  await client.destroy();
  await closeDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(config.discordToken);
