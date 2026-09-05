import type { NextFunction, Request, Response } from "express";

// Express doesn't catch rejected promises thrown inside async route handlers —
// an unhandled rejection there crashes the whole process instead of just
// failing the one request. Wrap every async handler with this.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
