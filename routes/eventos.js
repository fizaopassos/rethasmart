const express = require('express');
const router = express.Router();
const pool = require('../db');

const autenticar = require('../middleware/authUser');
const autenticarDispositivo = require('../middleware/authDevice');

// ─── GET EVENTOS (usuário) ─────────────────────────────
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


// ─── POST ALERTA (ESP32) ─────────────────────────────
router.post('/alerta', autenticarDispositivo, async (req, res) => {

  const { evento, origem } = req.body;
  const device_id = req.dispositivo?.device_id;

  if (!evento || !device_id) {
    return res.status(400).json({ erro: 'evento e device_id são obrigatórios' });
  }

  try {

    // 🔍 busca dados do dispositivo
    const device = await pool.query(`
      SELECT d.*, c.nome AS condominio_nome
      FROM dispositivos d
      LEFT JOIN condominios c ON c.id = d.condominio_id
      WHERE d.device_id = $1
    `, [device_id]);

    const disp = device.rows[0];

    let condominio_id   = disp?.condominio_id || null;
    let nome_dispositivo = disp?.nome || device_id;
    let nome_condominio  = disp?.condominio_nome || null;

    // ─── HEARTBEAT ─────────────────────────────
    if (evento === 'heartbeat') {

      const statusAnterior = disp?.status;

      await pool.query(`
        UPDATE dispositivos
        SET last_seen = NOW(),
            status = 'online'
        WHERE device_id = $1
      `, [device_id]);

      // 🟢 voltou online
      if (statusAnterior === 'offline') {

        const eventoOnline = {
          device_id,
          evento: 'DISPOSITIVO ONLINE',
          origem: 'sistema',
          created_at: new Date()
        };

        await pool.query(`
          INSERT INTO eventos (device_id, condominio_id, evento, origem)
          VALUES ($1, $2, $3, $4)
        `, [
          device_id,
          condominio_id,
          'DISPOSITIVO ONLINE',
          'sistema'
        ]);

        broadcast(req, eventoOnline);
        console.log(`🟢 ONLINE: ${device_id}`);
      }

      return res.json({ status: 'heartbeat ok' });
    }

    // ─── EVENTO NORMAL ─────────────────────────────

    // atualiza presença
    await pool.query(`
      UPDATE dispositivos
      SET last_seen = NOW(),
          status = 'online'
      WHERE device_id = $1
    `, [device_id]);

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

    broadcast(req, eventoSalvo);

    console.log(`🚨 ${evento} | ${device_id}`);

    res.json({ status: "ok", evento: eventoSalvo });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao salvar evento");
  }
});


// ─── FUNÇÃO WEBSOCKET ─────────────────────────────
function broadcast(req, evento) {
  const payload = JSON.stringify({
    tipo: 'novo_evento',
    evento
  });

  const clientes = req.app.locals.clientes;

  clientes.forEach(cliente => {
    if (cliente.readyState === 1) {
      cliente.send(payload);
    }
  });
}

module.exports = router;