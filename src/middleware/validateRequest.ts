import { NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodType } from 'zod'
import { HttpError } from '../utils/HttpError.js'

const validationDetails = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  issues.map((issue) => ({
    field: issue.path.map(String).join('.') || 'request',
    message: issue.message,
  }))

const validate = (
  schema: ZodType,
  source: 'body' | 'query',
  target: 'validatedBody' | 'validatedQuery',
): RequestHandler =>
  (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request[source])
    if (!result.success) {
      next(new HttpError(400, 'Request validation failed', validationDetails(result.error.issues)))
      return
    }

    request[target] = result.data
    next()
  }

export const validateBody = (schema: ZodType) => validate(schema, 'body', 'validatedBody')
export const validateQuery = (schema: ZodType) => validate(schema, 'query', 'validatedQuery')
