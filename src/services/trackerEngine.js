export const RANK_BENCHMARKS = {
  Iron: { kd: 0.75, hs: 8, winrate: 47, dpg: 100, assists: 3.5 },
  Bronze: { kd: 0.82, hs: 11, winrate: 49, dpg: 115, assists: 3.8 },
  Silver: { kd: 0.90, hs: 14, winrate: 50, dpg: 125, assists: 4.0 },
  Gold: { kd: 0.98, hs: 17, winrate: 50, dpg: 135, assists: 4.2 },
  Platinum: { kd: 1.02, hs: 20, winrate: 50, dpg: 145, assists: 4.4 },
  Diamond: { kd: 1.05, hs: 23, winrate: 50, dpg: 152, assists: 4.6 },
  Ascendant: { kd: 1.08, hs: 25, winrate: 50, dpg: 158, assists: 4.8 },
  Immortal: { kd: 1.12, hs: 28, winrate: 50, dpg: 165, assists: 5.0 },
  Radiant: { kd: 1.15, hs: 31, winrate: 51, dpg: 172, assists: 5.2 },
};

export function getRankGroup(rankName) {
  if (!rankName) return "Gold";
  const name = rankName.toLowerCase();
  if (name.startsWith("iron")) return "Iron";
  if (name.startsWith("bronze")) return "Bronze";
  if (name.startsWith("silver")) return "Silver";
  if (name.startsWith("gold")) return "Gold";
  if (name.startsWith("platinum")) return "Platinum";
  if (name.startsWith("diamond")) return "Diamond";
  if (name.startsWith("ascendant")) return "Ascendant";
  if (name.startsWith("immortal")) return "Immortal";
  if (name.startsWith("radiant")) return "Radiant";
  return "Gold";
}

