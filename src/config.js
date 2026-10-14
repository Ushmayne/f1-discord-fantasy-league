function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

export function loadConfig() {
  return {
    discordToken: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    devGuildId: process.env.DISCORD_GUILD_ID?.trim() || null,
    mongoUri: required('MONGODB_URI'),
    mongoDb: process.env.MONGODB_DB?.trim() || 'f1league',
  };
}
