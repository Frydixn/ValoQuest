import axios from "axios";
import { supabase } from "./supabaseClient";

const HENRIK_BASE = "https://api.henrikdev.xyz";
const API_KEY = import.meta.env.VITE_HENRIK_API_KEY || "";
const headers = API_KEY ? { Authorization: API_KEY } : {};

export async function getAccount(name, tag) {
  const url = `${HENRIK_BASE}/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  const { data } = await axios.get(url, { headers });
  return data.data;
}

export async function getMMR(region, name, tag) {
  const url = `${HENRIK_BASE}/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  const { data } = await axios.get(url, { headers });
  return data.data;
}

export async function getMMRHistory(region, name, tag) {
  try {
    const url = `${HENRIK_BASE}/valorant/v1/mmr-history/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    const { data } = await axios.get(url, { headers });
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getMatchHistory(region, name, tag, size = 20) {
  const url = `${HENRIK_BASE}/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=${size}&mode=competitive`;
  const { data } = await axios.get(url, { headers });
  const rawMatches = data.data || [];
  return rawMatches.filter((m) => m.metadata?.mode?.toLowerCase() === "competitive");
}

export async function getFullMatchHistory(region, name, tag) {
  const allMatches = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    try {
      const url = `${HENRIK_BASE}/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=20&page=${page}&mode=competitive`;
      const { data } = await axios.get(url, { headers });
      const batch = data.data || [];
      if (batch.length === 0) break;
      allMatches.push(...batch);
      if (batch.length < 20) break;
      page++;
    } catch {
      break;
    }
  }

  return allMatches.filter((m) => m.metadata?.mode?.toLowerCase() === "competitive");
}

export function buildActStats(mmr) {
  if (!mmr) return null;
  const current = mmr.current_data;
  if (!current) return null;

  return {
    rankName: current.currenttierpatched || "Unranked",
    rankTier: current.currenttier || 0,
    rr: current.ranking_in_tier || 0,
    elo: current.elo || 0,
    mmrChange: current.mmr_change_to_last_game || 0,
    peakRankName: mmr.highest_rank?.patched_tier || null,
    peakRankTier: mmr.highest_rank?.tier || 0,
  };
}

export function buildAgentsByMap(matches, puuid) {
  if (!matches || matches.length === 0) return {};

  const firstMatchMeta = matches[0]?.metadata;
  const latestSeason = firstMatchMeta?.season_id || firstMatchMeta?.season?.id || firstMatchMeta?.season?.short;

  const targetMatches = latestSeason
    ? matches.filter((m) => {
      const mSeason = m.metadata?.season_id || m.metadata?.season?.id || m.metadata?.season?.short;
      return mSeason === latestSeason;
    })
    : matches;

  const data = {};

  for (const match of targetMatches) {
    const players = match.players?.all_players || [];
    const me = players.find((p) => p.puuid === puuid);
    if (!me) continue;

    const mapName = match.metadata?.map || "Desconocido";
    const agent = me.character || "Unknown";
    const myTeam = me.team?.toLowerCase();
    const won = match.teams?.[myTeam]?.has_won ?? false;

    if (!data[mapName]) data[mapName] = {};
    if (!data[mapName][agent]) data[mapName][agent] = { games: 0, wins: 0 };

    data[mapName][agent].games += 1;
    if (won) data[mapName][agent].wins += 1;
  }

  const result = {};
  for (const [map, agents] of Object.entries(data)) {
    result[map] = Object.entries(agents)
      .map(([agent, s]) => ({
        agent,
        games: s.games,
        wins: s.wins,
        winrate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
  }

  return result;
}

export function aggregateStats(account, mmr, matches) {
  const stats = {
    totalKills: 0, totalDeaths: 0, totalAssists: 0, totalDamage: 0,
    totalWins: 0, matchesPlayed: matches.length,
    headshots: 0, bodyshots: 0, legshots: 0,
    aces: 0, mvps: 0, clutches: 0, comebackWins: 0, flawlessRounds: 0,
    agentCounts: {}, mapCounts: {},
  };

  for (const match of matches) {
    const meta = match.metadata;
    const players = match.players?.all_players || [];
    const me = players.find((p) => p.puuid === account.puuid);
    if (!me) continue;

    stats.totalKills += me.stats.kills || 0;
    stats.totalDeaths += me.stats.deaths || 0;
    stats.totalAssists += me.stats.assists || 0;
    stats.totalDamage += me.damage_made || me.stats.damage || 0;
    stats.headshots += me.stats.headshots || 0;
    stats.bodyshots += me.stats.bodyshots || 0;
    stats.legshots += me.stats.legshots || 0;

    const agent = me.character || "Unknown";
    stats.agentCounts[agent] = (stats.agentCounts[agent] || 0) + 1;

    const map = meta?.map || "Unknown";
    stats.mapCounts[map] = (stats.mapCounts[map] || 0) + 1;

    const myTeam = me.team;
    const won = match.teams?.[myTeam?.toLowerCase()]?.has_won;
    if (won) stats.totalWins += 1;

    if (me.stats.kills >= 20 && meta.rounds_played && me.stats.kills / meta.rounds_played >= 1.5) {
      stats.aces += 1;
    }

    const maxScore = Math.max(...players.map((p) => p.stats.score || 0));
    if (me.stats.score === maxScore) stats.mvps += 1;
  }

  const totalShots = stats.headshots + stats.bodyshots + stats.legshots;
  const headshotPct = totalShots > 0 ? (stats.headshots / totalShots) * 100 : 0;
  const winrate = stats.matchesPlayed > 0 ? (stats.totalWins / stats.matchesPlayed) * 100 : 0;
  const kdRatio = stats.totalDeaths > 0 ? stats.totalKills / stats.totalDeaths : stats.totalKills;
  const uniqueAgents = Object.keys(stats.agentCounts).length;
  const uniqueMaps = Object.keys(stats.mapCounts).length;

  let mostPlayedAgent = null, mostPlayedAgentCount = 0;
  for (const [agent, count] of Object.entries(stats.agentCounts)) {
    if (count > mostPlayedAgentCount) { mostPlayedAgent = agent; mostPlayedAgentCount = count; }
  }

  return {
    totalKills: stats.totalKills, totalDeaths: stats.totalDeaths,
    totalAssists: stats.totalAssists, totalDamage: stats.totalDamage,
    totalWins: stats.totalWins, matchesPlayed: stats.matchesPlayed,
    headshotPct: Number(headshotPct.toFixed(1)),
    winrate: Number(winrate.toFixed(1)),
    kdRatio: Number(kdRatio.toFixed(2)),
    aces: stats.aces, mvps: stats.mvps, clutches: stats.clutches,
    comebackWins: stats.comebackWins, flawlessRounds: stats.flawlessRounds,
    uniqueAgents, uniqueMaps, mostPlayedAgent, mostPlayedAgentCount,
    accountLevel: account.account_level || 0,
    rankTier: mmr?.current_data?.currenttierpatched || "Unranked",
    agentsByMap: buildAgentsByMap(matches, account.puuid),
    accountCard: account.card || null,
    mmr: mmr ? {
      current_data: mmr.current_data || null,
      highest_rank: mmr.highest_rank || null,
      seasonal: mmr.seasonal || mmr.by_season || null,
    } : null,
  };
}

export async function syncPlayerMatches(region, name, tag, puuid, existingMatchIdsSet) {
  const newMatches = [];
  let page = 1;
  const maxPages = 10;
  let hitExisting = false;

  while (page <= maxPages && !hitExisting) {
    try {
      const url = `${HENRIK_BASE}/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=20&page=${page}&mode=competitive`;
      const { data } = await axios.get(url, { headers });
      const batch = data.data || [];
      if (batch.length === 0) break;

      const compBatch = batch.filter((m) => m.metadata?.mode?.toLowerCase() === "competitive");
      if (compBatch.length === 0) {
        page++;
        continue;
      }

      for (const match of compBatch) {
        const matchId = match.metadata?.matchid || match.metadata?.match_id;
        if (!matchId) continue;

        if (existingMatchIdsSet.has(matchId)) {
          hitExisting = true;
          break;
        } else {
          newMatches.push(match);
        }
      }

      if (batch.length < 20) break;
      page++;
    } catch (err) {
      console.error("Error al obtener página de partidas:", err.message);
      break;
    }
  }

  if (newMatches.length > 0) {
    const rowsToInsert = newMatches.map((m) => ({
      puuid,
      match_id: m.metadata?.matchid || m.metadata?.match_id,
      match_data: m,
    }));

    const { error } = await supabase
      .from("player_matches")
      .upsert(rowsToInsert, { onConflict: "puuid,match_id", ignoreDuplicates: true });

    if (error) {
      console.warn("Error al guardar partidas en Supabase:", error.message);
    }
  }

  return newMatches.length;
}