export function generateTrackerData(playerData) {
  const { stats, account } = playerData;
  const rankGroup = getRankGroup(stats.rankTier);
  const benchmark = RANK_BENCHMARKS[rankGroup];

  const avgDamage = stats.matchesPlayed > 0 ? Math.round(stats.totalDamage / stats.matchesPlayed) : 0;
  const avgAssists = stats.matchesPlayed > 0 ? Number((stats.totalAssists / stats.matchesPlayed).toFixed(1)) : 0;

  const playerMetrics = {
    kd: stats.kdRatio,
    hs: stats.headshotPct,
    winrate: stats.winrate,
    dpg: avgDamage,
    assists: avgAssists,
  };

  const insights = [];

  if (playerMetrics.hs >= benchmark.hs + 4) {
    insights.push({
      type: "strength",
      title: "Puntería de Élite",
      desc: `Tu porcentaje de tiros a la cabeza (${playerMetrics.hs}%) supera ampliamente el promedio de ${rankGroup} (${benchmark.hs}%).`,
      metric: "HS%",
      value: `${playerMetrics.hs}%`,
    });
  } else if (playerMetrics.hs < benchmark.hs - 3) {
    insights.push({
      type: "weakness",
      title: "Precisión de Aim Baja",
      desc: `Estás conectando menos disparos a la cabeza (${playerMetrics.hs}%) que el promedio de tu rango (${benchmark.hs}%). Practica crosshair placement.`,
      metric: "HS%",
      value: `${playerMetrics.hs}%`,
    });
  }

  if (playerMetrics.kd >= benchmark.kd + 0.12) {
    insights.push({
      type: "strength",
      title: "Duelista Letal",
      desc: `Tienes un ratio de eliminación/muerte de ${playerMetrics.kd}, ganando la mayoría de tus duelos de apertura.`,
      metric: "K/D",
      value: playerMetrics.kd,
    });
  } else if (playerMetrics.kd < benchmark.kd - 0.08) {
    insights.push({
      type: "weakness",
      title: "Supervivencia Crítica",
      desc: `Tu K/D (${playerMetrics.kd}) está por debajo del promedio (${benchmark.kd}). Intenta no tomar enfrentamientos sin el apoyo de tus compañeros.`,
      metric: "K/D",
      value: playerMetrics.kd,
    });
  }

  if (playerMetrics.winrate >= 54) {
    insights.push({
      type: "strength",
      title: "Impacto Victorioso",
      desc: `Tu tasa de victorias del ${playerMetrics.winrate}% demuestra que influyes positivamente en el resultado final del equipo.`,
      metric: "Winrate",
      value: `${playerMetrics.winrate}%`,
    });
  } else if (playerMetrics.winrate < 47) {
    insights.push({
      type: "weakness",
      title: "Rendimiento Inestable",
      desc: `Tu winrate actual (${playerMetrics.winrate}%) indica dificultades para cerrar partidas. Coordina mejor las rondas de compra de armas.`,
      metric: "Winrate",
      value: `${playerMetrics.winrate}%`,
    });
  }

  if (stats.uniqueAgents > 5) {
    insights.push({
      type: "weakness",
      title: "Pool de Agentes Muy Amplio",
      desc: `Has jugado con ${stats.uniqueAgents} agentes distintos. Reducir tu pool a 2 o 3 te ayudará a perfeccionar mecánicas y subir más rápido.`,
      metric: "Agentes",
      value: stats.uniqueAgents,
    });
  } else if (stats.uniqueAgents >= 2 && stats.uniqueAgents <= 4) {
    insights.push({
      type: "strength",
      title: "Versatilidad Óptima",
      desc: `Tu pool de ${stats.uniqueAgents} agentes te permite ser flexible en la selección sin descuidar tu nivel con tus agentes principales.`,
      metric: "Agentes",
      value: stats.uniqueAgents,
    });
  }

  const mapDetails = stats.agentsByMap || {};
  let worstMap = null;
  let worstWinrate = 100;
  let bestMap = null;
  let bestWinrate = -1;

  for (const [mapName, agentList] of Object.entries(mapDetails)) {
    const totalMapGames = agentList.reduce((acc, a) => acc + a.games, 0);
    const totalMapWins = agentList.reduce((acc, a) => acc + a.wins, 0);
    const mapWinrate = totalMapGames > 0 ? (totalMapWins / totalMapGames) * 100 : 0;

    if (totalMapGames >= 2) {
      if (mapWinrate < worstWinrate) {
        worstWinrate = mapWinrate;
        worstMap = mapName;
      }
      if (mapWinrate > bestWinrate) {
        bestWinrate = mapWinrate;
        bestMap = mapName;
      }
    }
  }

  if (worstMap && worstWinrate < 42) {
    insights.push({
      type: "weakness",
      title: `Problemas en ${worstMap}`,
      desc: `Tienes un winrate bajo (${Math.round(worstWinrate)}%) en ${worstMap}. Revisa guías de posicionamiento defensivo para este mapa.`,
      metric: "Mapa Crítico",
      value: worstMap,
    });
  }

  const recommendations = [];
  if (bestMap && bestWinrate >= 55) {
    const bestAgentOnMap = mapDetails[bestMap].sort((a, b) => b.winrate - a.winrate)[0]?.agent || stats.mostPlayedAgent;
    recommendations.push({
      title: `Aprovecha tu fortaleza en ${bestMap}`,
      text: `Cuando juegues en ${bestMap}, prioriza seleccionar a ${bestAgentOnMap}. Tienes una tasa de victorias sobresaliente del ${Math.round(bestWinrate)}% en este mapa.`,
      type: "focus",
    });
  }

  if (worstMap && worstWinrate < 45) {
    recommendations.push({
      title: `Practica tácticas en ${worstMap}`,
      text: `Con un winrate de ${Math.round(worstWinrate)}%, ${worstMap} es tu mapa más flojo. Coordina con tu equipo para asegurar el control de zonas clave temprano en la ronda.`,
      type: "practice",
    });
  }

  if (playerMetrics.hs < benchmark.hs) {
    recommendations.push({
      title: "Ajusta tu mira y sensibilidad",
      text: "Tu porcentaje de headshots está por debajo de la media. Intenta jugar 15 minutos en el campo de tiro antes de buscar partida competitiva, enfocándote en disparar solo a la cabeza.",
      type: "practice",
    });
  }

  return {
    rankGroup,
    benchmarks: {
      player: playerMetrics,
      average: benchmark,
    },
    insights: insights.length > 0 ? insights : [
      {
        type: "strength",
        title: "Jugador Estable",
        desc: "Tus estadísticas globales se encuentran alineadas de forma equilibrada con el promedio de tu rango actual.",
        metric: "Desempeño",
        value: "Normal",
      }
    ],
    recommendations: recommendations.length > 0 ? recommendations : [
      {
        title: "Continúa perfeccionando tu juego",
        text: "Sigue jugando partidas competitivas con tus agentes preferidos para recopilar más datos tácticos y detectar áreas de mejora más específicas.",
        type: "focus",
      }
    ],
  };
}
