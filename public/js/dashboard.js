let dispositivos  = [];
let ultimosEventos = {};

// ─── Utilitários ─────────────────────────────────────────────────────────────

function getUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function aplicarPermissoes() {
  const user = getUserFromToken();
  if (!user) return;
  if (user.role === "admin") {
    const menuUsuarios = document.getElementById("menu-usuarios");
    if (menuUsuarios) menuUsuarios.style.display = "flex";
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
  if (!data) return "-";
  return new Date(data).toLocaleString("pt-BR");
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function atualizarKPIs() {
  const total = dispositivos.length;
  let normal  = 0;
  let alerta  = 0;
  let offline = 0;

  dispositivos.forEach(disp => {
    const ult    = ultimosEventos[disp.device_id];
    const status = classificarStatus(ult?.evento, disp);

    if (status.label === "Normal")    normal++;
    else if (status.label === "Em Alerta") alerta++;
    else offline++;
  });

  // Valores
  const elTotal   = document.getElementById("kpi-total");
  const elNormal  = document.getElementById("kpi-normal");
  const elAlerta  = document.getElementById("kpi-alerta");
  const elOffline = document.getElementById("kpi-offline");

  if (elTotal)   elTotal.textContent   = total;
  if (elNormal)  elNormal.textContent  = normal;
  if (elAlerta)  elAlerta.textContent  = alerta;
  if (elOffline) elOffline.textContent = offline;

  // ── Cores dinâmicas nos cards de KPI ──────────────────────────────────────
  const boxNormal  = document.getElementById("kpi-normal-box");
  const boxAlerta  = document.getElementById("kpi-alerta-box");
  const boxOffline = document.getElementById("kpi-offline-box");

  if (boxNormal) {
    boxNormal.className = "kpi-card" + (normal > 0 && alerta === 0 && offline === 0 ? " kpi-ok" : "");
  }
  if (boxAlerta) {
    boxAlerta.className = "kpi-card" + (alerta > 0 ? " kpi-alerta" : "");
  }
  if (boxOffline) {
    boxOffline.className = "kpi-card" + (offline > 0 ? " kpi-offline" : "");
  }
}

// ─── Última atualização ───────────────────────────────────────────────────────

function atualizarUltimaAtualizacao() {
  const el = document.getElementById("ultima-atualizacao");
  if (el) el.textContent = new Date().toLocaleTimeString("pt-BR");
}

// ─── Classificadores ─────────────────────────────────────────────────────────

function classificarStatus(evento, disp) {
  if (disp && disp.status === "offline") {
    return { label: "Offline", borderClass: "status-offline", badgeClass: "badge-offline" };
  }
  if (!evento) {
    return { label: "Normal", borderClass: "status-normal", badgeClass: "badge-normal" };
  }

  const t = evento.toLowerCase();

  // 🔴 AGORA O TEXTO OFFLINE FICA PRETO/CINZA NOS EVENTOS
  if (t.includes("offline") || t.includes("desconectado")) {
    return { label: "Offline", borderClass: "status-offline", badgeClass: "badge-offline" };
  }

  // ALARMES
  if (t.includes("incendio") || t.includes("incêndio") || t.includes("fogo") || t.includes("alarme")) {
    return { label: "Em Alerta", borderClass: "status-alerta", badgeClass: "badge-alerta" };
  }
  if (t.includes("falha") || t.includes("erro") || t.includes("defeito") || t.includes("trouble") || t.includes("supervisao")) {
    return { label: "Falha", borderClass: "status-falha", badgeClass: "badge-falha" };
  }

  // 🟢 FORÇA TUDO QUE É RESET A FICAR VERDE
  if (t.includes("normalizado") || t.includes("restabelecido")) {
    return { label: "Normal", borderClass: "status-normal", badgeClass: "badge-normal" };
  }

  return { label: "Normal", borderClass: "status-normal", badgeClass: "badge-normal" };
}


function classificarEvento(evento) {
  return classificarStatus(evento, null);
}

// ─── Efeitos Visuais / Sonoros ────────────────────────────────────────────────

function tocarSom() {
  const audio = document.getElementById("som-alerta");
  if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

function destacarCard(deviceId) {
  const card = document.querySelector(`[data-device-id="${deviceId}"]`);
  if (!card) return;
  card.classList.add("alerta-flash");
  setTimeout(() => card.classList.remove("alerta-flash"), 1500);
}

// ─── Carregar dados da API ────────────────────────────────────────────────────

async function carregarDispositivos() {
  const token = getToken();
  if (!token) { logout(); return; }

  const res = await fetch("/api/dispositivos", {
    headers: { Authorization: "Bearer " + token }
  });
  if (res.status === 401) { logout(); return; }

  dispositivos = await res.json();
}

async function carregarEventosIniciais() {
  const token = getToken();
  const res = await fetch("/api/eventos", {
    headers: { Authorization: "Bearer " + token }
  });
  if (res.status === 401) return;

  const eventos = await res.json();
  ultimosEventos = {};

  if (Array.isArray(eventos)) {
    eventos.forEach(ev => {
      if (!ultimosEventos[ev.device_id]) ultimosEventos[ev.device_id] = ev;
    });
  }
}

// ─── Filtro de condomínio ─────────────────────────────────────────────────────

function popularFiltroCondominio() {
  const select = document.getElementById("filtro-condominio");
  if (!select) return;

  // Limpa opções antigas (mantém o "Todos")
  select.innerHTML = '<option value="">Todos os condomínios</option>';

  const condominios = [...new Set(
    dispositivos.map(d => d.condominio_nome).filter(Boolean)
  )];

  condominios.forEach(nome => {
    const opt = document.createElement("option");
    opt.value       = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

document.addEventListener("change", e => {
  if (e.target.id === "filtro-condominio") renderizarCards();
});

// ─── Renderizar cards ─────────────────────────────────────────────────────────

function renderizarCards() {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  if (!dispositivos.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;
                  background:white;border-radius:8px;color:#777;">
        Nenhum dispositivo encontrado em sua conta.
      </div>`;
    return;
  }

  // Aplica filtro de condomínio
  const filtro = document.getElementById("filtro-condominio")?.value;
  const lista  = filtro
    ? dispositivos.filter(d => d.condominio_nome === filtro)
    : dispositivos;

  if (!lista.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;
                  background:white;border-radius:8px;color:#777;">
        Nenhum dispositivo neste condomínio.
      </div>`;
    return;
  }

  lista.forEach(disp => {
    const ult    = ultimosEventos[disp.device_id];
    const status = classificarStatus(ult?.evento, disp);

    let statusOnline = disp.status === "online";
    if (!disp.status && disp.last_seen) {
      const diff = (new Date() - new Date(disp.last_seen)) / 1000;
      statusOnline = diff < 35;
    }

    const card = document.createElement("div");
    card.className = `device-card ${status.borderClass}`;
    card.setAttribute("data-device-id", disp.device_id);
    card.onclick = () => abrirModal(disp);

    if (disp.status === "offline") card.style.opacity = "0.6";

    card.innerHTML = `
      <div class="device-top">
        <div class="device-name">${disp.nome}</div>
        <div class="badge ${status.badgeClass}">${status.label}</div>
      </div>
      <div class="device-info">📍 ${disp.condominio_nome || "Sem condomínio"}</div>
      <div class="device-info">🆔 ${disp.device_id}</div>
      <div class="device-status">
        ${statusOnline ? "🟢 Online" : "🔴 Offline"}
      </div>
      <div class="device-event">
        <strong>Último Evento:</strong><br>
        ${ult?.evento || "Aguardando comunicação..."}
        <div style="font-size:0.8rem;color:#999;margin-top:5px;">
          🕒 ${formatarData(ult?.created_at)}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

function iniciarWebSocket() {
  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  const ws        = new WebSocket(`${protocolo}//${location.host}`);
  const statusEl  = document.getElementById("status");

  ws.onopen = () => {
    statusEl.textContent = "🟢 Conectado em tempo real";
    statusEl.style.cssText =
      "background:#e8f8f5;color:#117a65;border-left-color:#1abc9c";
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);

      if (data.tipo === "novo_evento") {
        const ev = data.evento;
        ultimosEventos[ev.device_id] = ev;

        const disp = dispositivos.find(d => d.device_id === ev.device_id);
        if (disp) {
          const t = ev.evento.toLowerCase();
          if (t.includes("offline")) disp.status = "offline";
          if (t.includes("online"))  disp.status = "online";
        }

        renderizarCards();
        atualizarKPIs();
        destacarCard(ev.device_id);
        tocarSom();
        atualizarUltimaAtualizacao();

        // Injeta no modal se estiver aberto para este dispositivo
        const modalTitulo = document.getElementById("modalTitulo");
        const modalBg     = document.getElementById("modalBg");
        if (modalTitulo && modalBg &&
            modalBg.style.display === "flex" &&
            modalTitulo.innerText.includes(ev.device_id)) {

          const s = classificarEvento(ev.evento);
          let corBorda = "#2ecc71";
          if (s.borderClass === "status-alerta")  corBorda = "#e74c3c";
          if (s.borderClass === "status-falha")   corBorda = "#f1c40f";
          if (s.borderClass === "status-offline") corBorda = "#7f8c8d";

          const item = document.createElement("div");
          item.className = "timeline-item";
          item.innerHTML = `
            <div class="timeline-dot" style="background:${corBorda}"></div>
            <div class="timeline-content" style="border-left:4px solid ${corBorda}">
              <div class="timeline-top">
                <span class="timeline-event">${ev.evento}</span>
                <span class="timeline-date">${formatarData(ev.created_at || new Date())}</span>
              </div>
              <div class="timeline-extra">Origem: ${ev.origem || "central"}</div>
            </div>
          `;
          document.getElementById("modalEventos").prepend(item);
        }
      }
    } catch (err) {
      console.error("Erro WS:", err);
    }
  };

  ws.onclose = () => {
    statusEl.textContent = "🔴 Conexão perdida. Reconectando...";
    statusEl.style.cssText =
      "background:#f2dede;color:#a94442;border-left-color:#e74c3c";
    setTimeout(iniciarWebSocket, 3000);
  };
}

// ─── Modal de histórico ───────────────────────────────────────────────────────

// ─── Modal de histórico e Normalização ────────────────────────────────────────

async function abrirModal(dispositivo) {
  const token = getToken();

  const res = await fetch(`/api/dispositivos/${dispositivo.device_id}/eventos`, {
    headers: { Authorization: "Bearer " + token }
  });
  if (res.status === 401) { logout(); return; }

  const eventos = await res.json();

  document.getElementById("modalTitulo").innerText = `${dispositivo.nome} (${dispositivo.device_id})`;

  // Lógica para aparecer o Botão de Normalizar (Aparece em Alerta ou Falha)
  const statAtual = classificarStatus(ultimosEventos[dispositivo.device_id]?.evento, dispositivo);
  const btnNorm = document.getElementById("btn-normalizar");
  
  if (statAtual.label === "Em Alerta" || statAtual.label === "Falha") {
    btnNorm.style.display = "inline-block";
    btnNorm.onclick = () => normalizarDispositivo(dispositivo.device_id);
  } else {
    btnNorm.style.display = "none";
  }

  const body = document.getElementById("modalEventos");
  body.innerHTML = "";

  if (!eventos.length) {
    body.innerHTML = `<div style="text-align:center;color:#777;padding:20px;">Nenhum evento registrado.</div>`;
    document.getElementById("modalBg").style.display = "flex";
    return;
  }

  eventos.forEach(ev => {
    const s = classificarEvento(ev.evento);
    
    // CORREÇÃO DAS CORES (Offline agora é escuro intenso #374151)
    let corBorda = "#2ecc71"; // Verde
    if (s.borderClass === "status-alerta")  corBorda = "#e74c3c";
    if (s.borderClass === "status-falha")   corBorda = "#f1c40f";
    if (s.borderClass === "status-offline") corBorda = "#374151";

    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
      <div class="timeline-dot" style="background:${corBorda}"></div>
      <div class="timeline-content" style="border-left:4px solid ${corBorda}">
        <div class="timeline-top">
          <span class="timeline-event" style="color: ${corBorda === '#374151' ? '#111' : 'inherit'}">${ev.evento}</span>
          <span class="timeline-date">${formatarData(ev.created_at)}</span>
        </div>
        <div class="timeline-extra">Origem: <strong>${ev.origem || "-"}</strong></div>
      </div>
    `;
    body.appendChild(item);
  });

  document.getElementById("modalBg").style.display = "flex";
}

// ── NOVA FUNÇÃO DE RESETAR/NORMALIZAR MANUAL ──
async function normalizarDispositivo(deviceId) {
    if(!confirm("Atenção: Apenas confirme caso o sistema físico já tenha sido verificado. Deseja prosseguir e normalizar?")) return;
    
    const token = getToken();
    try {
        const res = await fetch(`/api/dispositivos/${deviceId}/normalizar`, {
            method: 'POST',
            headers: { Authorization: "Bearer " + token }
        });
        if(!res.ok) throw new Error("Falha ao normalizar");
        const novoEvento = await res.json();
        
        // Força a atualização local e atualiza o visual instantaneamente
        ultimosEventos[deviceId] = novoEvento;
        const disp = dispositivos.find(d => d.device_id === deviceId);
        
        renderizarCards();
        atualizarKPIs();
        abrirModal(disp); // Recarrega o modal para mostrar a linha verde atualizada

    } catch (error) {
        console.error(error);
        alert("Erro ao normalizar dispositivo.");
    }
}


// ─── Inicialização ────────────────────────────────────────────────────────────

async function iniciar() {
  try {
    aplicarPermissoes();
    await carregarDispositivos();
    await carregarEventosIniciais();

    popularFiltroCondominio(); // popula o select com os condomínios reais
    renderizarCards();
    atualizarKPIs();
    atualizarUltimaAtualizacao();
    iniciarWebSocket();

  } catch (err) {
    console.error("Erro fatal ao carregar dashboard:", err);
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = "❌ Falha ao processar os dados com o servidor.";
      statusEl.style.cssText =
        "background:#fef2f2;color:#991b1b;border-left-color:#ef4444";
    }
  }
}

iniciar();

window.logout = logout;
window.abrirModal = abrirModal;
window.fecharModal = function(event) {
  if (!event || event.target.id === "modalBg") {
    document.getElementById("modalBg").style.display = "none";
  }
};

