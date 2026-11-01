import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { scanRouter } from './api/routes/scan.js';
import { healthRouter } from './api/routes/health.js';
import { errorHandler } from './api/middleware/errorHandler.js';

export function createApp(){
  const app=express();
  app.disable('x-powered-by');
  app.use(cors({origin:true}));
  app.use(express.json({limit:'4kb'}));
  app.use('/api/scan',rateLimit({windowMs:60*60*1000,limit:env.PRE_RATE_LIMIT_PER_HOUR,standardHeaders:true,legacyHeaders:false}));
  app.use('/api/scan',scanRouter);
  app.use('/api/health',healthRouter);
  app.use((_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found.'}}));
  app.use(errorHandler);
  return app;
}
