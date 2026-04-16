async function login() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        // 👇 1. AQUI ESTAVA O ERRO: Mudei para /api/auth/login
        const res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.erro || 'Erro no login');
            return;
        }

        localStorage.setItem('token', data.token);
        alert('Login realizado com sucesso!');
        
        // 👇 2. AQUI TAMBÉM: Mudei de dashboard.html para /dashboard
        window.location.href = '/dashboard';
    } catch (err) {
        console.error(err);
        alert('Erro ao conectar com servidor');
    }
}
