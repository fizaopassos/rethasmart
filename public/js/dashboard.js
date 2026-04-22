let dispositivos  = [];
let ultimosEventos = {};

// ─── Utilitários ────────────────────────────────────────────

function getUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

function aplicarPermissoes() {
  const user = getUserFromToken();
  if (!user) return;

  if (user.role === 'admin') {
    // 🔥 NOVA LÓGICA: Pega o menu oculto do HTML e exibe
    const menuUsuarios = document.getElementById('menu-usuarios');
    if (menuUsuarios) {
      menuUsuarios.style.display = 'inline-block';
    }
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

function getToken() {
  return localStorage.getItem("token");
}

function formatarData(data) {
  if (!data) return '-';
  return new Date(data).toLocaleString("pt-BR");
}

function atualizarKPIs() {
  const total = dispositivos.length;
  let normal = 0;
  let alerta = 0;
  let offline = 0;

  dispositivos.forEach(disp => {
    const ult = ultimosEventos[disp.device_id];
    const status = classificarStatus(ult?.evento, disp);

    if (status.label === 'Normal') normal++;
    else if (status.label === 'Em Alerta') alerta++;
    else offline++;
  });

  const elTotal = document.getElementById('kpi-total');
  const elNormal = document.getElementById('kpi-normal');
  const elAlerta = document.getElementById('kpi-alerta');
  const elOffline = document.getElementById('kpi-offline');

  if (elTotal) elTotal.textContent = total;
  if (elNormal) elNormal.textContent = normal;
  if (elAlerta) elAlerta.textContent = alerta;
  if (elOffline) elOffline.textContent = offline;
}

renderizarCards();
atualizarKPIs();


function classificarStatus(evento, disp) {

  // 🔴 OFFLINE tem prioridade máxima
  if (disp && disp.status === 'offline') {
    return {
      label: 'Offline',
      borderClass: 'status-offline',
      badgeClass: 'badge-offline'
    };
  }

  if (!evento) return { label: 'Sem eventos', borderClass: '', badgeClass: 'badge-normal' };

  const t = evento.toLowerCase();

  if (t.includes('incendio') || t.includes('incêndio') ||
      t.includes('fogo')     || t.includes('alarme')) {
    return { label: 'Em Alerta', borderClass: 'status-alerta', badgeClass: 'badge-alerta' };
  }
  if (t.includes('falha')  || t.includes('erro') ||
      t.includes('defeito') || t.includes('trouble') || t.includes('supervisao')) {
    return { label: 'Falha', borderClass: 'status-falha', badgeClass: 'badge-falha' };
  }

  return { label: 'Normal', borderClass: 'status-normal', badgeClass: 'badge-normal' };
}

function classificarEvento(evento) {
  if (!evento) return { label: 'Sem eventos', borderClass: '', badgeClass: 'badge-normal' };

  const t = evento.toLowerCase();

  if (t.includes('alarme') || t.includes('incendio') || t.includes('fogo')) {
    return { label: 'Em Alerta', borderClass: 'status-alerta', badgeClass: 'badge-alerta' };
  }

  if (t.includes('falha') || t.includes('erro')) {
    return { label: 'Falha', borderClass: 'status-falha', badgeClass: 'badge-falha' };
  }

  return { label: 'Normal', borderClass: 'status-normal', badgeClass: 'badge-normal' };
}

// ─── Som ────────────────────────────────────────────────────
function tocarSom() {
  const audio = document.getElementById('som-alerta');
  if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

// ─── Flash no card ──────────────────────────────────────────
function destacarCard(deviceId) {
  const card = document.querySelector(`[data-device-id="${deviceId}"]`);
  if (!card) return;
  card.classList.add('alerta-flash');
  setTimeout(() => card.classList.remove('alerta-flash'), 1500);
}

// ─── Carregar dados ─────────────────────────────────────────
async function carregarDispositivos() {
  const token = getToken();
  if (!token) { logout(); return; }

  const res = await fetch('/api/dispositivos', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (res.status === 401) { logout(); return; }

  dispositivos = await res.json();
}

async function carregarEventosIniciais() {
  const token = getToken();
  const res = await fetch('/api/eventos', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (res.status === 401) return;

  const eventos = await res.json();
  ultimosEventos = {};

  // O mais recente de cada dispositivo (já vem DESC do banco)
  eventos.forEach(ev => {
    if (!ultimosEventos[ev.device_id]) ultimosEventos[ev.device_id] = ev;
  });
}

// ─── Renderizar cards (1 card por dispositivo) ───────────────
function renderizarCards() {
  const container = document.getElementById('cards');
  container.innerHTML = "";

  if (!dispositivos.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;
                  background:white;border-radius:8px;color:#777;">
        Nenhum dispositivo cadastrado.
      </div>`;
    return;
  }

  dispositivos.forEach(disp => {

    const ult    = ultimosEventos[disp.device_id];
    const status = classificarStatus(ult?.evento, disp);

    // 🟢 ONLINE / OFFLINE
    let statusOnline = disp.status === 'online';

    if (!disp.status && disp.last_seen) {
      const diff = (new Date() - new Date(disp.last_seen)) / 1000;
      statusOnline = diff < 30;
    }
    
    const card = document.createElement('div');
    card.className = `device-card ${status.borderClass}`;
    card.setAttribute('data-device-id', disp.device_id);
    card.onclick = () => abrirModal(disp);

    // 🔴 OFFLINE visual
    if (disp.status === 'offline') {
      card.style.opacity = "0.6";
    }

    card.innerHTML = `
      <div class="device-top">
        <div class="device-name">${disp.nome}</div>
        <div class="badge ${status.badgeClass}">${status.label}</div>
      </div>

      <div class="device-info">📍 ${disp.condominio_nome || 'Sem condomínio'}</div>
      <div class="device-info">🆔 ${disp.device_id}</div>

      <div class="device-status">
        ${statusOnline ? '🟢 Online' : '🔴 Offline'}
      </div>

      <div class="device-event">
        <strong>Último Evento:</strong><br>
        ${ult?.evento || 'Aguardando comunicação...'}
        <div style="font-size:0.8rem;color:#999;margin-top:5px;">
          🕒 ${formatarData(ult?.created_at)}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ─── WebSocket ───────────────────────────────────────────────
function iniciarWebSocket() {
  const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocolo}//${location.host}`);
  const statusEl = document.getElementById('status');

  ws.onopen = () => {
    statusEl.textContent = "🟢 Conectado em tempo real";
    statusEl.style.cssText = "background:#e8f8f5;color:#117a65;border-left-color:#1abc9c";
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);

      if (data.tipo === 'novo_evento') {
        const ev = data.evento;
        ultimosEventos[ev.device_id] = ev;

        // 🔥 atualiza status em memória
        const disp = dispositivos.find(d => d.device_id === ev.device_id);
        if (disp) {
            const eventoLower = ev.evento.toLowerCase();
            if (eventoLower.includes('offline')) {
                disp.status = 'offline';
            }
            if (eventoLower.includes('online')) {
                disp.status = 'online';
            }
        }

        renderizarCards();
        destacarCard(ev.device_id);
        tocarSom();

        // Se modal estiver aberto para este dispositivo, adiciona evento no topo
        const modalTitulo = document.getElementById('modalTitulo');
        const modalBg = document.getElementById('modalBg');
        if (modalTitulo && modalBg && modalBg.style.display === 'flex' && modalTitulo.innerText.includes(ev.device_id)) {
          const cor = classificarEvento(ev.evento);
          const corBorda = cor.borderClass === 'status-alerta' ? '#e74c3c' :
                           cor.borderClass === 'status-falha'  ? '#f1c40f' : '#2ecc71';
          const item = document.createElement('div');
          item.className = 'history-item';
          item.style.borderLeftColor = corBorda;
          item.innerHTML = `
            <div class="history-top">
              <span>Origem: ${ev.origem || 'central'}</span>
              <span>${formatarData(ev.created_at || new Date())}</span>
            </div>
            <div class="history-evento">${ev.evento}</div>
          `;
          document.getElementById('modalEventos').prepend(item);
        }
      }
    } catch (err) {
      console.error("Erro WS:", err);
    }
  };

  ws.onclose = () => {
    statusEl.textContent = "🔴 Conexão perdida. Reconectando...";
    statusEl.style.cssText = "background:#f2dede;color:#a94442;border-left-color:#e74c3c";
    setTimeout(iniciarWebSocket, 3000);
  };
}

// ─── Modal de histórico ──────────────────────────────────────
async function abrirModal(dispositivo) {
  const token = getToken();

  const res = await fetch(`/api/dispositivos/${dispositivo.device_id}/eventos`, {
    headers: { Authorization: 'Bearer ' + token }
  });

  if (res.status === 401) {
    logout();
    return;
  }

  const eventos = await res.json();

  document.getElementById('modalTitulo').innerText =
    `${dispositivo.nome} (${dispositivo.device_id})`;

  const body = document.getElementById('modalEventos');
  body.innerHTML = "";

  if (!eventos.length) {
    body.innerHTML = `
      <div style="text-align:center;color:#777;padding:20px;">
        Nenhum evento registrado.
      </div>
    `;
    return;
  }

  eventos.forEach(ev => {
    let cor = "#2ecc71"; // verde padrão

    const texto = (ev.evento || '').toLowerCase();

    // 🔴 alerta
    if (texto.includes('alarme') || texto.includes('incendio') || texto.includes('fogo')) {
      cor = "#e74c3c";
    }
    // 🟡 falha
    else if (texto.includes('falha') || texto.includes('erro') || texto.includes('defeito')) {
      cor = "#f1c40f";
    }
    // ⚫ offline
    else if (texto.includes('offline')) {
      cor = "#7f8c8d";
    }
    // 🟢 online (opcional)
    else if (texto.includes('online')) {
      cor = "#2ecc71";
    }

    const item = document.createElement('div');
    item.className = 'timeline-item';

    item.innerHTML = `
      <div class="timeline-dot" style="background:${cor}"></div>
      <div class="timeline-content" style="border-left:4px solid ${cor}">
        <div class="timeline-top">
          <span class="timeline-event">${ev.evento}</span>
          <span class="timeline-date">${formatarData(ev.created_at)}</span>
        </div>
        <div class="timeline-extra">
          Origem: ${ev.origem || '-'}
        </div>
      </div>
    `;

    body.appendChild(item);
  });

  document.getElementById('modalBg').style.display = 'flex';
}

function fecharModal(event) {
  if (!event || event.target.id === 'modalBg') {
    document.getElementById('modalBg').style.display = 'none';
  }
}

// ─── Inicialização ───────────────────────────────────────────
async function iniciar() {
  try {
    aplicarPermissoes(); // Agora funciona sem travar nada!
    await carregarDispositivos();
    await carregarEventosIniciais();
    renderizarCards();
    iniciarWebSocket();
  } catch (err) {
    console.error(err);
    document.getElementById('status').textContent = "❌ Erro ao carregar sistema.";
  }
}

iniciar();
