import React, { useState, useEffect } from "react";
import { 
  User, Shield, Activity, MapPin, Copy, Check, 
  RefreshCw, ChevronDown, ChevronUp, Map 
} from "lucide-react";
import { RANK_BENCHMARKS, getRankGroup } from "../services/trackerEngine";

export default function PlayerProfileBar({ 
  account, stats, latestAct, onRefresh, refreshing, onGoToTracker 
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("agents");
  const [expanded, setExpanded] = useState(false);
  const [agentIcons, setAgentIcons] = useState({});

  // Dynamic fetch of playable agent icons from Valorant-API
  useEffect(() => {
    fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
      .then((res) => res.json())
      .then((resJson) => {
        const mapping = {};
        if (resJson.data) {
          resJson.data.forEach((agent) => {
            mapping[agent.displayName.toLowerCase()] = agent.displayIcon;
          });
        }
        setAgentIcons(mapping);
      })
      .catch((err) => console.warn("Error fetching agent icons from Valorant-API:", err));
  }, []);

  if (!account || !stats) return null;

  // 1. Copy PUUID handler
  const handleCopyPuuid = () => {
    if (account.puuid) {
      navigator.clipboard.writeText(account.puuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 2. Rank calculation helpers
  const getRankIconUrl = (tierId) => {
    if (tierId === undefined || tierId === null || tierId === 0) return null;
    return `https://media.valorant-api.com/competitivetiers/03b2d8df-8591-4958-8fb3-995fc503df84/${tierId}/largeicon.png`;
  };

  // Peak Rank status parsing
  const getPeakRank = (mmr) => {
    if (!mmr) return null;
    let peakTierId = 0;
    let peakTierName = "Unranked";
    let peakSeasonName = "";

    const bySeason = mmr.by_season || mmr.seasonal;
    
    if (bySeason && typeof bySeason === "object" && !Array.isArray(bySeason)) {
      Object.entries(bySeason).forEach(([seasonKey, data]) => {
        const tierId = data.final_rank || 0;
        if (tierId > peakTierId) {
          peakTierId = tierId;
          peakTierName = data.final_rank_patched || "Unranked";
          peakSeasonName = seasonKey.toUpperCase();
        }
      });
    } else if (Array.isArray(bySeason)) {
      bySeason.forEach((item) => {
        const tierId = item.end_tier || item.end_tier_id || 0;
        if (tierId > peakTierId) {
          peakTierId = tierId;
          peakTierName = item.end_tier_name || item.end_tier_patched || "Unranked";
          peakSeasonName = item.season_short || item.season?.short || "";
        }
      });
    }

    if (peakTierId === 0 && mmr.highest_rank) {
      peakTierId = mmr.highest_rank.tier || 0;
      peakTierName = mmr.highest_rank.patched_tier || "Unranked";
      peakSeasonName = mmr.highest_rank.season?.toUpperCase() || "";
    }

    return peakTierId > 0 ? { tierId: peakTierId, name: peakTierName, season: peakSeasonName } : null;
  };

  const currentRankName = stats.mmr?.current_data?.currenttierpatched || stats.rankTier || "Unranked";
  const currentRankTier = stats.mmr?.current_data?.currenttier || 0;
  const currentRankIcon = stats.mmr?.current_data?.images?.large || getRankIconUrl(currentRankTier);
  const currentRR = stats.mmr?.current_data?.ranking_in_tier ?? 0;
  const currentELO = stats.mmr?.current_data?.elo ?? 0;
  
  // Last session RR change
  const mmrChange = stats.mmr?.current_data?.mmr_change_to_last_game ?? 0;
  const rrChangeText = mmrChange > 0 ? `+${mmrChange}` : mmrChange < 0 ? `${mmrChange}` : "0";
  const rrChangeClass = mmrChange > 0 ? "text-win font-oswald" : mmrChange < 0 ? "text-loss font-oswald" : "font-oswald";

  const peakRank = getPeakRank(stats.mmr);

  // 3. Performance overview math & benchmark checks
  const matches = stats.matchesPlayed || 0;
  const adr = matches > 0 ? Math.round(stats.totalDamage / matches) : 0;
  const kd = stats.kdRatio || 0;
  const hs = stats.headshotPct || 0;
  const winrate = stats.winrate || 0;

  const rankGroup = getRankGroup(currentRankName);
  const benchmark = RANK_BENCHMARKS[rankGroup] || { kd: 1.0, hs: 18, winrate: 50, dpg: 140 };

  const adrClass = adr >= benchmark.dpg ? "text-win font-oswald" : "text-loss font-oswald";
  const kdClass = kd >= benchmark.kd ? "text-win font-oswald" : "text-loss font-oswald";
  const hsClass = hs >= benchmark.hs ? "text-win font-oswald" : "text-loss font-oswald";
  const winrateClass = winrate >= benchmark.winrate ? "text-win font-oswald" : "text-loss font-oswald";

  // Act / Season tag
  const currentActTag = latestAct?.season?.short || stats.mmr?.current_data?.season_id?.toUpperCase() || "E11A4";

  // 4. Dynamic calculation of Agent and Map statistics from matches
  const rawMatches = stats.matches || [];
  
  const computedAgents = (() => {
    if (!rawMatches.length) return [];
    const data = {};
    rawMatches.forEach((m) => {
      const me = m.players?.all_players?.find((p) => p.puuid === account.puuid);
      if (!me) return;
      const agent = me.character || "Unknown";
      const myTeam = me.team?.toLowerCase();
      const won = m.teams?.[myTeam]?.has_won ?? false;
      const kills = me.stats?.kills || 0;
      const deaths = me.stats?.deaths || 0;
      const dmg = me.damage_made || me.stats?.damage || 0;
      const hsCount = me.stats?.headshots || 0;
      const shots = (me.stats?.headshots || 0) + (me.stats?.bodyshots || 0) + (me.stats?.legshots || 0);
      const rounds = m.metadata?.rounds_played || 1;

      if (!data[agent]) {
        data[agent] = { games: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, hs: 0, shots: 0, rounds: 0 };
      }
      data[agent].games += 1;
      if (won) data[agent].wins += 1;
      data[agent].kills += kills;
      data[agent].deaths += deaths;
      data[agent].dmg += dmg;
      data[agent].hs += hsCount;
      data[agent].shots += shots;
      data[agent].rounds += rounds;
    });

    return Object.entries(data).map(([name, s]) => ({
      name,
      games: s.games,
      winrate: Math.round((s.wins / s.games) * 100),
      kd: s.deaths > 0 ? Number((s.kills / s.deaths).toFixed(2)) : Number(s.kills.toFixed(2)),
      adr: s.rounds > 0 ? Math.round(s.dmg / s.rounds) : 0,
      hs: s.shots > 0 ? Math.round((s.hs / s.shots) * 100) : 0,
    })).sort((a, b) => b.games - a.games);
  })();

  const computedMaps = (() => {
    if (!rawMatches.length) return [];
    const data = {};
    rawMatches.forEach((m) => {
      const me = m.players?.all_players?.find((p) => p.puuid === account.puuid);
      if (!me) return;
      const map = m.metadata?.map || "Unknown";
      const myTeam = me.team?.toLowerCase();
      const won = m.teams?.[myTeam]?.has_won ?? false;
      const kills = me.stats?.kills || 0;
      const deaths = me.stats?.deaths || 0;
      const dmg = me.damage_made || me.stats?.damage || 0;
      const hsCount = me.stats?.headshots || 0;
      const shots = (me.stats?.headshots || 0) + (me.stats?.bodyshots || 0) + (me.stats?.legshots || 0);
      const rounds = m.metadata?.rounds_played || 1;

      if (!data[map]) {
        data[map] = { games: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, hs: 0, shots: 0, rounds: 0 };
      }
      data[map].games += 1;
      if (won) data[map].wins += 1;
      data[map].kills += kills;
      data[map].deaths += deaths;
      data[map].dmg += dmg;
      data[map].hs += hsCount;
      data[map].shots += shots;
      data[map].rounds += rounds;
    });

    return Object.entries(data).map(([name, s]) => ({
      name,
      games: s.games,
      winrate: Math.round((s.wins / s.games) * 100),
      kd: s.deaths > 0 ? Number((s.kills / s.deaths).toFixed(2)) : Number(s.kills.toFixed(2)),
      adr: s.rounds > 0 ? Math.round(s.dmg / s.rounds) : 0,
      hs: s.shots > 0 ? Math.round((s.hs / s.shots) * 100) : 0,
    })).sort((a, b) => b.games - a.games);
  })();

  const cardSmallUrl = account.card?.small || stats.accountCard?.small;
  const puuidTruncated = account.puuid 
    ? `${account.puuid.slice(0, 8)}...${account.puuid.slice(-4)}` 
    : "";

  const itemsToShow = activeTab === "agents" ? computedAgents : computedMaps;
  const hasEnoughData = itemsToShow.length >= 3;
  const visibleItems = expanded ? itemsToShow : itemsToShow.slice(0, 4);

  return (
    <div className="player-profile-bar">
      {/* 1. PLAYER IDENTITY */}
      <div className="ppb-section ppb-identity">
        <div className="ppb-section-title">
          <User size={12} className="ppb-section-icon" />
          <span>PLAYER IDENTITY</span>
        </div>
        
        <div className="ppb-identity-card-row">
          <div className="ppb-player-card">
            {cardSmallUrl ? (
              <img src={cardSmallUrl} alt="Player Card" className="ppb-player-card-img" />
            ) : (
              <div className="ppb-player-card-fallback font-oswald">
                {account.name?.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="ppb-player-info">
            <div className="ppb-username font-oswald">
              {account.name}
              <span className="tag">#{account.tag}</span>
              <button 
                onClick={onRefresh} 
                className="ppb-refresh-btn" 
                disabled={refreshing} 
                title="Actualizar estadísticas"
              >
                <RefreshCw size={12} className={refreshing ? "spin-animation" : ""} />
              </button>
            </div>
            <div className="ppb-lvl-region">
              LVL {account.account_level || stats.accountLevel || "—"} | {account.region?.toUpperCase() || "—"}
            </div>
            {account.puuid && (
              <div className="ppb-puuid-wrap" onClick={handleCopyPuuid} title="Copiar PUUID completo">
                <span className="puuid-text">PUUID: {puuidTruncated}</span>
                {copied ? <Check size={11} className="text-win" /> : <Copy size={11} className="copy-icon" />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. RANK STATUS */}
      <div className="ppb-section ppb-rank">
        <div className="ppb-section-title">
          <Shield size={12} className="ppb-section-icon" />
          <span>RANK STATUS</span>
        </div>

        <div className="ppb-rank-cols">
          <div className="rank-col">
            <span className="rank-col-lbl">CURRENT</span>
            <div className="rank-details">
              <div className="rank-icon-wrap">
                {currentRankIcon ? (
                  <img src={currentRankIcon} alt={currentRankName} className="rank-icon-img" />
                ) : (
                  <div className="rank-icon-fallback font-oswald">UR</div>
                )}
              </div>
              <div className="rank-info">
                <span className="rank-name font-oswald">{currentRankName}</span>
                <span className="rank-rr">
                  {currentRR} RR <span className={rrChangeClass}>{rrChangeText}</span>
                </span>
                <span className="rank-elo">ELO {currentELO}</span>
              </div>
            </div>
          </div>

          <div className="rank-col line-separator">
            <span className="rank-col-lbl">PEAK</span>
            <div className="rank-details">
              <div className="rank-icon-wrap">
                {peakRank ? (
                  <img src={getRankIconUrl(peakRank.tierId)} alt={peakRank.name} className="rank-icon-img" />
                ) : (
                  <div className="rank-icon-fallback font-oswald">UR</div>
                )}
              </div>
              <div className="rank-info">
                <span className="rank-name font-oswald">{peakRank ? peakRank.name : "Unranked"}</span>
                <span className="rank-rr font-oswald text-gold">{peakRank ? peakRank.season : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PERFORMANCE OVERVIEW */}
      <div className="ppb-section ppb-perf">
        <div className="ppb-section-title" style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Activity size={12} className="ppb-section-icon" />
            <span>PERFORMANCE OVERVIEW</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="ppb-act-badge">{currentActTag}</span>
            <button className="ppb-details-btn font-oswald" onClick={onGoToTracker}>
              DETAILS
            </button>
          </div>
        </div>

        <div className="ppb-perf-grid">
          <div className="perf-cell">
            <span className={adrClass}>{adr}</span>
            <span className="lbl" title="Daño Promedio por Partida (ADR)">ADR (avg)</span>
          </div>
          <div className="perf-cell">
            <span className={kdClass}>{kd}</span>
            <span className="lbl">K/D RATIO</span>
          </div>
          <div className="perf-cell">
            <span className={hsClass}>{hs}%</span>
            <span className="lbl">HEADSHOT %</span>
          </div>
          <div className="perf-cell">
            <span className={winrateClass}>{winrate}%</span>
            <span className="lbl">WIN %</span>
          </div>
        </div>
      </div>

      {/* 4. AGENTS & MAPS */}
      <div className="ppb-section ppb-agents">
        <div className="ppb-section-title" style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Map size={12} className="ppb-section-icon" />
            <span>AGENTS & MAPS</span>
          </div>
          <span className="ppb-games-count font-oswald">{matches} GAMES</span>
        </div>

        <div className="ppb-agents-tab-nav">
          <button 
            className={`tab-link font-oswald ${activeTab === "agents" ? "active" : ""}`}
            onClick={() => { setActiveTab("agents"); setExpanded(false); }}
          >
            AGENTS
          </button>
          <button 
            className={`tab-link font-oswald ${activeTab === "maps" ? "active" : ""}`}
            onClick={() => { setActiveTab("maps"); setExpanded(false); }}
          >
            MAPS
          </button>
        </div>

        {!hasEnoughData ? (
          <div className="ppb-empty-tab">
            <span className="text-dim font-oswald" style={{ fontSize: 12 }}>DATOS INSUFICIENTES</span>
          </div>
        ) : (
          <div className="ppb-table-scroll-container">
            <table className="ppb-table">
              <thead>
                <tr>
                  <th>{activeTab === "agents" ? "AGENT" : "MAP"}</th>
                  <th style={{ textAlign: "right" }}>WIN%</th>
                  <th style={{ textAlign: "right" }}>K/D</th>
                  <th style={{ textAlign: "right" }}>ADR</th>
                  <th style={{ textAlign: "right" }}>HS%</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, idx) => {
                  const agentLower = item.name.toLowerCase();
                  const iconUrl = activeTab === "agents" ? agentIcons[agentLower] : null;

                  return (
                    <tr key={idx}>
                      <td className="item-name-cell">
                        {activeTab === "agents" ? (
                          <div className="agent-pic-wrap">
                            {iconUrl ? (
                              <img src={iconUrl} alt={item.name} className="agent-pic-img" />
                            ) : (
                              <div className="agent-pic-fallback font-oswald">
                                {item.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="item-name-text">
                          <span className="name">{item.name}</span>
                          <span className="sub">{item.games}G</span>
                        </div>
                      </td>
                      <td className="font-oswald" style={{ textAlign: "right", color: item.winrate >= 50 ? "var(--cyan)" : "var(--text)" }}>
                        {item.winrate}%
                      </td>
                      <td className="font-oswald" style={{ textAlign: "right", color: item.kd >= 1.0 ? "var(--cyan)" : "var(--text)" }}>
                        {item.kd}
                      </td>
                      <td className="font-oswald" style={{ textAlign: "right" }}>{item.adr}</td>
                      <td className="font-oswald" style={{ textAlign: "right" }}>{item.hs}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {itemsToShow.length > 4 && (
              <div 
                className="ppb-view-more font-oswald" 
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>COLAPSAR LISTA <ChevronUp size={11} /></>
                ) : (
                  <>VER LISTA COMPLETA <ChevronDown size={11} /></>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
