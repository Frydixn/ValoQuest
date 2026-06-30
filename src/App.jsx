import React, { useState } from "react";
import Header from "./components/Header";
import PlayerProfileBar from "./components/PlayerProfileBar";
import ActStatsBar from "./components/ActStatsBar";
import StatsGrid from "./components/StatsGrid";
import MapAgentsPanel from "./components/MapAgentsPanel";
import Filters from "./components/Filters";
import AchievementsGrid from "./components/AchievementsGrid";
import ComparePanel from "./components/ComparePanel";
import Sidebar from "./components/Sidebar";
import TrackerView from "./components/TrackerView";
import { supabase } from "./services/supabaseClient";
import {
  getAccount, getMMR, getMMRHistory,
  getFullMatchHistory, aggregateStats, buildActStats,
  syncPlayerMatches,
} from "./services/statsEngine";
import { evaluateAchievements } from "./services/achievementEvaluator";

async function loadOrSyncPlayerProfile(name, tag) {
  const account = await getAccount(name, tag);
  const region = account.region;
  const puuid = account.puuid;

  let existingMatchIdsSet = new Set();
  try {
    const { data: storedMatchIdsRaw, error: dbErr } = await supabase
      .from("player_matches")
      .select("match_id")
      .eq("puuid", puuid);
    if (!dbErr && storedMatchIdsRaw) {
      existingMatchIdsSet = new Set(storedMatchIdsRaw.map((row) => row.match_id));
    }
  } catch (err) {
    console.warn("No se pudieron leer match_ids de Supabase (posible tabla inexistente o RLS):", err.message);
  }

  try {
    await syncPlayerMatches(region, name, tag, puuid, existingMatchIdsSet);
  } catch (err) {
    console.warn("Fallo en sincronización de partidas a Supabase:", err.message);
  }

  let matches = [];
  try {
    const { data: allStoredMatchesRaw, error: dbErr } = await supabase
      .from("player_matches")
      .select("match_data")
      .eq("puuid", puuid);
    if (!dbErr && allStoredMatchesRaw) {
      matches = allStoredMatchesRaw.map((row) => row.match_data) || [];
    }
  } catch (err) {
    console.warn("No se pudieron leer partidas de Supabase:", err.message);
  }

  if (matches.length === 0) {
    console.warn("Historial de base de datos vacío o inaccesible. Usando fallback directo de API.");
    try {
      matches = await getFullMatchHistory(region, name, tag);
    } catch (err) {
      console.error("Fallo al obtener historial de fallback de API:", err.message);
    }
  }

  let mmr = null;
  try {
    mmr = await getMMR(region, name, tag);
  } catch (e) {
    console.warn("MMR no disponible:", e.message);
  }

  const stats = aggregateStats(account, mmr, matches);
  const actStats = buildActStats(mmr);
  const achievements = evaluateAchievements(stats);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const result = {
    account: {
      puuid: account.puuid, name: account.name,
      tag: account.tag, region, account_level: account.account_level,
      card: account.card || null,
    },
    stats, actStats, mmrHistory: [], achievements, matches,
    summary: {
      total: achievements.length, unlocked: unlockedCount,
      percent: Math.round((unlockedCount / achievements.length) * 100),
    },
  };

  try {
    await saveToSupabase(result);
  } catch (dbErr) {
    console.warn("No se pudo guardar el snapshot en Supabase:", dbErr.message);
  }

  return result;
}

