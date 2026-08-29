import { createServer } from './app.js';

const PORT = Number(process.env.PORT ?? 8080);
createServer().listen(PORT, () => {
  console.log(`멍냥아레나 서버: http://localhost:${PORT}`);
});
