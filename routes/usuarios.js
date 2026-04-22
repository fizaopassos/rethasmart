const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

const autenticar = require('../middleware/authUser');

// 🔒 só admin
function somenteAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

/* ============================
   LISTAR USUÁRIOS
============================ */
router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nome, email, role
      FROM usuarios
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar usuários");
  }
});



/* ============================
   CRIAR USUÁRIO
============================ */
router.post('/', autenticar, somenteAdmin, async (req, res) => {
  const { nome, email, senha, role, condominios } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!email || !senha) {
      throw new Error('Email e senha obrigatórios');
    }

    const existe = await client.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existe.rows.length > 0) {
      throw new Error('Email já cadastrado');
    }

    const hash = await bcrypt.hash(senha, 10);

    const result = await client.query(`
      INSERT INTO usuarios (nome, email, senha, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nome, email, role
    `, [nome || null, email, hash, role || 'operador']);

    const usuario = result.rows[0];

    // vincular condomínios
    if (condominios && condominios.length > 0) {
      for (const condId of condominios) {
        await client.query(`
          INSERT INTO usuarios_condominios (usuario_id, condominio_id)
          VALUES ($1, $2)
        `, [usuario.id, condId]);
      }
    }

    await client.query('COMMIT');

    res.json({ sucesso: true, usuario });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ erro: err.message });
  } finally {
    client.release();
  }
});

/* ============================
   LISTAR CONDOMÍNIOS (pra select)
============================ */
router.get('/condominios', autenticar, somenteAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nome FROM condominios ORDER BY nome
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar condomínios");
  }
});

module.exports = router;
