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

    if (!email || !senha) throw new Error('Email e senha obrigatórios');

    const existe = await client.query(
      'SELECT id FROM usuarios WHERE email = $1', [email]
    );
    if (existe.rows.length > 0) throw new Error('Email já cadastrado');

    const hash = await bcrypt.hash(senha, 10);

    const result = await client.query(`
      INSERT INTO usuarios (nome, email, senha, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nome, email, role
    `, [nome || null, email, hash, role || 'operador']);

    const usuario = result.rows[0];

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
   LISTAR CONDOMÍNIOS (para selects)
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

/* ============================
   BUSCAR USUÁRIO POR ID
============================ */
router.get('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      'SELECT id, nome, email, role FROM usuarios WHERE id = $1', [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const condoResult = await pool.query(
      'SELECT condominio_id FROM usuarios_condominios WHERE usuario_id = $1', [id]
    );

    const usuario = userResult.rows[0];
    usuario.condominios = condoResult.rows.map(r => r.condominio_id);

    res.json(usuario);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar usuário");
  }
});

/* ============================
   ATUALIZAR USUÁRIO
============================ */
router.put('/:id', autenticar, somenteAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha, role, condominios } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!email) throw new Error('E-mail obrigatório');

    const emailExiste = await client.query(
      'SELECT id FROM usuarios WHERE email = $1 AND id != $2', [email, id]
    );
    if (emailExiste.rows.length > 0) throw new Error('E-mail já está em uso');

    if (senha && senha.trim() !== '') {
      const hash = await bcrypt.hash(senha, 10);
      await client.query(
        `UPDATE usuarios SET nome=$1, email=$2, role=$3, senha=$4 WHERE id=$5`,
        [nome || null, email, role, hash, id]
      );
    } else {
      await client.query(
        `UPDATE usuarios SET nome=$1, email=$2, role=$3 WHERE id=$4`,
        [nome || null, email, role, id]
      );
    }

    await client.query(
      'DELETE FROM usuarios_condominios WHERE usuario_id = $1', [id]
    );

    if (condominios && condominios.length > 0) {
      for (const condId of condominios) {
        await client.query(
          `INSERT INTO usuarios_condominios (usuario_id, condominio_id) VALUES ($1, $2)`,
          [id, condId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ sucesso: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ erro: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
