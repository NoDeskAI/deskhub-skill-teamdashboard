import express from 'express';
import cors from 'cors';
import deskhubProxy from './routes/proxy.js';
import umamiProxy from './routes/umami.js';
import workbenchRoutes from './routes/workbench.js';
import mcpProxy from './routes/mcp.js';

// 读 .env（简易方式，不引入 dotenv）
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env 不存在也没关系 */ }

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- 路由挂载 ---
app.use('/api/proxy/deskhub', deskhubProxy);
app.use('/api/proxy/umami', umamiProxy);
app.use('/api', workbenchRoutes);
app.use('/api/proxy/mcp', mcpProxy);

// --- 健康检查 ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`[server] DeskSkill API running on http://localhost:${PORT}`);
});
