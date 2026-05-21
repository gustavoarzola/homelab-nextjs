import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl } from '@/lib/r2'
import { requireSession } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  await requireSession()

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return new NextResponse('Missing key', { status: 400 })

  const url = await getSignedUrl(key)
  return NextResponse.redirect(url)
}