async function saveToSupabase(playerData) {
  const { account, stats, achievements } = playerData;
  try {
    await supabase.from("players").upsert({
      puuid: account.puuid, name: account.name, tag: account.tag,
      region: account.region, account_level: account.account_level,
      last_updated: new Date().toISOString(),
    });
    await supabase.from("player_stats_snapshots").insert({ puuid: account.puuid, stats });

    const unlockedRows = achievements
      .filter((a) => a.unlocked)
      .map((a) => ({ puuid: account.puuid, achievement_id: a.id }));
    if (unlockedRows.length > 0) {
      await supabase.from("player_achievements")
        .upsert(unlockedRows, { onConflict: "puuid,achievement_id", ignoreDuplicates: true });
    }
  } catch (dbErr) {
    console.warn("Error guardando en Supabase:", dbErr.message);
  }
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [playerData, setPlayerData] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [compareMode, setCompareMode] = useState(false);
  const [friendData, setFriendData] = useState(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [activeTab, setActiveTab] = useState("tracker");

  const handleSearch = async (name, tag) => {
    setLoading(true);
    setError("");
    setPlayerData(null);
    setFriendData(null);
    setCompareMode(false);
    setActiveFilter("all");
    setSearchTerm("");
    setActiveTab("tracker");

    try {
      const { data: player } = await supabase
        .from("players").select("*")
        .ilike("name", name).ilike("tag", tag).maybeSingle();

      if (player) {
        const { data: snapshot } = await supabase
          .from("player_stats_snapshots").select("stats")
          .eq("puuid", player.puuid)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();

        if (snapshot?.stats) {
          const achievements = evaluateAchievements(snapshot.stats);
          const unlockedCount = achievements.filter((a) => a.unlocked).length;
          
          let matches = [];
          try {
            const { data: storedMatchesRaw } = await supabase
              .from("player_matches")
              .select("match_data")
              .eq("puuid", player.puuid);
            if (storedMatchesRaw) {
              matches = storedMatchesRaw.map((row) => row.match_data) || [];
            }
          } catch (e) {
            console.warn("No se pudieron leer partidas para el snapshot:", e.message);
          }

          setPlayerData({
            account: { 
              puuid: player.puuid, name: player.name, tag: player.tag, region: player.region, account_level: player.account_level,
              card: snapshot.stats.accountCard || null
            },
            stats: snapshot.stats, actStats: snapshot.stats.actStats || null, mmrHistory: [],
            achievements,
            matches,
            summary: { total: achievements.length, unlocked: unlockedCount, percent: Math.round((unlockedCount / achievements.length) * 100) },
          });
          setLoading(false);
          return;
        }
      }

      const result = await loadOrSyncPlayerProfile(name, tag);
      setPlayerData(result);
    } catch (err) {
      setError(err.message || "Error al buscar el jugador. Verificá los datos e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!playerData?.account) return;
    const { name, tag } = playerData.account;
    setRefreshing(true);
    setError("");
    try {
      const result = await loadOrSyncPlayerProfile(name, tag);
      setPlayerData(result);
    } catch (err) {
      setError(err.message || "Error al actualizar los datos.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleFriendSearch = async (name, tag) => {
    setFriendLoading(true);
    setFriendError("");
    try {
      const result = await loadOrSyncPlayerProfile(name, tag);
      setFriendData(result);
      setCompareMode(true);
    } catch (err) {
      setFriendError(err.message || "No se pudo cargar el perfil del amigo.");
    } finally {
      setFriendLoading(false);
    }
  };

  const handleCloseCompare = () => {
    setCompareMode(false);
    setFriendData(null);
    setFriendError("");
  };

  const filteredAchievements = playerData
    ? playerData.achievements.filter((ach) => {
      if (activeFilter === "unlocked" && !ach.unlocked) return false;
      if (activeFilter === "locked" && ach.unlocked) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return ach.name.toLowerCase().includes(term) || ach.desc.toLowerCase().includes(term);
      }
      return true;
    })
    : [];

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} playerData={playerData} />
      
      <div className="app-main">
        <div className="noise-bar"></div>
        <Header onSearch={handleSearch} loading={loading} />

        <main>
          {loading && (
            <div className="state-msg loading-msg">
              <div className="loading-spinner"></div>
              Sincronizando expediente competitivo de combate...
              <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                Esto puede tardar unos segundos — guardando partidas nuevas en Supabase
              </span>
            </div>
          )}

          {error && <div className="state-msg error">{error}</div>}

          {!loading && !error && !playerData && (
            <div className="state-msg">Esperando un Riot ID para empezar a escanear...</div>
          )}

          {!loading && playerData && (
            <div className="results-container">
              <PlayerProfileBar
                account={playerData.account}
                stats={playerData.stats}
                latestAct={playerData.matches?.[0]?.metadata?.season || { short: playerData.matches?.[0]?.metadata?.season_id || "E11A4" }}
                summary={playerData.summary}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onGoToTracker={() => setActiveTab("tracker")}
              />

              {playerData.actStats && <ActStatsBar actStats={playerData.actStats} />}

              <StatsGrid stats={playerData.stats} />

              {activeTab === "tracker" && (
                <>
                  {playerData.stats.agentsByMap && Object.keys(playerData.stats.agentsByMap).length > 0 && (
                    <MapAgentsPanel agentsByMap={playerData.stats.agentsByMap} />
                  )}
                  <TrackerView playerData={playerData} />
                </>
              )}

              {activeTab === "achievements" && (
                <>
                  <ComparePanel
                    playerData={playerData}
                    friendData={friendData}
                    friendLoading={friendLoading}
                    friendError={friendError}
                    compareMode={compareMode}
                    onFriendSearch={handleFriendSearch}
                    onClose={handleCloseCompare}
                  />
                  <Filters
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                  />
                  <AchievementsGrid
                    achievements={filteredAchievements}
                    friendAchievements={compareMode && friendData ? friendData.achievements : null}
                  />
                </>
              )}
            </div>
          )}
        </main>

        <footer>
          Proyecto independiente, no afiliado a Riot Games. Valorant es marca registrada de Riot Games, Inc.
        </footer>
      </div>
    </div>
  );
}