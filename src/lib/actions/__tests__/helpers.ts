export const P = `_t${Math.random().toString(36).slice(2, 7)}_`

export function fd(data: Record<string, string | number>): FormData {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => form.append(k, String(v)))
  return form
}
