class SaveManager {
  constructor() {
    this._prefix = 'splashtower_';
  }

  _hasCG() {
    return window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data;
  }

  _storage() {
    if (this._hasCG()) return window.CrazyGames.SDK.data;
    return null;
  }

  async getItem(key) {
    const k = this._prefix + key;
    try {
      const store = this._storage();
      if (store) {
        const raw = store.getItem(k);
        return raw ? JSON.parse(raw) : null;
      }
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[SaveManager] getItem error:', e);
      return null;
    }
  }

  async setItem(key, value) {
    const k = this._prefix + key;
    try {
      const store = this._storage();
      if (store) {
        store.setItem(k, JSON.stringify(value));
        return;
      }
      localStorage.setItem(k, JSON.stringify(value));
    } catch (e) {
      console.warn('[SaveManager] setItem error:', e);
    }
  }

  async removeItem(key) {
    const k = this._prefix + key;
    try {
      const store = this._storage();
      if (store) {
        store.removeItem(k);
        return;
      }
      localStorage.removeItem(k);
    } catch (e) {
      console.warn('[SaveManager] removeItem error:', e);
    }
  }

  _migrateFromLocalStorage() {
    if (!this._hasCG()) return;
    const cg = window.CrazyGames.SDK.data;
    const migratedKey = this._prefix + '_migrated';
    if (cg.getItem(migratedKey)) return;
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this._prefix)) {
        try {
          cg.setItem(k, localStorage.getItem(k));
          found = true;
        } catch (_) {}
      }
    }
    if (found) cg.setItem(migratedKey, '1');
  }

  async saveProgress(data) {
    this._migrateFromLocalStorage();
    const existing = (await this.getItem('progress')) || {};
    const merged = { ...existing, ...data, _updated: Date.now() };
    await this.setItem('progress', merged);
  }

  async loadProgress() {
    this._migrateFromLocalStorage();
    const data = await this.getItem('progress');
    return data || {};
  }

  async resetProgress() {
    await this.removeItem('progress');
  }
}

window.SaveManager = SaveManager;
