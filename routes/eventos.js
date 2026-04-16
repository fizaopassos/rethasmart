const express = require('express');
const router = express.Router();
const pool = require('../db');
const autenticar = require('../middleware/autenticar');

// GET /api/eventos — histórico de eventos do usuário
router.get('/', autenticar, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(`
      SELECT e.*
      FROM eventos e
      JOIN usuarios_condominios uc ON uc.condominio_id = e.condominio_id
      WHERE uc.usuario_id = $1
      ORDER BY e.created_at DESC
      LIMIT 100
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar eventos");
  }
});

// POST /api/eventos/alerta — recebe evento e faz broadcast via WebSocket

const autenticarDispositivo = require('../middleware/autenticarDispositivo');

router.post('/alerta', autenticarDispositivo, async (req, res) => {
  const { evento, origem } = req.body;
  const device_id = req.dispositivo.device_id;

if (evento === 'heartbeat') {

  // pega status atual antes de atualizar
  const atual = await pool.query(`
    SELECT status, condominio_id FROM dispositivos
    WHERE device_id = $1
  `, [device_id]);

  const statusAnterior = atual.rows[0]?.status;

  // atualiza
  await pool.query(`
    UPDATE dispositivos
    SET last_seen = NOW(),
        status = 'online'
    WHERE device_id = $1
  `, [device_id]);

  // 🟢 SE ESTAVA OFFLINE → VOLTOU
  if (statusAnterior === 'offline') {

    console.log(`🟢 Dispositivo ONLINE: ${device_id}`);

    // salva evento
    await pool.query(`
      INSERT INTO eventos (device_id, condominio_id, evento, origem)
      VALUES ($1, $2, $3, $4)
    `, [
      device_id,
      atual.rows[0].condominio_id,
      'DISPOSITIVO ONLINE',
      'sistema'
    ]);

    // 🔥 envia websocket
    const payload = JSON.stringify({
      tipo: 'novo_evento',
      evento: {
        device_id,
        evento: 'DISPOSITIVO ONLINE',
        origem: 'sistema',
        created_at: new Date()
      }
    });

    const clientes = req.app.locals.clientes;

    clientes.forEach(cliente => {
      if (cliente.readyState === 1) {
        cliente.send(payload);
      }
    });
  }

  return res.json({ status: 'heartbeat ok' });
}

  if (!evento || !device_id) {
    return res.status(400).json({ erro: 'evento e device_id são obrigatórios' });
  }

  try {
  const device = await pool.query(`
    SELECT d.*, c.nome AS condominio_nome
    FROM dispositivos d
    LEFT JOIN condominios c ON c.id = d.condominio_id
    WHERE d.device_id = $1
  `, [device_id]);

  let condominio_id   = null;
  let nome_dispositivo = device_id;
  let nome_condominio  = null;

  if (device.rows.length > 0) {
    condominio_id    = device.rows[0].condominio_id;
    nome_dispositivo = device.rows[0].nome || device_id;
    nome_condominio  = device.rows[0].condominio_nome || null;
  }

  // 🔥 AQUI — atualiza presença
  await pool.query(`
    UPDATE dispositivos
    SET last_seen = NOW()
    WHERE device_id = $1
  `, [device_id]);

  // 🔥 continua normal
  const result = await pool.query(`
    INSERT INTO eventos (device_id, condominio_id, evento, origem)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [device_id, condominio_id, evento, origem || 'central']);

    const eventoSalvo = {
      ...result.rows[0],
      nome_dispositivo,
      nome_condominio
    };

    // ✅ Broadcast WebSocket
    const payload = JSON.stringify({ tipo: 'novo_evento', evento: eventoSalvo });
    const clientes = req.app.locals.clientes;

    clientes.forEach(cliente => {
      if (cliente.readyState === 1) {
        cliente.send(payload);
      }
    });

    console.log(`🚨 Evento: ${evento} | Device: ${device_id} | Cond: ${condominio_id} | Clientes: ${clientes.size}`);

    res.json({ status: "ok", evento: eventoSalvo });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao salvar evento");
  }
});

module.exports = router;
