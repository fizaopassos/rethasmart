module.exports = function iniciarMonitoramento(app, pool) {

  setInterval(async () => {
    try {
      const result = await pool.query(`
        SELECT * FROM dispositivos
        WHERE last_seen IS NOT NULL
      `);

      const agora = new Date();

      for (const disp of result.rows) {

        const diff = (agora - new Date(disp.last_seen)) / 1000;

        if (diff > 30 && disp.status !== 'offline') {

          console.log(`🔴 Dispositivo OFFLINE: ${disp.device_id}`);

          await pool.query(`
            UPDATE dispositivos
            SET status = 'offline'
            WHERE id = $1
          `, [disp.id]);

          await pool.query(`
            INSERT INTO eventos (device_id, condominio_id, evento, origem)
            VALUES ($1, $2, $3, $4)
          `, [
            disp.device_id,
            disp.condominio_id,
            'DISPOSITIVO OFFLINE',
            'sistema'
          ]);

          const payload = JSON.stringify({
            tipo: 'novo_evento',
            evento: {
              device_id: disp.device_id,
              evento: 'DISPOSITIVO OFFLINE',
              origem: 'sistema',
              created_at: new Date()
            }
          });

          const clientes = app.locals.clientes;

          clientes.forEach(cliente => {
            if (cliente.readyState === 1) {
              cliente.send(payload);
            }
          });
        }
      }

    } catch (err) {
      console.error("Erro verificador:", err);
    }

  }, 10000);

};