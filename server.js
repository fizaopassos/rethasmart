  require('dotenv').config();
  const express = require('express');
  const path = require('path');
  const cors = require('cors');
  const http = require('http');
  const { WebSocketServer } = require('ws');
  const pool = require('./db');
  

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const iniciarMonitoramento = require('./services/monitoramento');

  // ✅ Set de clientes WebSocket conectados
  const clientes = new Set();
  app.locals.clientes = clientes;

  wss.on('connection', (ws) => {
    clientes.add(ws);
    console.log('🟢 WebSocket conectado. Total:', clientes.size);

    ws.on('close', () => {
      clientes.delete(ws);
      console.log('🔴 WebSocket desconectado. Total:', clientes.size);
    });

    ws.on('error', (err) => {
      console.error('Erro WebSocket:', err.message);
      clientes.delete(ws);
    });
  });

  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Rotas API
  app.use('/api/auth',        require('./routes/auth'));
  app.use('/api/condominios', require('./routes/condominios'));
  app.use('/api/dispositivos',require('./routes/dispositivos'));
  app.use('/api/eventos',     require('./routes/eventos'));

  // Rotas de páginas
app.get('/login',       (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/dashboard',   (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/condominios', (req, res) => res.sendFile(path.join(__dirname, 'views', 'condominios.html')));
app.get('/dispositivos',(req, res) => res.sendFile(path.join(__dirname, 'views', 'dispositivos.html')));
app.use('/api/usuarios', require('./routes/usuarios'));


// 👇 ADICIONA AQUI
app.get('/usuarios', (req, res) => res.sendFile(path.join(__dirname, 'views', 'usuarios.html')));


app.get('/', (req, res) => res.redirect('/login'));

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    iniciarMonitoramento(app, pool);
  console.log(`Servidor rodando em http://localhost:${PORT}`);

});
