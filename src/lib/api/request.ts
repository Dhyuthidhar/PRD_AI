import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from './errors'

export function createRequestId(): string {
  return randomUUID()
}

export async function parseJson(request: NextRequest): Promise<any> {
  try {
    return await request.json()
  } catch (error) {
    throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON in request body')
  }
}

export function readQueryParam(request: NextRequest, key: string): string | null {
  const { searchParams } = new URL(request.url)
  return searchParams.get(key)
}

export function addRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId)
  return response
}
