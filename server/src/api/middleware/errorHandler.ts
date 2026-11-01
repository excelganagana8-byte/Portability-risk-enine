import type { Request, Response, NextFunction } from 'express';
export function errorHandler(error:unknown,_req:Request,res:Response,_next:NextFunction){
  const message=error instanceof Error?error.message:'Unexpected server error';
  res.status(500).json({error:{code:'INTERNAL_ERROR',message}});
}
