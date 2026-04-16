const express = require('express');
const router = express.Router();
const pool = require('../db');
const autenticar = require('../middleware/autenticar');

router.get('/', autenticar, async (req, res) => {
    try {
        const userId = req.user.user_id;

        const result = await pool.query(`
            SELECT c.*
            FROM condominios c
            JOIN usuarios_condominios uc ON uc.condominio_id = c.id
            WHERE uc.usuario_id = $1
            ORDER BY c.nome ASC
        `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao listar condomínios");
    }
});

router.post('/', autenticar, async (req, res) => {
    try {
        const { nome } = req.body;
        const userId = req.user.user_id;

        if (!nome) {
            return res.status(400).json({ erro: "Nome do condomínio é obrigatório" });
        }

        const cond = await pool.query(
            `INSERT INTO condominios (nome)
             VALUES ($1)
             RETURNING *`,
            [nome]
        );

        await pool.query(
            `INSERT INTO usuarios_condominios (usuario_id, condominio_id)
             VALUES ($1, $2)`,
            [userId, cond.rows[0].id]
        );

        res.json(cond.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao criar condomínio");
    }
});

module.exports = router;
