import React, { useState, useEffect } from "react";
import { X, Play, Clock, Server, Monitor, Award, Heart, Shield } from "lucide-react";

export default function MatchDetailOverlay({ match, puuid, onClose }) {
  const [activeTab, setActiveTab] = useState("scoreboard");
  const [agentIcons, setAgentIcons] = useState({});
  const [selectedPlayerPuuid, setSelectedPlayerPuuid] = useState(puuid);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(null);
  const [selectedRoundTab, setSelectedRoundTab] = useState(1);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [mapsData, setMapsData] = useState([]);

  useEffect(() => {
    setSelectedPlayerPuuid(puuid);
    setSelectedRoundIndex(null);
    setSelectedRoundTab(1);
    setSelectedEventIndex(0);
  }, [puuid, match]);

  useEffect(() => {
    setSelectedEventIndex(0);
  }, [selectedRoundTab]);

  // Fetch Valorant maps info for minimap plotting
  useEffect(() => {
    fetch("https://valorant-api.com/v1/maps")
      .then((res) => res.json())
      .then((resJson) => {
        if (resJson.data) {
          setMapsData(resJson.data);
        }
      })
      .catch((err) => console.error("Error fetching maps for rounds visualization:", err));
  }, []);

  // Lock body scroll when overlay is active, restore on close
  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

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

  if (!match) return null;

  const metadata = match.metadata || {};
  const matchId = metadata.matchid || metadata.match_id || "Unknown ID";
  const mapName = metadata.map || "Map";
  const gameStart = metadata.game_start || 0;
  const gameLength = metadata.game_length || 0;
  const cluster = metadata.cluster || "Santiago";

  // Find player data to get agent and outcome details
  const allPlayers = match.players?.all_players || [];
  const me = allPlayers.find((p) => p.puuid === puuid) || {};
  const myTeam = me.team?.toLowerCase() || "blue";

  // Derive player card wide art url
  const playerCardUuid = me.player_card || me.card_id || (me.card && typeof me.card === "object" ? me.card.id : (typeof me.card === "string" ? me.card : null));
  const playerCardWideUrl = (me.card && typeof me.card === "object" && me.card.wide) 
    ? me.card.wide 
    : (playerCardUuid ? `https://media.valorant-api.com/playercards/${playerCardUuid}/wideart.png` : null);

  // Game scores
  const scoreWon = match.teams?.[myTeam]?.rounds_won ?? 0;
  const scoreLost = match.teams?.[myTeam === "red" ? "blue" : "red"]?.rounds_won ?? 0;
  const isWin = (match.teams?.[myTeam]?.has_won ?? false) && scoreWon > scoreLost;
  const isLoss = scoreLost > scoreWon;
  const isDraw = scoreWon === scoreLost;

  let outcomeText = "DRAW";
  let outcomeClass = "text-dim";
  if (isWin) {
    outcomeText = "VICTORY";
    outcomeClass = "text-win";
  } else if (isLoss) {
    outcomeText = "DEFEAT";
    outcomeClass = "text-loss";
  }

  // Formatting dates & durations
  const startDateStr = gameStart ? new Date(gameStart * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const startTimeStr = gameStart ? new Date(gameStart * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const endDateStr = gameStart && gameLength ? new Date((gameStart + gameLength) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const endTimeStr = gameStart && gameLength ? new Date((gameStart + gameLength) * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

  const runtimeMin = Math.floor(gameLength / 60);
  const runtimeSec = gameLength % 60;
  const runtimeStr = gameLength ? `${runtimeMin}m ${runtimeSec}s` : "—";

  // Rank icon helper
  const getRankIconUrl = (tierId) => {
    if (tierId === undefined || tierId === null || tierId === 0) return null;
    return `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${tierId}/largeicon.png`;
  };

  // Group players into parties
  const partyCounts = {};
  allPlayers.forEach((p) => {
    if (p.party_id) {
      partyCounts[p.party_id] = (partyCounts[p.party_id] || 0) + 1;
    }
  });

  const partyColors = [
    "#3b82f6", // Royal Blue
    "#f97316", // Bright Orange
    "#10b981", // Emerald Green
    "#a855f7", // Purple
    "#eab308", // Yellow
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f43f5e", // Crimson Red
  ];

  // Map party_id to active color indices
  const premades = {};
  let partyColorIdx = 0;
  allPlayers.forEach((p) => {
    if (p.party_id && partyCounts[p.party_id] > 1 && !premades[p.party_id]) {
      premades[p.party_id] = partyColors[partyColorIdx % partyColors.length];
      partyColorIdx++;
    }
  });

  const multiParties = Object.entries(partyCounts)
    .filter(([_, count]) => count > 1)
    .map(([partyId]) => partyId);

  const partyColorMap = {};
  multiParties.forEach((partyId, idx) => {
    partyColorMap[partyId] = partyColors[idx % partyColors.length];
  });

  // Group players by teams and sort by Combat Score descending
  const redPlayers = allPlayers
    .filter((p) => p.team?.toLowerCase() === "red")
    .sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0));

  const bluePlayers = allPlayers
    .filter((p) => p.team?.toLowerCase() === "blue")
    .sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0));

  const redRounds = match.teams?.red?.rounds_won ?? 0;
  const blueRounds = match.teams?.blue?.rounds_won ?? 0;

  const myAgentLower = me.character?.toLowerCase() || "";
  const myAgentIcon = agentIcons[myAgentLower];

  return (
    <div className="mdo-backdrop" onClick={onClose}>
      <div className="mdo-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mdo-header">
          <div className="mdo-title-wrap">
            <span className="mdo-purple-dot font-oswald">⚡ MATCH DETAIL</span>
            <span className="mdo-match-id text-dim">{matchId}</span>
          </div>
          <button className="mdo-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Hero Section */}
        <div 
          className="mdo-hero"
          style={playerCardWideUrl ? {
            backgroundImage: `linear-gradient(to right, rgba(15, 25, 35, 0.95) 25%, rgba(15, 25, 35, 0.3) 100%), url(${playerCardWideUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat"
          } : {}}
        >
          <div className="mdo-hero-card-row">
            <div className="mdo-hero-agent-pic">
              {myAgentIcon ? (
                <img src={myAgentIcon} alt={me.character} className="mdo-hero-agent-img" />
              ) : (
                <div className="mdo-hero-agent-fallback font-oswald">
                  {me.character?.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="mdo-hero-info">
              <div className="mdo-hero-map font-oswald">{mapName}</div>
              <div className="mdo-hero-meta text-dim">
                COMPETITIVE • {matchId.substring(0, 16).toUpperCase()}
              </div>
              <div className="mdo-hero-outcome">
                <span className={`outcome-text font-oswald ${outcomeClass}`}>{outcomeText}</span>
                <span className="outcome-score font-oswald">{scoreWon}:{scoreLost}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="mdo-meta-grid">
          <div className="mdo-meta-cell">
            <span className="lbl text-dim">START</span>
            <span className="val font-oswald">{startDateStr} • {startTimeStr}</span>
          </div>
          <div className="mdo-meta-cell">
            <span className="lbl text-dim">END</span>
            <span className="val font-oswald">{endDateStr} • {endTimeStr}</span>
          </div>
          <div className="mdo-meta-cell">
            <span className="lbl text-dim">RUNTIME</span>
            <span className="val font-oswald">{runtimeStr}</span>
          </div>
          <div className="mdo-meta-cell">
            <span className="lbl text-dim">SERVER</span>
            <span className="val font-oswald">{cluster}</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="mdo-tab-nav">
          <button
            className={`mdo-tab-link font-oswald ${activeTab === "scoreboard" ? "active" : ""}`}
            onClick={() => setActiveTab("scoreboard")}
          >
            SCOREBOARD
          </button>
          <button
            className={`mdo-tab-link font-oswald ${activeTab === "performance" ? "active" : ""}`}
            onClick={() => setActiveTab("performance")}
          >
            PERFORMANCE
          </button>
          <button
            className={`mdo-tab-link font-oswald ${activeTab === "rounds" ? "active" : ""}`}
            onClick={() => setActiveTab("rounds")}
          >
            ROUNDS
          </button>
        </div>

        {/* Tab Content */}
        <div className="mdo-content">
          {activeTab === "scoreboard" && (
            <div className="mdo-scoreboard-tab">
              {/* Render Team Red */}
              <div className="mdo-team-section">
                <div className="mdo-team-header red font-oswald">
                  TEAM RED <span className="mdo-score-pill">{redRounds} ROUNDS</span>
                </div>
                <div className="mdo-table-wrap">
                  <table className="mdo-table">
                    <thead>
                      <tr>
                        <th>PLAYER</th>
                        <th style={{ textAlign: "center" }}>RANK</th>
                        <th style={{ textAlign: "right" }}>ACS</th>
                        <th style={{ textAlign: "center" }}>K / D / A</th>
                        <th style={{ textAlign: "right" }}>K/D</th>
                        <th style={{ textAlign: "right" }}>HS%</th>
                        <th style={{ textAlign: "right" }}>ADR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redPlayers.map((p, idx) => {
                        const characterLower = p.character?.toLowerCase() || "";
                        const iconUrl = agentIcons[characterLower];
                        const kills = p.stats?.kills || 0;
                        const deaths = p.stats?.deaths || 0;
                        const assists = p.stats?.assists || 0;
                        const kd = deaths > 0 ? (kills / deaths).toFixed(1) : kills.toFixed(1);
                        const rounds = metadata.rounds_played || 1;
                        const acs = Math.round((p.stats?.score || 0) / rounds);

                        const headshots = p.stats?.headshots || 0;
                        const totalShots = (p.stats?.headshots || 0) + (p.stats?.bodyshots || 0) + (p.stats?.legshots || 0);
                        const hs = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;

                        const dmg = p.damage_made || p.stats?.damage || 0;
                        const adr = Math.round(dmg / rounds);

                        const isMe = p.puuid === puuid;
                        const tierId = p.currenttier ?? p.current_tier ?? p.tier ?? 0;
                        const rankIcon = getRankIconUrl(tierId);
                        const partyColor = p.party_id ? partyColorMap[p.party_id] : null;
                        const partyIdx = p.party_id ? multiParties.indexOf(p.party_id) : -1;

                        return (
                          <tr key={idx} className={isMe ? "mdo-row-highlight" : ""}>
                            <td className="mdo-player-cell">
                              <div className="mdo-player-avatar-wrap">
                                {partyColor && (
                                  <div
                                    className="mdo-party-indicator"
                                    style={{ backgroundColor: partyColor }}
                                    title={`Grupo ${partyIdx + 1}`}
                                  />
                                )}
                                <div className="mdo-agent-icon-square" style={{ borderRadius: partyColor ? "0 4px 4px 0" : "4px" }}>
                                  {iconUrl ? (
                                    <img src={iconUrl} alt={p.character} className="mdo-agent-icon-img" />
                                  ) : (
                                    <div className="mdo-agent-fallback font-oswald">
                                      {p.character?.substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mdo-player-name-wrap">
                                <span className="mdo-player-name font-oswald">{p.name}</span>
                                <span className="mdo-player-tag">#{p.tag}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {rankIcon ? (
                                <img src={rankIcon} alt="Rank" className="mdo-rank-icon" title={p.currenttier_patched ?? p.current_tier_patched ?? "Unranked"} />
                              ) : (
                                <span className="text-dim font-oswald" style={{ fontSize: 10 }}>UR</span>
                              )}
                            </td>
                            <td className="font-oswald" style={{ textAlign: "right" }}>{acs}</td>
                            <td className="font-oswald" style={{ textAlign: "center" }}>
                              {kills} / {deaths} / {assists}
                            </td>
                            <td className="font-oswald" style={{ textAlign: "right", color: kd >= 1.0 ? "var(--cyan)" : "var(--red)" }}>
                              {kd}
                            </td>
                            <td className="font-oswald" style={{ textAlign: "right" }}>{hs}%</td>
                            <td className="font-oswald" style={{ textAlign: "right" }}>{adr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Render Team Blue */}
              <div className="mdo-team-section">
                <div className="mdo-team-header blue font-oswald">
                  TEAM BLUE <span className="mdo-score-pill">{blueRounds} ROUNDS</span>
                </div>
                <div className="mdo-table-wrap">
                  <table className="mdo-table">
                    <thead>
                      <tr>
                        <th>PLAYER</th>
                        <th style={{ textAlign: "center" }}>RANK</th>
                        <th style={{ textAlign: "right" }}>ACS</th>
                        <th style={{ textAlign: "center" }}>K / D / A</th>
                        <th style={{ textAlign: "right" }}>K/D</th>
                        <th style={{ textAlign: "right" }}>HS%</th>
                        <th style={{ textAlign: "right" }}>ADR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bluePlayers.map((p, idx) => {
                        const characterLower = p.character?.toLowerCase() || "";
                        const iconUrl = agentIcons[characterLower];
                        const kills = p.stats?.kills || 0;
                        const deaths = p.stats?.deaths || 0;
                        const assists = p.stats?.assists || 0;
                        const kd = deaths > 0 ? (kills / deaths).toFixed(1) : kills.toFixed(1);
                        const rounds = metadata.rounds_played || 1;
                        const acs = Math.round((p.stats?.score || 0) / rounds);

                        const headshots = p.stats?.headshots || 0;
                        const totalShots = (p.stats?.headshots || 0) + (p.stats?.bodyshots || 0) + (p.stats?.legshots || 0);
                        const hs = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;

                        const dmg = p.damage_made || p.stats?.damage || 0;
                        const adr = Math.round(dmg / rounds);

                        const isMe = p.puuid === puuid;
                        const tierId = p.currenttier ?? p.current_tier ?? p.tier ?? 0;
                        const rankIcon = getRankIconUrl(tierId);
                        const partyColor = p.party_id ? partyColorMap[p.party_id] : null;
                        const partyIdx = p.party_id ? multiParties.indexOf(p.party_id) : -1;

                        return (
                          <tr key={idx} className={isMe ? "mdo-row-highlight" : ""}>
                            <td className="mdo-player-cell">
                              <div className="mdo-player-avatar-wrap">
                                {partyColor && (
                                  <div
                                    className="mdo-party-indicator"
                                    style={{ backgroundColor: partyColor }}
                                    title={`Grupo ${partyIdx + 1}`}
                                  />
                                )}
                                <div className="mdo-agent-icon-square" style={{ borderRadius: partyColor ? "0 4px 4px 0" : "4px" }}>
                                  {iconUrl ? (
                                    <img src={iconUrl} alt={p.character} className="mdo-agent-icon-img" />
                                  ) : (
                                    <div className="mdo-agent-fallback font-oswald">
                                      {p.character?.substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mdo-player-name-wrap">
                                <span className="mdo-player-name font-oswald">{p.name}</span>
                                <span className="mdo-player-tag">#{p.tag}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {rankIcon ? (
                                <img src={rankIcon} alt="Rank" className="mdo-rank-icon" title={p.currenttier_patched ?? p.current_tier_patched ?? "Unranked"} />
                              ) : (
                                <span className="text-dim font-oswald" style={{ fontSize: 10 }}>UR</span>
                              )}
                            </td>
                            <td className="font-oswald" style={{ textAlign: "right" }}>{acs}</td>
                            <td className="font-oswald" style={{ textAlign: "center" }}>
                              {kills} / {deaths} / {assists}
                            </td>
                            <td className="font-oswald" style={{ textAlign: "right", color: kd >= 1.0 ? "var(--cyan)" : "var(--red)" }}>
                              {kd}
                            </td>
                            <td className="font-oswald" style={{ textAlign: "right" }}>{hs}%</td>
                            <td className="font-oswald" style={{ textAlign: "right" }}>{adr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="mdo-performance-tab">
              {/* Agent selector horizontal row */}
              <div className="mdo-perf-agent-selector">
                <div className="agent-list red-team">
                  {redPlayers.map((p) => {
                    const characterLower = p.character?.toLowerCase() || "";
                    const iconUrl = agentIcons[characterLower];
                    const isSelected = p.puuid === selectedPlayerPuuid;
                    return (
                      <div
                        key={p.puuid}
                        className={`selector-avatar ${isSelected ? "active" : ""}`}
                        onClick={() => { setSelectedPlayerPuuid(p.puuid); setSelectedRoundIndex(null); }}
                        title={p.name}
                      >
                        {iconUrl ? (
                          <img src={iconUrl} alt={p.character} />
                        ) : (
                          <span className="font-oswald">{p.character?.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="vs-divider font-oswald text-dim">VS</span>
                <div className="agent-list blue-team">
                  {bluePlayers.map((p) => {
                    const characterLower = p.character?.toLowerCase() || "";
                    const iconUrl = agentIcons[characterLower];
                    const isSelected = p.puuid === selectedPlayerPuuid;
                    return (
                      <div
                        key={p.puuid}
                        className={`selector-avatar ${isSelected ? "active" : ""}`}
                        onClick={() => { setSelectedPlayerPuuid(p.puuid); setSelectedRoundIndex(null); }}
                        title={p.name}
                      >
                        {iconUrl ? (
                          <img src={iconUrl} alt={p.character} />
                        ) : (
                          <span className="font-oswald">{p.character?.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Player details header banner */}
              {(() => {
                const activePlayer = allPlayers.find((p) => p.puuid === selectedPlayerPuuid) || me;
                const activePlayerTeam = activePlayer.team?.toLowerCase() || "blue";

                // Helper to get side of round (Attack / Defense)
                const getPlayerSide = (roundIndex, playerTeam) => {
                  const teamLower = playerTeam.toLowerCase();
                  if (roundIndex <= 12) {
                    return teamLower === "red" ? "attack" : "defense";
                  } else if (roundIndex <= 24) {
                    return teamLower === "red" ? "defense" : "attack";
                  } else {
                    const isOdd = roundIndex % 2 === 1;
                    return teamLower === "red" ? (isOdd ? "attack" : "defense") : (isOdd ? "defense" : "attack");
                  }
                };

                // Halves stats calculation
                const rounds = match.rounds || [];
                let attackKills = 0, attackDeaths = 0, attackAssists = 0, attackWins = 0, attackLosses = 0;
                let defenseKills = 0, defenseDeaths = 0, defenseAssists = 0, defenseWins = 0, defenseLosses = 0;

                rounds.forEach((r, rIdx) => {
                  const roundNum = rIdx + 1;
                  const activePs = r.player_stats?.find(ps => ps.player_puuid === activePlayer.puuid);
                  if (!activePs) return;

                  const side = getPlayerSide(roundNum, activePlayer.team || "blue");
                  const winningTeam = r.winning_team?.toLowerCase();
                  const won = winningTeam === activePlayerTeam;

                  const roundDeaths = (match.kills || []).some(k => k.round === rIdx && k.victim_puuid === activePlayer.puuid) ? 1 : 0;
                  const roundAssists = (match.kills || []).filter(k => {
                    if (k.round !== rIdx) return false;
                    const assistants = k.assistants || k.assistant_puuids || [];
                    return assistants.some(ast => {
                      if (typeof ast === "string") return ast === activePlayer.puuid;
                      if (ast && typeof ast === "object") return (ast.assistant_puuid === activePlayer.puuid) || (ast.puuid === activePlayer.puuid);
                      return false;
                    });
                  }).length;

                  if (side === "attack") {
                    attackKills += activePs.kills || 0;
                    attackDeaths += roundDeaths;
                    attackAssists += roundAssists;
                    if (won) attackWins++; else attackLosses++;
                  } else {
                    defenseKills += activePs.kills || 0;
                    defenseDeaths += roundDeaths;
                    defenseAssists += roundAssists;
                    if (won) defenseWins++; else defenseLosses++;
                  }
                });

                const attackRounds = attackWins + attackLosses;
                const defenseRounds = defenseWins + defenseLosses;
                const attackKD = attackDeaths > 0 ? (attackKills / attackDeaths).toFixed(2) : attackKills.toFixed(2);
                const defenseKD = defenseDeaths > 0 ? (defenseKills / defenseDeaths).toFixed(2) : defenseKills.toFixed(2);

                const attackWinrate = attackRounds > 0 ? Math.round((attackWins / attackRounds) * 100) : 0;
                const defenseWinrate = defenseRounds > 0 ? Math.round((defenseWins / defenseRounds) * 100) : 0;

                // Opponents stats table calculation
                const opponentTeamName = activePlayerTeam === "red" ? "blue" : "red";
                const opponents = allPlayers.filter(p => p.team?.toLowerCase() === opponentTeamName);

                const vsOpponentsData = opponents.map(opt => {
                  let totalDealt = 0;
                  let totalRecv = 0;
                  const targetRoundsForVS = selectedRoundIndex !== null
                    ? [rounds[selectedRoundIndex - 1]].filter(Boolean)
                    : rounds;

                  targetRoundsForVS.forEach(r => {
                    const activePs = r.player_stats?.find(ps => ps.player_puuid === activePlayer.puuid);
                    if (activePs && activePs.damage_events) {
                      activePs.damage_events.forEach(de => {
                        if (de.receiver_puuid === opt.puuid) {
                          totalDealt += de.damage || 0;
                        }
                      });
                    }

                    const optPs = r.player_stats?.find(ps => ps.player_puuid === opt.puuid);
                    if (optPs && optPs.damage_events) {
                      optPs.damage_events.forEach(de => {
                        if (de.receiver_puuid === activePlayer.puuid) {
                          totalRecv += de.damage || 0;
                        }
                      });
                    }
                  });

                  // Kills/deaths details from match.kills
                  const matchKills = match.kills || [];
                  const killsCount = matchKills.filter(k => {
                    const isCorrectRound = selectedRoundIndex === null || k.round === selectedRoundIndex - 1;
                    return isCorrectRound && k.killer_puuid === activePlayer.puuid && k.victim_puuid === opt.puuid;
                  }).length;

                  const deathsCount = matchKills.filter(k => {
                    const isCorrectRound = selectedRoundIndex === null || k.round === selectedRoundIndex - 1;
                    return isCorrectRound && k.killer_puuid === opt.puuid && k.victim_puuid === activePlayer.puuid;
                  }).length;

                  return {
                    player: opt,
                    dealt: totalDealt,
                    recv: totalRecv,
                    kills: killsCount,
                    deaths: deathsCount
                  };
                }).sort((a, b) => b.dealt - a.dealt);

                // Weapon usage calculation
                const weaponStats = {};
                const targetRoundsForWeapons = selectedRoundIndex !== null
                  ? [rounds[selectedRoundIndex - 1]].filter(Boolean)
                  : rounds;

                targetRoundsForWeapons.forEach((r, rIdx) => {
                  const activePs = r.player_stats?.find(ps => ps.player_puuid === activePlayer.puuid);
                  if (!activePs) return;

                  const weaponName = activePs.economy?.weapon?.name || activePs.weapon?.name || activePs.economy?.weapon_name || "Classic";
                  if (!weaponStats[weaponName]) {
                    weaponStats[weaponName] = { name: weaponName, kills: 0, damage: 0 };
                  }

                  const roundIndexForKills = selectedRoundIndex !== null ? selectedRoundIndex - 1 : rIdx;
                  const killsInRound = (match.kills || []).filter(k =>
                    k.round === roundIndexForKills &&
                    k.killer_puuid === activePlayer.puuid
                  ).length;

                  weaponStats[weaponName].kills += killsInRound;
                  weaponStats[weaponName].damage += activePs.damage || 0;
                });

                const sortedWeapons = Object.values(weaponStats).sort((a, b) => b.kills - a.kills || b.damage - a.damage);

                return (
                  <>
                    <div className="mdo-perf-player-header">
                      <div className="avatar-side">
                        {agentIcons[activePlayer.character?.toLowerCase()] ? (
                          <img src={agentIcons[activePlayer.character?.toLowerCase()]} alt={activePlayer.character} className="avatar-img" />
                        ) : (
                          <div className="avatar-fallback font-oswald">{activePlayer.character?.substring(0, 2).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="info-side">
                        <div className="name-row font-oswald">
                          <span className="name">{activePlayer.name}</span>
                          <span className="tag text-dim">#{activePlayer.tag}</span>
                          {getRankIconUrl(activePlayer.currenttier ?? activePlayer.current_tier ?? activePlayer.tier) && (
                            <img
                              src={getRankIconUrl(activePlayer.currenttier ?? activePlayer.current_tier ?? activePlayer.tier)}
                              alt="Rank"
                              className="rank-badge-small"
                            />
                          )}
                          <span className="rank-name text-dim">
                            {activePlayer.currenttier_patched ?? activePlayer.current_tier_patched ?? "Unranked"}
                          </span>
                          <span className="agent-tag">{activePlayer.character?.toUpperCase()}</span>
                        </div>

                        <div className="stats-row font-oswald">
                          <div className="stat-box">
                            <span className="lbl text-dim">K/D/A</span>
                            <span className="val">{activePlayer.stats?.kills}/{activePlayer.stats?.deaths}/{activePlayer.stats?.assists}</span>
                          </div>
                          <div className="stat-box">
                            <span className="lbl text-dim">K/D</span>
                            <span className="val" style={{ color: (activePlayer.stats?.kills / Math.max(1, activePlayer.stats?.deaths)) >= 1.0 ? "var(--cyan)" : "var(--red)" }}>
                              {(activePlayer.stats?.kills / Math.max(1, activePlayer.stats?.deaths)).toFixed(2)}
                            </span>
                          </div>
                          <div className="stat-box">
                            <span className="lbl text-dim">ADR</span>
                            <span className="val">{Math.round((activePlayer.damage_made || activePlayer.stats?.damage || 0) / (metadata.rounds_played || 1))}</span>
                          </div>
                          <div className="stat-box">
                            <span className="lbl text-dim">ACS</span>
                            <span className="val">{Math.round((activePlayer.stats?.score || 0) / (metadata.rounds_played || 1))}</span>
                          </div>
                          <div className="stat-box">
                            <span className="lbl text-dim">HS%</span>
                            <span className="val">
                              {(() => {
                                const hsCount = activePlayer.stats?.headshots || 0;
                                const totalShots = (activePlayer.stats?.headshots || 0) + (activePlayer.stats?.bodyshots || 0) + (activePlayer.stats?.legshots || 0);
                                return totalShots > 0 ? `${Math.round((hsCount / totalShots) * 100)}%` : "0%";
                              })()}
                            </span>
                          </div>
                          <div className="stat-box">
                            <span className="lbl text-dim">KAST</span>
                            <span className="val">
                              {(() => {
                                let kastRounds = 0;
                                rounds.forEach((r, rIdx) => {
                                  const ps = r.player_stats?.find((x) => x.player_puuid === activePlayer.puuid);
                                  if (!ps) return;
                                  
                                  const roundKills = ps.kills || 0;
                                  const roundDeaths = (match.kills || []).some(k => k.round === rIdx && k.victim_puuid === activePlayer.puuid) ? 1 : 0;
                                  const roundAssists = (match.kills || []).filter(k => {
                                    if (k.round !== rIdx) return false;
                                    const assistants = k.assistants || k.assistant_puuids || [];
                                    return assistants.some(ast => {
                                      if (typeof ast === "string") return ast === activePlayer.puuid;
                                      if (ast && typeof ast === "object") return (ast.assistant_puuid === activePlayer.puuid) || (ast.puuid === activePlayer.puuid);
                                      return false;
                                    });
                                  }).length;

                                  const survived = roundDeaths === 0;
                                  const gotKill = roundKills > 0;
                                  const gotAssist = roundAssists > 0;
                                  
                                  // Trade check: if the player died, was their killer killed in the same round by a teammate?
                                  let traded = false;
                                  if (roundDeaths > 0) {
                                    const myDeath = (match.kills || []).find(k => k.round === rIdx && k.victim_puuid === activePlayer.puuid);
                                    if (myDeath) {
                                      const killerPuuid = myDeath.killer_puuid;
                                      traded = (match.kills || []).some(k => 
                                        k.round === rIdx && 
                                        k.victim_puuid === killerPuuid && 
                                        k.killer_puuid !== activePlayer.puuid && 
                                        allPlayers.find(p => p.puuid === k.killer_puuid)?.team?.toLowerCase() === activePlayer.team?.toLowerCase()
                                      );
                                    }
                                  }

                                  if (gotKill || gotAssist || survived || traded) {
                                    kastRounds++;
                                  }
                                });
                                return rounds.length > 0 ? `${Math.round((kastRounds / rounds.length) * 100)}%` : "—";
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Rounds Grid */}
                    <div className="mdo-perf-rounds-timeline">
                      {Array.from({ length: metadata.rounds_played || rounds.length || 0 }).map((_, rIdx) => {
                        const roundNum = rIdx + 1;
                        const r = rounds[rIdx] || {};
                        const winningTeam = r.winning_team?.toLowerCase();
                        const isRoundWin = winningTeam === activePlayerTeam;
                        const bgClass = isRoundWin ? "win" : "loss";
                        const isSelected = selectedRoundIndex === roundNum;

                        const ps = r.player_stats?.find((x) => x.player_puuid === activePlayer.puuid) || {};
                        const roundKills = ps.kills || 0;
                        
                        const roundDeaths = (match.kills || []).some(k => k.round === rIdx && k.victim_puuid === activePlayer.puuid) ? 1 : 0;
                        const roundAssists = (match.kills || []).filter(k => {
                          if (k.round !== rIdx) return false;
                          const assistants = k.assistants || k.assistant_puuids || [];
                          return assistants.some(ast => {
                            if (typeof ast === "string") return ast === activePlayer.puuid;
                            if (ast && typeof ast === "object") return (ast.assistant_puuid === activePlayer.puuid) || (ast.puuid === activePlayer.puuid);
                            return false;
                          });
                        }).length;

                        return (
                          <div
                            key={rIdx}
                            className={`timeline-round-box ${bgClass} ${isSelected ? "active" : ""}`}
                            onClick={() => setSelectedRoundIndex(isSelected ? null : roundNum)}
                          >
                            <span className="round-num">{roundNum}</span>
                            <div className="round-events">
                              {/* Top: Kills & Assists */}
                              {(roundKills > 0 || (roundAssists > 0 && roundKills === 0)) && (
                                <div className="round-kills-wrap">
                                  {Array.from({ length: roundKills }).map((_, kI) => (
                                    <span key={`k-${kI}`} className="event-kill">+</span>
                                  ))}
                                  {roundAssists > 0 && roundKills === 0 && (
                                    <span className="event-assist">-</span>
                                  )}
                                </div>
                              )}

                              {/* Separator line */}
                              {(roundKills > 0 || (roundAssists > 0 && roundKills === 0)) && roundDeaths > 0 && (
                                <div className={`round-event-separator ${isRoundWin ? "win" : "loss"}`} />
                              )}

                              {/* Bottom: Deaths */}
                              {roundDeaths > 0 && (
                                <span className="event-death">+</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected Round Label Bar */}
                    {selectedRoundIndex !== null && (
                      <div className="mdo-perf-selected-bar font-oswald">
                        <span>ROUND {selectedRoundIndex} SELECTED</span>
                        <button className="clear-filter-btn font-oswald" onClick={() => setSelectedRoundIndex(null)}>
                          CLEAR
                        </button>
                      </div>
                    )}

                    {/* VS Opponents and Weapon Usage panels */}
                    <div className="mdo-perf-panels-row">
                      {/* VS OPPONENTS table */}
                      <div className="mdo-perf-panel-card">
                        <div className="panel-header font-oswald">
                          <span>{selectedRoundIndex !== null ? `ROUND ${selectedRoundIndex}` : "ALL ROUNDS"}</span>
                          <span className="text-dim">VS OPPONENTS</span>
                        </div>
                        <div className="panel-body">
                          <table className="mdo-perf-table">
                            <thead>
                              <tr>
                                <th>PLAYER</th>
                                <th style={{ textAlign: "right" }}>DEALT</th>
                                <th style={{ textAlign: "right" }}>RECV</th>
                                <th style={{ textAlign: "right" }}>K</th>
                                <th style={{ textAlign: "right" }}>D</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vsOpponentsData.map((row, idx) => {
                                const iconUrl = agentIcons[row.player.character?.toLowerCase()];
                                return (
                                  <tr key={idx}>
                                    <td className="mdo-perf-player-cell">
                                      <div className="avatar-square-tiny">
                                        {iconUrl ? (
                                          <img src={iconUrl} alt={row.player.character} />
                                        ) : (
                                          <span>{row.player.character?.substring(0, 2).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <div className="name-wrap">
                                        <span className="name font-oswald">{row.player.name}</span>
                                        <span className="tag">#{row.player.tag}</span>
                                      </div>
                                    </td>
                                    <td className="font-oswald" style={{ textAlign: "right", color: row.dealt > 0 ? "var(--text)" : "var(--text-dim)" }}>
                                      {row.dealt || "0"}
                                    </td>
                                    <td className="font-oswald" style={{ textAlign: "right", color: row.recv > 0 ? "var(--text)" : "var(--text-dim)" }}>
                                      {row.recv || "0"}
                                    </td>
                                    <td className="font-oswald" style={{ textAlign: "right", color: row.kills > 0 ? "var(--cyan)" : "var(--text-dim)" }}>
                                      {row.kills || "—"}
                                    </td>
                                    <td className="font-oswald" style={{ textAlign: "right", color: row.deaths > 0 ? "var(--red)" : "var(--text-dim)" }}>
                                      {row.deaths || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* WEAPON USAGE table */}
                      <div className="mdo-perf-panel-card">
                        <div className="panel-header font-oswald">
                          <span>WEAPON USAGE</span>
                          <span className="text-dim">{selectedRoundIndex !== null ? `ROUND ${selectedRoundIndex}` : "ALL ROUNDS"}</span>
                        </div>
                        <div className="panel-body">
                          <table className="mdo-perf-table">
                            <thead>
                              <tr>
                                <th>WEAPON</th>
                                <th style={{ textAlign: "right" }}>K</th>
                                <th style={{ textAlign: "right" }}>DMG</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedWeapons.map((row, idx) => (
                                <tr key={idx}>
                                  <td className="font-oswald text-uppercase">{row.name}</td>
                                  <td className="font-oswald" style={{ textAlign: "right", color: row.kills > 0 ? "var(--cyan)" : "var(--text-dim)" }}>
                                    {row.kills || "—"}
                                  </td>
                                  <td className="font-oswald" style={{ textAlign: "right" }}>{row.damage || "0"}</td>
                                </tr>
                              ))}
                              {sortedWeapons.length === 0 && (
                                <tr>
                                  <td colSpan="3" style={{ textAlign: "center" }} className="text-dim">No weapon data recorded</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* HALF BREAKDOWN breakdown (Attack / Defense split) - only for ALL ROUNDS */}
                    {selectedRoundIndex === null && (
                      <div className="mdo-perf-half-breakdown">
                        <div className="half-header font-oswald">HALF BREAKDOWN</div>
                        <div className="half-row">
                          {/* Attack half */}
                          <div className="half-col">
                            <div className="side-title font-oswald">
                              <span style={{ color: "var(--gold)" }}>★ ATTACK</span>
                              <span className="text-dim">{attackRounds} RDS</span>
                            </div>
                            <div className="progress-bar-wrap">
                              <div
                                className="progress-fill attack"
                                style={{ width: `${attackWinrate}%` }}
                              />
                            </div>
                            <div className="half-stats-grid font-oswald">
                              <div className="h-stat">
                                <span className="lbl text-dim">K</span>
                                <span className="val">{attackKills}</span>
                              </div>
                              <div className="h-stat">
                                <span className="lbl text-dim">D</span>
                                <span className="val">{attackDeaths}</span>
                              </div>
                              <div className="h-stat">
                                <span className="lbl text-dim">A</span>
                                <span className="val">{attackAssists}</span>
                              </div>
                              <div className="h-stat">
                                <span className="lbl text-dim">K/D</span>
                                <span className="val" style={{ color: Number(attackKD) >= 1.0 ? "var(--cyan)" : "var(--red)" }}>
                                  {attackKD}
                                </span>
                              </div>
                            </div>
                            <div className="half-record font-oswald">
                              <span className="text-dim">{attackWinrate}% WIN</span>
                              <span className="bullet text-dim">•</span>
                              <span className="text-win">{attackWins}W</span>
                              <span className="text-dim">/</span>
                              <span className="text-loss">{attackLosses}L</span>
                            </div>
                          </div>

                          {/* Defense half */}
                          <div className="half-col">
                            <div className="side-title font-oswald">
                              <span style={{ color: "var(--cyan)" }}>🛡 DEFENSE</span>
                              <span className="text-dim">{defenseRounds} RDS</span>
                            </div>
                            <div className="progress-bar-wrap">
                              <div
                                className="progress-fill defense"
                                style={{ width: `${defenseWinrate}%` }}
                              />
                            </div>
                            <div className="half-stats-grid font-oswald">
                              <div className="h-stat">
                                <span className="lbl text-dim">K</span>
                                <span className="val">{defenseKills}</span>
                              </div>
                              <div className="h-stat">
                                <span className="lbl text-dim">D</span>
                                <span className="val">{defenseDeaths}</span>
                              </div>
                              <div className="h-stat">
                                <span className="lbl text-dim">A</span>
                                <span className="val">{defenseAssists}</span>
                              </div>
                              <div className="h-stat">
                                <span className="lbl text-dim">K/D</span>
                                <span className="val" style={{ color: Number(defenseKD) >= 1.0 ? "var(--cyan)" : "var(--red)" }}>
                                  {defenseKD}
                                </span>
                              </div>
                            </div>
                            <div className="half-record font-oswald">
                              <span className="text-dim">{defenseWinrate}% WIN</span>
                              <span className="bullet text-dim">•</span>
                              <span className="text-win">{defenseWins}W</span>
                              <span className="text-dim">/</span>
                              <span className="text-loss">{defenseLosses}L</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === "rounds" && (
            <div className="mdo-rounds-tab">
              {/* Rounds Horizontal Nav */}
              <div className="mdo-rounds-grid-nav">
                {Array.from({ length: match.rounds?.length || metadata.rounds_played || 0 }).map((_, rIdx) => {
                  const rNum = rIdx + 1;
                  const roundObj = match.rounds?.[rIdx] || {};
                  const winningTeam = roundObj.winning_team?.toLowerCase();
                  const isWin = winningTeam === (me.team?.toLowerCase() || "blue");
                  const isActive = selectedRoundTab === rNum;
                  return (
                    <button 
                      key={rIdx}
                      className={`mdo-round-btn ${isWin ? "win" : "loss"} ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedRoundTab(rNum)}
                    >
                      {rNum}
                    </button>
                  );
                })}
              </div>

              {/* Round Details Visualizer */}
              {(() => {
                const totalRounds = match.rounds?.length || 0;
                if (totalRounds === 0) {
                  return <div className="text-dim font-oswald text-center pad-20">No rounds recorded for this match.</div>;
                }

                const currentRound = match.rounds?.[selectedRoundTab - 1] || {};
                const roundKills = (match.kills || []).filter(k => k.round === selectedRoundTab - 1);
                
                const plantEvent = currentRound.spike_plant_event || currentRound.plant_event || currentRound.plant_events;
                const defuseEvent = currentRound.spike_defuse_event || currentRound.defuse_event || currentRound.defuse_events;

                const activeMapObj = mapsData.find(
                  (m) => m.displayName?.toLowerCase() === mapName?.toLowerCase()
                );

                const convertCoords = (x, y) => {
                  if (!activeMapObj) return { x: 50, y: 50 };
                  const { xMultiplier, yMultiplier, xScalarToAdd, yScalarToAdd } = activeMapObj;
                  return {
                    x: ((y * xMultiplier) + xScalarToAdd) * 100,
                    y: ((x * yMultiplier) + yScalarToAdd) * 100
                  };
                };

                const isValidLoc = (loc) => loc && loc.x !== undefined && loc.y !== undefined && loc.x !== null && loc.y !== null;

                const formatRoundTime = (msOrSec) => {
                  if (msOrSec === undefined || msOrSec === null) return "";
                  const totalSeconds = msOrSec > 1000 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
                  const minutes = Math.floor(totalSeconds / 60);
                  const seconds = totalSeconds % 60;
                  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                };

                // Build round chronological timeline
                const roundEventsList = [];

                roundKills.forEach((k) => {
                  roundEventsList.push({
                    type: "kill",
                    time: k.kill_time_in_round || k.kill_time || 0,
                    data: k
                  });
                });

                const hasPlant = plantEvent && (
                  currentRound.bomb_planted === true ||
                  (currentRound.bomb_planted === undefined && (
                    plantEvent.plant_location || 
                    plantEvent.location || 
                    plantEvent.planted_by ||
                    (plantEvent.plant_time_in_round && plantEvent.plant_time_in_round > 0) ||
                    (plantEvent.plant_time && plantEvent.plant_time > 0)
                  ))
                );

                const hasDefuse = defuseEvent && (
                  currentRound.bomb_defused === true ||
                  (currentRound.bomb_defused === undefined && (
                    defuseEvent.defuse_location || 
                    defuseEvent.location || 
                    defuseEvent.defused_by ||
                    (defuseEvent.defuse_time_in_round && defuseEvent.defuse_time_in_round > 0) ||
                    (defuseEvent.defuse_time && defuseEvent.defuse_time > 0)
                  ))
                );

                if (hasPlant) {
                  roundEventsList.push({
                    type: "plant",
                    time: plantEvent.plant_time_in_round || plantEvent.plant_time || plantEvent.time || 0,
                    data: plantEvent
                  });
                }

                if (hasDefuse) {
                  roundEventsList.push({
                    type: "defuse",
                    time: defuseEvent.defuse_time_in_round || defuseEvent.defuse_time || defuseEvent.time || 0,
                    data: defuseEvent
                  });
                }

                // Sort timeline ascending by time
                roundEventsList.sort((a, b) => a.time - b.time);

                const selectedEvent = roundEventsList[selectedEventIndex];

                return (
                  <div className="mdo-round-visualizer-container">
                    {/* Left side: Minimap */}
                    <div className="mdo-round-minimap-side">
                      <div className="mdo-minimap-card">
                        <div className="card-header font-oswald text-uppercase">
                          MAP LAYOUT • {mapName}
                        </div>
                        <div className="card-body">
                          {activeMapObj?.displayIcon ? (
                            <div className="mdo-minimap-canvas-wrapper">
                              <img 
                                src={activeMapObj.displayIcon} 
                                alt={`${mapName} Layout`} 
                                className="mdo-minimap-canvas-bg"
                              />

                              {/* SVG Trajectory Lines */}
                              <svg className="mdo-minimap-canvas-svg" viewBox="0 0 100 100">
                                {selectedEvent && selectedEvent.type === "kill" && (() => {
                                  const k = selectedEvent.data;
                                  const killerLoc = k.killer_location;
                                  const victimLoc = k.victim_death_location;

                                  if (!isValidLoc(killerLoc) || !isValidLoc(victimLoc)) return null;

                                  const killerPct = convertCoords(killerLoc.x, killerLoc.y);
                                  const victimPct = convertCoords(victimLoc.x, victimLoc.y);

                                  return (
                                    <line 
                                      x1={killerPct.x}
                                      y1={killerPct.y}
                                      x2={victimPct.x}
                                      y2={victimPct.y}
                                      stroke="var(--gold)"
                                      strokeWidth="2"
                                      strokeDasharray="2 1"
                                    />
                                  );
                                })()}
                              </svg>

                              {/* Active/Alive Player Markers for Selected Kill */}
                              {selectedEvent && selectedEvent.type === "kill" && (() => {
                                const k = selectedEvent.data;
                                const locList = k.player_locations_on_kill || k.player_locations || k.playerLocations || [];
                                return locList.map((pl, idx) => {
                                  const plPuuid = pl.puuid || pl.player_puuid || pl.subject;
                                  const plPlayer = allPlayers.find(p => p.puuid === plPuuid);
                                  if (!plPlayer) return null;

                                  const character = plPlayer.character || "";
                                  const icon = agentIcons[character.toLowerCase()];
                                  
                                  const plLoc = pl.location || pl.player_location;
                                  if (!plLoc || plLoc.x === undefined || plLoc.y === undefined) return null;

                                  const pct = convertCoords(plLoc.x, plLoc.y);
                                  const angle = pl.view_radiant || pl.view_radians || pl.view_angle || pl.viewRadians || 0;
                                  const team = plPlayer.team?.toLowerCase() || "blue";

                                  // Check if this player is the killer
                                  const isKiller = plPuuid === k.killer_puuid;
                                  const highlightClass = isKiller ? "killer selected-gold-marker" : "";

                                  return (
                                    <div 
                                      key={`pl-${idx}`}
                                      className={`mdo-minimap-marker player-alive ${team} ${highlightClass}`}
                                      style={{ left: `${pct.x}%`, top: `${pct.y}%` }}
                                      title={`${plPlayer.name} (${character})`}
                                    >
                                      {icon ? <img src={icon} alt={character} /> : <span>{character.substring(0, 2)}</span>}
                                      <div 
                                        className="player-direction-pointer" 
                                        style={{ transform: `rotate(${angle}rad)` }}
                                      />
                                    </div>
                                  );
                                });
                              })()}

                              {/* Victim Marker for Selected Kill */}
                              {selectedEvent && selectedEvent.type === "kill" && (() => {
                                const k = selectedEvent.data;
                                const victimLoc = k.victim_death_location;
                                if (!isValidLoc(victimLoc)) return null;

                                const victimPct = convertCoords(victimLoc.x, victimLoc.y);
                                const victimPlayer = allPlayers.find(p => p.puuid === k.victim_puuid);
                                const victimCharacter = victimPlayer?.character || "";
                                const victimIcon = agentIcons[victimCharacter.toLowerCase()];
                                const victimTeam = victimPlayer?.team?.toLowerCase() || "red";

                                return victimIcon ? (
                                  <div 
                                    className={`mdo-minimap-marker victim selected-gold-marker ${victimTeam}`}
                                    style={{ left: `${victimPct.x}%`, top: `${victimPct.y}%` }}
                                    title={`${victimPlayer?.name || k.victim_display_name} (${victimCharacter})`}
                                  >
                                    <img src={victimIcon} alt={victimCharacter} />
                                    <div className="victim-cross">❌</div>
                                  </div>
                                ) : null;
                              })()}

                              {/* Plant Marker */}
                              {selectedEvent && selectedEvent.type === "plant" && (() => {
                                const plantLoc = selectedEvent.data.plant_location || selectedEvent.data.location || selectedEvent.data.plant_events?.location;
                                if (!isValidLoc(plantLoc)) return null;
                                const plantPct = convertCoords(plantLoc.x, plantLoc.y);
                                return (
                                  <div 
                                    className="mdo-minimap-marker spike-plant selected-gold-marker"
                                    style={{ left: `${plantPct.x}%`, top: `${plantPct.y}%` }}
                                    title="Spike Plantada"
                                  >
                                    💥
                                  </div>
                                );
                              })()}

                              {/* Defuse Marker */}
                              {selectedEvent && selectedEvent.type === "defuse" && (() => {
                                const defuseLoc = selectedEvent.data.defuse_location || selectedEvent.data.location || selectedEvent.data.defuse_events?.location;
                                if (!isValidLoc(defuseLoc)) return null;
                                const defusePct = convertCoords(defuseLoc.x, defuseLoc.y);
                                return (
                                  <div 
                                    className="mdo-minimap-marker spike-defuse selected-gold-marker"
                                    style={{ left: `${defusePct.x}%`, top: `${defusePct.y}%` }}
                                    title="Spike Desactivada"
                                  >
                                    🛡
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="mdo-minimap-loading text-dim font-oswald text-center pad-20">
                              Cargando minimapa táctico...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right/Bottom: Event Timeline Feed */}
                    <div className="mdo-round-timeline-side">
                      <div className="mdo-perf-panel-card">
                        <div className="panel-header font-oswald">
                          <span>CRONOLOGÍA DE LA RONDA</span>
                          <span className="text-dim">RONDA {selectedRoundTab}</span>
                        </div>
                        <div className="panel-body">
                          <div className="mdo-round-events-feed">
                            {roundEventsList.map((ev, evIdx) => {
                              const timeStr = formatRoundTime(ev.time);
                              const isSelected = selectedEventIndex === evIdx;
                              
                              if (ev.type === "kill") {
                                const k = ev.data;
                                const killerPlayer = allPlayers.find(p => p.puuid === k.killer_puuid);
                                const victimPlayer = allPlayers.find(p => p.puuid === k.victim_puuid);
                                const killerCharacter = killerPlayer?.character || "";
                                const victimCharacter = victimPlayer?.character || "";
                                const killerIcon = agentIcons[killerCharacter.toLowerCase()];
                                const victimIcon = agentIcons[victimCharacter.toLowerCase()];
                                const killerTeam = killerPlayer?.team?.toLowerCase() || "blue";
                                const victimTeam = victimPlayer?.team?.toLowerCase() || "red";
                                
                                return (
                                  <div 
                                    key={evIdx} 
                                    className={`mdo-feed-event-item kill ${isSelected ? "selected-gold" : ""}`}
                                    onClick={() => setSelectedEventIndex(evIdx)}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <span className="event-time font-oswald">{timeStr}</span>
                                    <div className="event-details">
                                      <div className={`event-actor killer ${killerTeam}`}>
                                        {killerIcon && <img src={killerIcon} alt={killerCharacter} className="agent-icon" />}
                                        <span className="font-oswald">{killerPlayer?.name || k.killer_display_name}</span>
                                      </div>
                                      <span className="event-verb text-dim font-oswald">
                                        [{k.weapon_name?.toUpperCase() || "ELIMINÓ"}]
                                      </span>
                                      <div className={`event-actor victim ${victimTeam}`}>
                                        {victimIcon && <img src={victimIcon} alt={victimCharacter} className="agent-icon" />}
                                        <span className="font-oswald">{victimPlayer?.name || k.victim_display_name}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              if (ev.type === "plant") {
                                const p = ev.data;
                                const planterPuuid = p.planted_by?.puuid || p.planted_by;
                                const planterPlayer = allPlayers.find(x => x.puuid === planterPuuid);
                                const planterName = planterPlayer?.name || p.planted_by?.display_name || "Atacante";
                                const planterCharacter = planterPlayer?.character || "";
                                const planterIcon = agentIcons[planterCharacter.toLowerCase()];

                                return (
                                  <div 
                                    key={evIdx} 
                                    className={`mdo-feed-event-item plant ${isSelected ? "selected-gold" : ""}`}
                                    onClick={() => setSelectedEventIndex(evIdx)}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <span className="event-time font-oswald">{timeStr}</span>
                                    <div className="event-details">
                                      <div className="event-actor plant-actor">
                                        {planterIcon && <img src={planterIcon} alt={planterCharacter} className="agent-icon" />}
                                        <span className="font-oswald" style={{ color: "var(--gold)" }}>{planterName}</span>
                                      </div>
                                      <span className="event-verb text-win-soft font-oswald font-bold">SPIKE PLANTED 💥</span>
                                    </div>
                                  </div>
                                );
                              }

                              if (ev.type === "defuse") {
                                const d = ev.data;
                                const defuserPuuid = d.defused_by?.puuid || d.defused_by;
                                const defuserPlayer = allPlayers.find(x => x.puuid === defuserPuuid);
                                const defuserName = defuserPlayer?.name || d.defused_by?.display_name || "Defensor";
                                const defuserCharacter = defuserPlayer?.character || "";
                                const defuserIcon = agentIcons[defuserCharacter.toLowerCase()];

                                return (
                                  <div 
                                    key={evIdx} 
                                    className={`mdo-feed-event-item defuse ${isSelected ? "selected-gold" : ""}`}
                                    onClick={() => setSelectedEventIndex(evIdx)}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <span className="event-time font-oswald">{timeStr}</span>
                                    <div className="event-details">
                                      <div className="event-actor defuse-actor">
                                        {defuserIcon && <img src={defuserIcon} alt={defuserCharacter} className="agent-icon" />}
                                        <span className="font-oswald" style={{ color: "var(--cyan)" }}>{defuserName}</span>
                                      </div>
                                      <span className="event-verb text-win font-bold font-oswald">SPIKE DEFUSED 🛡</span>
                                    </div>
                                  </div>
                                );
                              }

                              return null;
                            })}

                            {roundEventsList.length === 0 && (
                              <div className="text-dim font-oswald text-center pad-20">
                                Sin bajas ni eventos de Spike registrados en esta ronda.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
