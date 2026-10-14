// All MongoDB access lives here. Discord IDs are stored as strings.
import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDb(uri, dbName) {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  await Promise.all([
    db.collection('predictions').createIndex({ guildId: 1, season: 1, round: 1, userId: 1 }, { unique: true }),
    db.collection('scores').createIndex({ guildId: 1, season: 1, round: 1, userId: 1 }, { unique: true }),
    db.collection('announcements').createIndex({ guildId: 1, season: 1, round: 1, type: 1 }, { unique: true }),
  ]);
}

export async function closeDb() {
  await client?.close();
}

// ---------- settings ----------

export function setAnnouncementChannel(guildId, channelId) {
  return db.collection('settings').updateOne({ _id: guildId }, { $set: { channelId } }, { upsert: true });
}

export function getConfiguredGuilds() {
  return db.collection('settings').find({ channelId: { $exists: true } }).toArray();
}

// ---------- predictions ----------

export function savePrediction({ guildId, season, round, userId, winner, pole, fastestLap }) {
  return db.collection('predictions').updateOne(
    { guildId, season, round, userId },
    { $set: { winner, pole, fastestLap, updatedAt: new Date() } },
    { upsert: true },
  );
}

export function getPrediction(guildId, season, round, userId) {
  return db.collection('predictions').findOne({ guildId, season, round, userId });
}

export function getRoundPredictions(guildId, season, round) {
  return db.collection('predictions').find({ guildId, season, round }).toArray();
}

export function countRoundPredictions(guildId, season, round) {
  return db.collection('predictions').countDocuments({ guildId, season, round });
}

export async function hasSeasonPredictions(guildId, season) {
  return (await db.collection('predictions').countDocuments({ guildId, season }, { limit: 1 })) > 0;
}

/** Rounds this server made predictions for that have not been scored or voided yet. */
export async function getUnscoredRounds(guildId, season) {
  const [predicted, done] = await Promise.all([
    db.collection('predictions').distinct('round', { guildId, season }),
    db.collection('announcements').distinct('round', { guildId, season, type: { $in: ['scored', 'voided'] } }),
  ]);
  const doneSet = new Set(done);
  return predicted.filter((round) => !doneSet.has(round)).sort((a, b) => a - b);
}

// ---------- scores ----------

export async function saveRoundScores(guildId, season, round, scores) {
  if (scores.length === 0) return;
  await db.collection('scores').bulkWrite(
    scores.map(({ userId, ...points }) => ({
      updateOne: {
        filter: { guildId, season, round, userId },
        update: { $set: points },
        upsert: true,
      },
    })),
  );
}

export function getRoundScores(guildId, season, round) {
  return db.collection('scores').find({ guildId, season, round }).toArray();
}

/** One row per player: { userId, total, exact, races }. */
export function getSeasonTotals(guildId, season) {
  return db
    .collection('scores')
    .aggregate([
      { $match: { guildId, season } },
      {
        $group: {
          _id: '$userId',
          total: { $sum: '$total' },
          exact: { $sum: '$exact' },
          races: { $sum: 1 },
        },
      },
      { $project: { _id: 0, userId: '$_id', total: 1, exact: 1, races: 1 } },
    ])
    .toArray();
}

// ---------- announcements (so the scheduler never posts twice) ----------

export async function hasAnnounced(guildId, season, round, type) {
  return (await db.collection('announcements').countDocuments({ guildId, season, round, type }, { limit: 1 })) > 0;
}

export function markAnnounced(guildId, season, round, type) {
  return db.collection('announcements').updateOne(
    { guildId, season, round, type },
    { $setOnInsert: { at: new Date() } },
    { upsert: true },
  );
}
