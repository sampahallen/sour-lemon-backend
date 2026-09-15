import { ErrorRequestHandler, RequestHandler } from 'express'
import multer from 'multer'
import { UniqueConstraintError, ValidationError } from 'sequelize'
import { HttpError } from '../utils/HttpError.js'

export const notFound: RequestHandler = (request, response) => {
  response.status(404).json({ error: `Route not found: ${request.method} ${request.path}` })
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  void next
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message, details: error.details })
    return
  }

  if (error instanceof UniqueConstraintError) {
    response.status(409).json({ error: 'A record with that value already exists' })
    return
  }

  if (error instanceof ValidationError) {
    response.status(400).json({
      error: 'Data validation failed',
      details: error.errors.map((item) => ({ field: item.path, message: item.message })),
    })
    return
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : error.message })
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  console.error('Unhandled request error', error)
  response.status(500).json({ error: 'Internal server error' })
}
