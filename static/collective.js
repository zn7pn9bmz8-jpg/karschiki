(() => {
  const $ = id => document.getElementById(id);
  const url = String(window.KARSHIKI_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(window.KARSHIKI_SUPABASE_ANON_KEY || '').trim();
  const configured = /^https:\/\/.+\.supabase\.co$/.test(url) && key && !key.includes('ВСТАВЬТЕ_');
  const ID_KEY = 'karschiki_collective_player_id_v1';
  const NAME_KEY = 'karschiki_collective_player_name_v1';
  let playerId = localStorage.getItem(ID_KEY);
  if (!playerId) {
    playerId = (crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem(ID_KEY, playerId);
  }
  let playerName = localStorage.getItem(NAME_KEY) || '';
  let joined = false;
  const status = $('collectiveStatus');
  const form = $('collectiveJoinForm');
  const nameInput = $('collectiveName');
  const list = $('collectiveRanking');
  const period = $('collectivePeriod');

  function say(message, error = false) {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }
  function headers(extra = {}) {
    return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
  }
  async function request(path, options = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: headers(options.headers || {}) });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).message || ''; } catch (_) {}
      throw new Error(detail || `Ошибка базы (${response.status})`);
    }
    if (response.status === 204) return null;
    return response.json();
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function startOfPeriod() {
    const now = new Date();
    if (period.value === 'all') return null;
    if (period.value === 'day') now.setHours(0, 0, 0, 0);
    else {
      const day = (now.getDay() + 6) % 7;
      now.setDate(now.getDate() - day);
      now.setHours(0, 0, 0, 0);
    }
    return now.toISOString();
  }
  async function loadRanking() {
    if (!configured || !joined) return;
    try {
      const since = startOfPeriod();
      const query = 'game_rounds?select=player_id,player_name,multiplier,collected,created_at&order=created_at.desc&limit=2000' + (since ? `&created_at=gte.${encodeURIComponent(since)}` : '');
      const [rows, registered] = await Promise.all([
        request(query),
        request('players?select=player_id,player_name&order=created_at.asc&limit=500')
      ]);
      const stats = new Map();
      for (const person of registered) stats.set(person.player_id, { id: person.player_id, name: person.player_name || 'Игрок', rounds: 0, wins: 0, best: 0, earned: 0 });
      for (const row of rows) {
        const item = stats.get(row.player_id) || { id: row.player_id, name: row.player_name || 'Игрок', rounds: 0, wins: 0, best: 0, earned: 0 };
        item.name = row.player_name || item.name;
        item.rounds++;
        item.best = Math.max(item.best, Number(row.multiplier) || 0);
        if (row.collected) { item.wins++; item.earned += Math.floor(300 * (Number(row.multiplier) || 1)); }
        stats.set(row.player_id, item);
      }
      const players = [...stats.values()].sort((a,b) => b.earned - a.earned || b.best - a.best || b.wins - a.wins);
      if (!players.length) {
        list.innerHTML = '<p class="collective-empty">Пока нет завершённых поездок. Стань первым!</p>';
        return;
      }
      list.innerHTML = players.map((p, i) => `<div class="collective-player"><span class="collective-place">${i + 1}</span><span class="collective-player-info"><b>${escapeHtml(p.name)}</b><small>${p.rounds} поездок · ${p.wins} успешных · рекорд ${p.best.toFixed(2)}x</small></span><strong>${p.earned.toLocaleString('ru-RU')} ₽</strong></div>`).join('');
    } catch (error) {
      say(`Не удалось обновить рейтинг: ${error.message}`, true);
    }
  }
  async function join(name) {
    if (!configured) {
      say('Общая база ещё не подключена. Сначала настройте Supabase по инструкции в архиве.', true);
      return;
    }
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (clean.length < 2) { say('Введи имя длиной хотя бы 2 символа.', true); return; }
    try {
      await request('players?on_conflict=player_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ player_id: playerId, player_name: clean })
      });
      playerName = clean;
      localStorage.setItem(NAME_KEY, clean);
      joined = true;
      nameInput.value = clean;
      $('collectiveJoinButton').textContent = 'СОХРАНИТЬ ИМЯ';
      say(`Ты в общем рейтинге как «${clean}».`);
      await loadRanking();
    } catch (error) {
      say(`Не удалось подключиться: ${error.message}`, true);
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    join(nameInput.value);
  });
  period.addEventListener('change', loadRanking);
  if (playerName) nameInput.value = playerName;
  if (!configured) say('Рейтинг готов к подключению. Нужны URL и anon key Supabase из инструкции.', true);
  else if (playerName) join(playerName);

  window.addEventListener('karshiki:round-finished', async event => {
    if (!joined || !configured) return;
    const detail = event.detail || {};
    try {
      await request('game_rounds', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ player_id: playerId, player_name: playerName, multiplier: Number(detail.multiplier) || 1, collected: !!detail.collected })
      });
      await loadRanking();
    } catch (error) {
      say(`Поездка сыграна, но результат не попал в рейтинг: ${error.message}`, true);
    }
  });
  if (configured) window.setInterval(loadRanking, 15000);
})();
