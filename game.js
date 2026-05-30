// Clippa Scoreboard — Game Logic

const FORMATS = {
  single_9_games: {
    label: 'Set único até 9',
    sub: 'apenas games',
    type: 'single',
    target: 9,
    points: false,
    tb: true,
    tbTrigger: 8,
    tbTarget: 7,
  },
  single_9_full: {
    label: 'Set único até 9',
    sub: 'completo, com pontuação',
    type: 'single',
    target: 9,
    points: true,
    tb: true,
    tbTrigger: 8,
    tbTarget: 7,
  },
  best3_tb_games: {
    label: 'Melhor de 3 sets (6+6+TB até 10)',
    sub: 'apenas games',
    type: 'best3',
    target: 6,
    points: false,
    tb: true,
    tbTarget: 10,
  },
  best3_tb_full: {
    label: 'Melhor de 3 sets (6+6+TB até 10)',
    sub: 'completo, com pontuação',
    type: 'best3',
    target: 6,
    points: true,
    tb: true,
    tbTarget: 10,
  },
  best3_6_games: {
    label: 'Melhor de 3 sets (sets até 6)',
    sub: 'apenas games',
    type: 'best3',
    target: 6,
    points: false,
    tb: false,
  },
  best3_6_full: {
    label: 'Melhor de 3 sets (sets até 6)',
    sub: 'completo, com pontuação',
    type: 'best3',
    target: 6,
    points: true,
    tb: false,
  },
};

function newState(format, teamA, teamB) {
  return {
    format: format || null,
    team_a: teamA || 'Time A',
    team_b: teamB || 'Time B',
    phase: 'idle',
    warmup_end: null,
    pts_a: 0,
    pts_b: 0,
    advantage: null,
    games_a: 0,
    games_b: 0,
    sets_a: 0,
    sets_b: 0,
    in_tb: false,
    tb_a: 0,
    tb_b: 0,
    completed_sets: [],
    winner: null,
    history: [],
  };
}

function score(state, team) {
  if (state.winner || state.phase === 'idle' || state.phase === 'warmup') return state;
  const fmt = FORMATS[state.format];
  if (!fmt) return state;

  const s = saveHistory(cloneState(state));

  if (s.in_tb) return handleTBPoint(s, team, fmt);
  if (fmt.points) return handlePoint(s, team, fmt);
  return handleGame(s, team, fmt);
}

function handlePoint(s, team, fmt) {
  const other = opp(team);

  if (s.advantage) {
    if (s.advantage === team) {
      s.pts_a = 0; s.pts_b = 0; s.advantage = null;
      return handleGame(s, team, fmt);
    }
    s.advantage = null;
    return s;
  }

  s['pts_' + team]++;
  const mine = s['pts_' + team];
  const theirs = s['pts_' + other];

  if (mine >= 4) {
    if (theirs >= 3) {
      s.advantage = team;
      s.pts_a = 3; s.pts_b = 3;
    } else {
      s.pts_a = 0; s.pts_b = 0; s.advantage = null;
      return handleGame(s, team, fmt);
    }
  }
  return s;
}

function handleTBPoint(s, team, fmt) {
  const other = opp(team);
  s['tb_' + team]++;
  const mine = s['tb_' + team];
  const theirs = s['tb_' + other];

  if (mine >= fmt.tbTarget && mine - theirs >= 2) {
    s.in_tb = false;
    s.pts_a = 0; s.pts_b = 0;
    if (fmt.type === 'single') {
      s.winner = team;
      s.phase = 'finished';
      return s;
    }
    s.completed_sets.push({ a: s.games_a, b: s.games_b });
    s['sets_' + team]++;
    s.games_a = 0; s.games_b = 0;
    s.tb_a = 0; s.tb_b = 0;
    return checkMatch(s, team);
  }
  return s;
}

function handleGame(s, team, fmt) {
  s['games_' + team]++;
  s.pts_a = 0; s.pts_b = 0; s.advantage = null;

  if (fmt.type === 'single') {
    const myGames = s['games_' + team];
    const oppGames = s['games_' + opp(team)];
    if (fmt.tb && myGames >= fmt.tbTrigger && oppGames >= fmt.tbTrigger) {
      s.in_tb = true;
      s.tb_a = 0; s.tb_b = 0;
      return s;
    }
    if (myGames >= fmt.target) {
      s.winner = team;
      s.phase = 'finished';
    }
    return s;
  }

  return checkSet(s, team, fmt);
}

function checkSet(s, team, fmt) {
  const other = opp(team);
  const mine = s['games_' + team];
  const theirs = s['games_' + other];

  let setWon = false;

  if (!fmt.tb) {
    setWon = mine >= fmt.target;
  } else {
    if (mine >= fmt.target && mine - theirs >= 2) {
      setWon = true;
    } else if (mine === fmt.target && theirs === fmt.target) {
      s.in_tb = true; s.tb_a = 0; s.tb_b = 0;
      return s;
    }
  }

  if (setWon) {
    s.completed_sets.push({ a: s.games_a, b: s.games_b });
    s['sets_' + team]++;
    s.games_a = 0; s.games_b = 0;
    s.in_tb = false; s.tb_a = 0; s.tb_b = 0;
    return checkMatch(s, team);
  }
  return s;
}

function checkMatch(s, team) {
  if (s['sets_' + team] >= 2) {
    s.winner = team;
    s.phase = 'finished';
  }
  return s;
}

function undo(state) {
  if (!state.history || state.history.length === 0) return state;
  const [prev, ...rest] = state.history;
  return Object.assign(JSON.parse(prev), { history: rest });
}

function resetMatch(state) {
  return newState(state.format, state.team_a, state.team_b);
}

function startWarmup(state, secs) {
  const s = saveHistory(cloneState(state));
  s.phase = 'warmup';
  s.warmup_end = new Date(Date.now() + secs * 1000).toISOString();
  return s;
}

function beginMatch(state) {
  const s = saveHistory(cloneState(state));
  s.phase = 'playing';
  s.warmup_end = null;
  return s;
}

function setFormat(state, format) {
  const s = cloneState(state);
  s.format = format;
  if (s.phase === 'idle') {
    s.games_a = 0; s.games_b = 0;
    s.pts_a = 0; s.pts_b = 0;
    s.sets_a = 0; s.sets_b = 0;
    s.completed_sets = [];
    s.winner = null;
    s.in_tb = false;
    s.advantage = null;
  }
  return s;
}

// Helpers
function opp(t) { return t === 'a' ? 'b' : 'a'; }

const PTS_LABELS = ['0', '15', '30', '40'];

function ptsDisplay(state) {
  if (state.advantage === 'a') return { a: 'AD', b: '40' };
  if (state.advantage === 'b') return { a: '40', b: 'AD' };
  return {
    a: PTS_LABELS[state.pts_a] || '0',
    b: PTS_LABELS[state.pts_b] || '0',
  };
}

function cloneState(state) {
  const { history, ...rest } = state;
  return Object.assign(JSON.parse(JSON.stringify(rest)), { history: [...(history || [])] });
}

function saveHistory(s) {
  const { history, ...rest } = s;
  return Object.assign(s, {
    history: [JSON.stringify(rest), ...(history || [])].slice(0, 20),
  });
}

function formatScore(state) {
  const fmt = FORMATS[state.format];
  if (!fmt) return '';
  if (fmt.type === 'single') return state.games_a + '–' + state.games_b;
  if (!state.completed_sets || !state.completed_sets.length) return state.games_a + '–' + state.games_b;
  return state.completed_sets.map(s => s.a + '–' + s.b).join(' | ');
}
