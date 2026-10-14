# f1-discord-fantasy-league

A Discord bot that runs an F1 prediction league. Before each Grand Prix, players
pick the **race winner**, **pole position** and **fastest lap**. After the race
the bot scores every pick, posts the results, and keeps a season leaderboard. At
the end of the season it crowns the league champion.

## Scoring

Each pick earns points based on where that driver actually placed:

| Place | 1st | 2nd | 3rd | 4th–5th | 6th+ / DNF |
|---|---|---|---|---|---|
| Points | 10 | 6 | 4 | 2 | 0 |

Winner uses the race result, pole uses the qualifying result, and fastest lap uses
the fastest-lap ranking. A perfect weekend is worth 30. Ties on the leaderboard are
broken by the number of exact (10-point) picks.

**Picks lock when Grand Prix qualifying starts.**

## Commands

| Command | What it does |
|---|---|
| `/predict winner pole fastest_lap` | Make or change your picks for the next race |
| `/mypicks` | See your current picks (only you can see this) |
| `/nextrace` | Next Grand Prix, session times and lock time |
| `/leaderboard` | League standings for this season |
| `/results [round]` | Race results plus league points for that round |
| `/standings [drivers\|constructors]` | Current F1 championship standings |
| `/setup channel` | Admins: choose where the bot posts announcements |

Once `/setup` is done, the bot posts automatically in that channel: when picks open
for a race, a reminder 1 hour before they lock, the scores after each race, and the
final standings when the season ends.

F1 data comes from the free [Jolpica F1 API](https://github.com/jolpica/jolpica-f1).

## Setup

You need Node.js 22.9 or newer.

### 1. Create the Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Copy the **Application ID** from *General Information*. This is `DISCORD_CLIENT_ID`.
3. Open *Bot*, click **Reset Token**, and copy it. This is `DISCORD_TOKEN`. Keep it secret.
4. Invite the bot to your server with this link, replacing `YOUR_CLIENT_ID`:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=19456
   ```

   (19456 = View Channels + Send Messages + Embed Links.)

### 2. Create the MongoDB database

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under *Database Access*, add a database user with a password.
3. Under *Network Access*, allow your host's IP. Most cloud hosts don't have a fixed IP, so you may need `0.0.0.0/0`.
4. Click **Connect → Drivers** and copy the connection string. This is `MONGODB_URI` (fill in your password).

### 3. Run it locally

```powershell
npm install
```

Put your secrets in the `.env` file in the project root. It's already in
`.gitignore`, so it is never committed. If it's missing (e.g. after a fresh clone),
create it from the template: `Copy-Item .env.example .env` (macOS/Linux:
`cp .env.example .env`). Fill in:

| Variable | Required | Where to find it |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Developer Portal → *Bot* → Reset Token |
| `DISCORD_CLIENT_ID` | Yes | Developer Portal → *General Information* → Application ID |
| `DISCORD_GUILD_ID` | No | Your server's ID (see [One server or many](#one-server-or-many)) |
| `MONGODB_URI` | Yes | Atlas → Connect → Drivers |
| `MONGODB_DB` | No | Database name, defaults to `f1league` |

Then start the bot:

```powershell
npm start
```

You should see `Connected to MongoDB`, `Logged in as …` and `Registered 7 commands`.
In Discord, run `/setup channel:#your-channel` to choose where the bot posts.

### 4. Deploy to a cloud host

The bot has to run 24/7, so use a plan that doesn't sleep when idle. On Railway:

1. Push this repo to GitHub.
2. In Railway, choose **New Project → Deploy from GitHub repo** and pick this repo.
3. In the service's **Variables** tab, add the same variables as your `.env`.
4. Railway runs `npm start` automatically. Check **Deploy Logs** for the startup messages above.

Only one copy of the bot should run at a time. Stop the local one once the hosted
one is up.

### One server or many

If the league only runs in one server, set `DISCORD_GUILD_ID` to that server's ID
(right-click the server → *Copy Server ID*, with Developer Mode on). Commands then
update instantly. Leave it empty to make the commands available in every server the
bot joins. Don't switch back and forth: a server that has both kinds shows each
command twice.

## How it works

- **Which race picks go to:** the earliest race whose qualifying hasn't started.
  Once qualifying starts, that race locks and `/predict` moves on to the next one.
- **Scoring:** every 15 minutes the bot checks for finished races. About 2 hours
  after a race starts, once results are published, it scores everyone's picks and
  posts the results. If the bot was offline, it catches up when it restarts.
- **Final results:** each race is scored once. Penalties handed out later don't
  change league points.
- **Cancelled races:** if a race has no results a week later, its picks aren't scored.
- **Not included:** sprint races.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing required environment variable …` | A variable is missing from `.env` or your host's settings. |
| MongoDB connection times out | Add your IP (or `0.0.0.0/0`) under Atlas *Network Access*, and check the password in the URI. |
| Commands don't appear in Discord | Global commands can take a while. Set `DISCORD_GUILD_ID` for instant updates, and re-invite the bot with the link above (it needs the `applications.commands` scope). |
| `/setup` says it's missing permissions | Give the bot View Channel, Send Messages and Embed Links in that channel. |
| Bot never posts on its own | Run `/setup` first. Posts only happen at the right moments (picks open, 1h before lock, after a race). |
| "F1 data is unavailable" | The Jolpica API is down or slow. Try again in a few minutes. |

## Project structure

```
src/
  index.js          starts the bot, routes commands
  config.js         reads environment variables
  db.js             all MongoDB access
  scheduler.js      automatic posts and scoring (every 15 min)
  scoring.js        points and leaderboard ranking
  season.js         race-weekend timing (lock, reminders, scoring)
  embeds.js         Discord message layouts
  f1/jolpica.js     F1 data from the Jolpica API
  commands/         one file per slash command
test/               unit tests + real API fixtures
```

## Development

```sh
npm test
```

Tests cover scoring, ranking, race-weekend timing, and parsing real API responses
(`test/fixtures`).
