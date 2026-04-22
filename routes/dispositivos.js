const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');
const autenticar = require('../middleware/authUser');

// ─── LISTAR DISPOSITIVOS ─────────────────────────────
router.get('/', autenticar, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;

    let result;

    // 🔥 Aqui está a mágica: Admin vê tudo
    if (role === 'admin') {
      result = await pool.query(`
        SELECT d.*, c.nome AS condominio_nome
        FROM dispositivos d
        LEFT JOIN condominios c ON c.id = d.condominio_id
        ORDER BY d.id DESC
      `);
    } else {
      result = await pool.query(`
        SELECT d.*, c.nome AS condominio_nome
        FROM dispositivos d
        LEFT JOIN condominios c ON c.id = d.condominio_id
        JOIN usuarios_condominios uc ON uc.condominio_id = d.condominio_id
        WHERE uc.usuario_id = $1
        ORDER BY d.id DESC
      `, [userId]);
    }

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao listar dispositivos" });
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
    `, [nome, device_id, condominio_id || null, apiKey]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar dispositivo" });
  }
});

// ─── HISTÓRICO DO DISPOSITIVO ─────────────────────────────
router.get('/:deviceId/eventos', autenticar, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;
    const deviceId = req.params.deviceId;

    let result;

    if (role === 'admin') {
      result = await pool.query(`
        SELECT *
        FROM eventos
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [deviceId]);
    } else {
      result = await pool.query(`
        SELECT e.*
        FROM eventos e
        JOIN usuarios_condominios uc ON uc.condominio_id = e.condominio_id
        WHERE uc.usuario_id = $1
          AND e.device_id = $2
        ORDER BY e.created_at DESC
        LIMIT 50
      `, [userId, deviceId]);
    }

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao listar eventos do dispositivo" });
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
    res.status(500).json({ erro: "Erro ao gerar nova API key" });
  }
});

// ROTA PARA NORMALIZAR DISPOSITIVO MANUALMENTE (AUDITORIA)
router.post('/:deviceId/normalizar', autenticar, async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    
    // Pega os dados do usuário a partir do token (Auth)
    const userName = req.user.nome || req.user.email || 'Operador Local';

    // 1. Pega o condomínio do dispositivo para manter o banco consistente
    const devResult = await pool.query('SELECT condominio_id FROM dispositivos WHERE device_id = $1', [deviceId]);
    if (!devResult.rows.length) {
      return res.status(404).json({ erro: "Dispositivo não encontrado" });
    }
    const condId = devResult.rows[0].condominio_id;

    // 2. Monta o evento manual
    const eventoTexto = "Sistema Normalizado Manualmente";
    const origemTexto = `Usuário: ${userName}`;

    // 3. Insere na tabela de eventos
    const insert = await pool.query(`
      INSERT INTO eventos (device_id, condominio_id, evento, origem)
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [deviceId, condId, eventoTexto, origemTexto]);

    res.json(insert.rows[0]);
  } catch (err) {
    console.error("Erro ao normalizar", err);
    res.status(500).json({ erro: "Erro interno ao tentar normalizar" });
  }
});


module.exports = router;
