const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const autenticar = require('../middleware/authUser');


/*router.post('/register', async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const hash = await bcrypt.hash(senha, 10);

        const result = await pool.query(
            `INSERT INTO usuarios (nome, email, senha)
             VALUES ($1, $2, $3)
             RETURNING id, nome, email`,
            [nome || null, email, hash]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no cadastro' });
    }
});*/


router.post('/criar-usuario', autenticar, async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    // 🔒 validação básica
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // 🔍 verifica se já existe
    const existe = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existe.rows.length > 0) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    // 🔐 hash da senha
    const hash = await bcrypt.hash(senha, 10);

    const result = await pool.query(`
      INSERT INTO usuarios (nome, email, senha)
      VALUES ($1, $2, $3)
      RETURNING id, nome, email
    `, [nome || null, email, hash]);

    res.json({
      sucesso: true,
      usuario: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});


router.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: 'Usuário não encontrado' });
        }

        const user = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, user.senha);

        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha inválida' });
        }

        const token = jwt.sign(
            {
                user_id: user.id,
                email: user.email,
                role: user.role || 'admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
            );

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no login' });
    }
});

module.exports = router;
