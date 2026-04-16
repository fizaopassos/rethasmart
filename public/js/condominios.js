checkAuth();

async function carregarCondominios() {
  try {
    const res = await fetch('/api/condominios', {
      headers: authHeader()
    });

    if (res.status === 401) return logout();

    if (!res.ok) {
      console.error("Erro na API:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    console.log("Dados recebidos da API:", data); // Veja no F12 o que chegou

    const lista = document.getElementById('lista');
    
    // Verifica se o elemento HTML existe
    if (!lista) {
      console.error("Erro: O elemento com id='lista' não foi encontrado no HTML!");
      return;
    }

    lista.innerHTML = "";

    // Verifica se os dados recebidos são realmente um array
    let condominiosArray = [];
    if (Array.isArray(data)) {
        condominiosArray = data;
    } else if (data && data.condominios && Array.isArray(data.condominios)) {
        // Se a API retornar dentro de uma chave, ex: { condominios: [...] }
        condominiosArray = data.condominios;
    } else {
        console.error("Os dados recebidos não são um Array reconhecido:", data);
        return;
    }

    // Desenha os elementos na tela
    condominiosArray.forEach(c => {
      const item = document.createElement('div');
      item.className = "card";
      item.innerText = c.nome || "Condomínio sem nome"; // Evita ficar em branco se a chave nome não existir
      lista.appendChild(item);
    });

  } catch (error) {
    console.error("Erro fatal ao tentar carregar os condomínios:", error);
  }
}

async function criarCondominio() {
  const nomeInput = document.getElementById('nome');
  if (!nomeInput) return console.error("Elemento id='nome' não encontrado!");
  
  const nome = nomeInput.value;

  try {
    await fetch('/api/condominios', {
      method: 'POST',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nome })
    });
    
    nomeInput.value = ""; // Limpa o input após criar
    carregarCondominios();
  } catch (error) {
    console.error("Erro ao criar condomínio:", error);
  }
}

// Substitua a chamada solta no final do arquivo por esta:
// Isso garante que o JS só vai procurar o id="lista" DEPOIS que o HTML carregar
document.addEventListener('DOMContentLoaded', carregarCondominios);
