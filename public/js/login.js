async function login() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    // 🔥 Detecta ambiente automaticamente
    const API_URL = location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : '';

    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
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

        window.location.href = '/dashboard';

    } catch (err) {
        console.error(err);
        alert('Erro ao conectar com servidor');
    }
}