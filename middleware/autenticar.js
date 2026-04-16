const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send("Token não enviado");
    }

    const partes = authHeader.split(' ');
    const token = partes[1];

    if (!token) {
        return res.status(401).send("Token inválido");
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send("Token inválido");
    }
}

module.exports = autenticar;
