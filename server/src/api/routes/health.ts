import { Router } from 'express';
export const healthRouter=Router();
const started=Date.now();
healthRouter.get('/',(_req,res)=>res.json({status:'ok',version:'0.1.3',uptimeSeconds:Math.floor((Date.now()-started)/1000)}));
