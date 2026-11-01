import { Router } from 'express';
import { ScanRequestSchema } from '../../scan/types.js';
import { validateBody } from '../middleware/validate.js';
import { runScan } from '../../scan/orchestrator.js';

export const scanRouter=Router();
scanRouter.post('/',validateBody(ScanRequestSchema),async(req,res,next)=>{
  try{const result=await runScan(req.body.url as string);res.status(result.status==='failed'?502:200).json(result);}
  catch(error){next(error);}
});
