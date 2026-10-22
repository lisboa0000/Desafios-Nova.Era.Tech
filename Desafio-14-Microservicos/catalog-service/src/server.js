const { createApp } = require('./app');
const { log } = require('./logger');

const port = Number(process.env.PORT || 3002);
createApp().listen(port, () => log('info', 'servico iniciado', { port }));
