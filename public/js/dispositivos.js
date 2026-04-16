checkAuth();

async function carregarDispositivos() {
  const res = await fetch('/api/dispositivos', {
    headers: authHeader()
  });

  if (res.status === 401) return logout();

  const data = await res.json();
  const lista = document.getElementById('lista');

  lista.innerHTML = "";

  data.forEach(d => {
    const item = document.createElement('div');
    item.className = "card";

    item.innerHTML = `
  <strong>${d.nome}</strong><br>
  Device ID: ${d.device_id}<br>
  Condomínio: ${d.condominio_nome || '-'}<br>

  <small>
    API Key: 
    <span id="key-${d.id}" data-key="${d.api_key}">
      **************
    </span>
  </small><br>

  <button onclick="toggleKey(${d.id})">👁️ Mostrar</button>
  <button onclick="copiar('${d.api_key}')">📋 Copiar</button>
  <button onclick="gerarNovaKey(${d.id})">🔄 Nova API Key</button>

  <div id="status-${d.id}" style="margin-top:8px;font-size:0.9rem;color:#999;">
    🔴 Offline
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