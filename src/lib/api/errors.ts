import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function toErrorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId
        }
      },
      { status: error.status }
    )
  }

  // Unknown error - don't leak details
  console.error('Unexpected error:', error)
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId
      }
    },
    { status: 500 }
  )
}
