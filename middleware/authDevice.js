const pool = require('../db');

module.exports = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ erro: "API Key não enviada" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM dispositivos WHERE api_key = $1",
      [apiKey]
    );

    if (!result.rows.length) {
      return res.status(403).json({ erro: "API Key inválida" });
    }

    req.dispositivo = result.rows[0]; // 🔥 importante
    next();

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro na autenticação do dispositivo");
  }
};