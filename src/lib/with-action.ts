import { requireSession } from '@/lib/auth-guard'
import { parseFormData, parseFormDataWithArrays } from '@/lib/validation'
import type { z } from 'zod'

// ─── Result types ─────────────────────────────────────────────────────────────

type ActionOk<T> = T extends void ? { success: true } : { success: true; data: T }
type ActionFail = { success: false; error: string }
export type ActionResult<T = void> = ActionOk<T> | ActionFail

// ─── ActionError ──────────────────────────────────────────────────────────────

// Throw inside withAction/withFormAction fn to return a user-facing error message.
export class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionError'
  }
}

// ─── withQuery ────────────────────────────────────────────────────────────────

// For read functions: requireSession, errors propagate to error boundary.
export async function withQuery<T>(fn: () => Promise<T>): Promise<T> {
  await requireSession()
  return fn()
}

// ─── withAction ───────────────────────────────────────────────────────────────

// For mutations: requireSession + try/catch.
// T = void  → { success: true } | { success: false; error }
// T = Data  → { success: true; data: T } | { success: false; error }
export async function withAction<T = void>(
  errorMsg: string,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  await requireSession()
  try {
    const data = await fn()
    if (data === undefined) return { success: true } as ActionResult<T>
    return { success: true, data } as ActionResult<T>
  } catch (err) {
    if (err instanceof ActionError) return { success: false, error: err.message }
    console.error(errorMsg, err)
    return { success: false, error: errorMsg }
  }
}

// ─── withFormAction ───────────────────────────────────────────────────────────

// For FormData mutations: requireSession + parseFormData + try/catch.
// Pass arrayFields when the schema has array inputs (uses parseFormDataWithArrays).
export async function withFormAction<TSchema extends z.ZodType, T = void>(
  schema: TSchema,
  formData: FormData,
  errorMsg: string,
  fn: (data: z.infer<TSchema>) => Promise<T>,
  arrayFields?: string[],
): Promise<ActionResult<T>> {
  await requireSession()
  const parsed = arrayFields
    ? parseFormDataWithArrays(schema, formData, arrayFields)
    : parseFormData(schema, formData)
  if (!parsed.success) return { success: false, error: parsed.error }
  try {
    const result = await fn(parsed.data)
    if (result === undefined) return { success: true } as ActionResult<T>
    return { success: true, data: result } as ActionResult<T>
  } catch (err) {
    if (err instanceof ActionError) return { success: false, error: err.message }
    console.error(errorMsg, err)
    return { success: false, error: errorMsg }
  }
}
