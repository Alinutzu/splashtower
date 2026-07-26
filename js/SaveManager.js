class SaveManager {
  constructor() {
    this._prefix = 'splashtower_';
  }

  async getItem(key) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[SaveManager] getItem error:', e);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify(value));
    } catch (e) {
      console.warn('[SaveManager] setItem error:', e);
    }
  }

  async saveProgress(data) {
    const existing = (await this.getItem('progress')) || {};
    const merged = { ...existing, ...data, _updated: Date.now() };
    await this.setItem('progress', merged);
  }

  async loadProgress() {
    const data = await this.getItem('progress');
    return data || {};
  }

  async resetProgress() {
    try {
      localStorage.removeItem(this._prefix + 'progress');
    } catch (e) {
      console.warn('[SaveManager] reset error:', e);
    }
  }
}

window.SaveManager = SaveManager;
