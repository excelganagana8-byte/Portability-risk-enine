import type { Request,Response,NextFunction } from 'express';
import type { ZodSchema } from 'zod';
export function validateBody(schema:ZodSchema){
  return (req:Request,res:Response,next:NextFunction)=>{
    const parsed=schema.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:{code:'INVALID_REQUEST',message:'Request body is invalid.',details:parsed.error.flatten()}});return;}
    req.body=parsed.data;next();
  };
}
