const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');

const autenticar = require('../middleware/authUser');


// ─── LISTAR DISPOSITIVOS ─────────────────────────────
router.get('/', autenticar, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(`
      SELECT d.*, c.nome AS condominio_nome
      FROM dispositivos d
      LEFT JOIN condominios c ON c.id = d.condominio_id
      LEFT JOIN usuarios_condominios uc ON uc.condominio_id = d.condominio_id
      WHERE uc.usuario_id = $1
      ORDER BY d.id DESC
    `, [userId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar dispositivos");
  }
});


// ─── CRIAR DISPOSITIVO ─────────────────────────────
router.post('/', autenticar, async (req, res) => {
  const { nome, device_id, condominio_id } = req.body;

  if (!device_id) {
    return res.status(400).json({ erro: 'device_id obrigatório' });
  }

  try {
    const apiKey = crypto.randomBytes(16).toString('hex');

    const result = await pool.query(`
      INSERT INTO dispositivos (nome, device_id, condominio_id, api_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [nome, device_id, condominio_id, apiKey]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao criar dispositivo");
  }
});


// ─── HISTÓRICO DO DISPOSITIVO ─────────────────────────────
router.get('/:deviceId/eventos', autenticar, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const deviceId = req.params.deviceId;

    const result = await pool.query(`
      SELECT e.*
      FROM eventos e
      JOIN usuarios_condominios uc ON uc.condominio_id = e.condominio_id
      WHERE uc.usuario_id = $1
        AND e.device_id = $2
      ORDER BY e.created_at DESC
      LIMIT 50
    `, [userId, deviceId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar eventos do dispositivo");
  }
});


// ─── REGERAR API KEY ─────────────────────────────
router.put('/:id/regen-key', autenticar, async (req, res) => {
  try {
    const novaKey = crypto.randomBytes(16).toString('hex');

    const result = await pool.query(`
      UPDATE dispositivos
      SET api_key = $1
      WHERE id = $2
      RETURNING *
    `, [novaKey, req.params.id]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerar nova API key");
  }
});

module.exports = router;