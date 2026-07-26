const LEADERBOARD_KEY = 'splashtower_leaderboard';
const MAX_SCORES = 50;

class Leaderboard {
  constructor() {
    this.scores = [];
    this._cgAvailable = false;
  }

  async init() {
    await this._loadLocal();
    try {
      this._cgAvailable = !!(window.CrazyGames && window.CrazyGames.SDK);
    } catch (_) {}
  }

  isAvailable() { return this._cgAvailable; }

  async submitScore(score, meta) {
    const entry = {
      score: Math.round(score),
      wave: meta.wave || 0,
      map: meta.map || 0,
      date: Date.now(),
    };
    this.scores.push(entry);
    this.scores.sort((a, b) => b.score - a.score);
    if (this.scores.length > MAX_SCORES) this.scores.length = MAX_SCORES;
    this._saveLocal();

    if (this._cgAvailable) {
      try {
        if (window.CrazyGames.SDK.user.submitScore) {
          await window.CrazyGames.SDK.user.submitScore({ score: entry.score });
        } else if (window.CrazyGames.SDK.user.addScore) {
          await window.CrazyGames.SDK.user.addScore(entry.score);
        }
      } catch (_) {}
    }
  }

  getTopScores(limit) {
    return this.scores.slice(0, limit || 10);
  }

  getBestScore() {
    return this.scores.length > 0 ? this.scores[0].score : 0;
  }

  _loadLocal() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      if (raw) this.scores = JSON.parse(raw);
    } catch (_) { this.scores = []; }
  }

  _saveLocal() {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.scores));
    } catch (_) {}
  }
}

window.Leaderboard = Leaderboard;
