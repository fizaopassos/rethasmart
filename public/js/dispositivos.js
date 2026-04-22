checkAuth();

async function carregarDispositivos() {
  const res = await fetch('/api/dispositivos', {
    headers: authHeader()
  });

  if (res.status === 401) return logout();

  const data = await res.json();
  const lista = document.getElementById('lista');

  lista.innerHTML = "";

  if(data.length === 0) {
    lista.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:20px;">Nenhum dispositivo encontrado.</div>`;
    return;
  }

  data.forEach(d => {
    const item = document.createElement('div');
    // Usando o estilo idêntico ao do Dashboard
    item.className = "device-card status-offline"; 

    item.innerHTML = `
      <div class="device-top">
        <div class="device-name">${d.nome}</div>
        <div class="badge badge-offline" style="background:var(--surface-2); border:1px solid var(--border); color:var(--text);">ID: ${d.device_id}</div>
      </div>
      
      <div class="device-info" style="margin-bottom: 12px;">
        📍 ${d.condominio_nome || 'Sem condomínio vinculado'}
      </div>

      <div style="background: var(--bg); padding: 12px; border-radius: 10px; border: 1px solid var(--border);">
        <small style="display:block; color:var(--muted); font-weight:600; font-size: 0.75rem; margin-bottom:6px;">API KEY:</small>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <code id="key-${d.id}" data-key="${d.api_key}" style="font-family:monospace; font-size:0.9rem; color:#1f5ad1;">**************</code>
          <button class="btn-secondary btn-small" onclick="toggleKey(${d.id})" title="Mostrar/Ocultar">👁️</button>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn-secondary btn-small" style="flex:1;" onclick="copiar('${d.api_key}')">📋 Copiar API</button>
        <button class="btn-primary btn-small" style="flex:1; background:var(--warning); border:none;" onclick="gerarNovaKey(${d.id})">🔄 Gerar Nova</button>
      </div>
    `;

    lista.appendChild(item);
  });
}


async function criarDispositivo() {
  const nome = document.getElementById('nome').value;
  const device_id = document.getElementById('device_id').value;
  const condominio_id = document.getElementById('condominio_id').value;

  // 🔒 validação simples (UX)
  if (!nome || !device_id) {
    alert("Preencha nome e device_id");
    return;
  }

  const res = await fetch('/api/dispositivos', {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nome, device_id, condominio_id })
  });

  // 🚨 TRATAMENTO DE ERRO
  if (!res.ok) {
    const erro = await res.text();
    alert("Erro ao criar dispositivo:\n" + erro);
    return;
  }

  const novo = await res.json();

  // 🎉 FEEDBACK PRO USUÁRIO
  alert(`Dispositivo criado com sucesso!\n\nAPI KEY:\n${novo.api_key}`);

  // 🧼 LIMPAR CAMPOS (UX melhor)
  document.getElementById('nome').value = "";
  document.getElementById('device_id').value = "";
  document.getElementById('condominio_id').value = "";

  // 🔄 recarrega lista
  carregarDispositivos();
}

function copiar(texto) {
  navigator.clipboard.writeText(texto);
  alert("API Key copiada!");
}

function toggleKey(id) {
  const el = document.getElementById(`key-${id}`);
  const atual = el.innerText;

  if (atual.includes('*')) {
    el.innerText = el.dataset.key;
  } else {
    el.innerText = '**************';
  }
}

async function gerarNovaKey(id) {
  const confirmar = confirm("Gerar nova API Key? A antiga vai parar de funcionar.");

  if (!confirmar) return;

  const res = await fetch(`/api/dispositivos/${id}/regen-key`, {
    method: 'PUT',
    headers: authHeader()
  });

  if (!res.ok) {
    alert("Erro ao gerar nova API key");
    return;
  }

  const novo = await res.json();

  alert("Nova API Key:\n\n" + novo.api_key);

  carregarDispositivos();
}

async function carregarCondominios() {
  const res = await fetch('/api/condominios', {
    headers: authHeader()
  });

  if (res.status === 401) return logout();

  const data = await res.json();
  const select = document.getElementById('condominio_id');

  select.innerHTML = '<option value="">Selecione um condomínio</option>';

  data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.nome;
    select.appendChild(opt);
  });
}

// 🚀 inicializa
carregarDispositivos();
carregarCondominios();