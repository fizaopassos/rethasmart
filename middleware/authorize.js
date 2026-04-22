function authorize(rolesPermitidos = []) {
  return (req, res, next) => {
    const user = req.user;

    if (!user || !rolesPermitidos.includes(user.role)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    next();
  };
}

module.exports = authorize;
