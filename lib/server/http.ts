import { z } from 'zod'

export async function boundedJSON(message: Request | Response, limit: number) {
  if (Number(message.headers.get('content-length')) > limit) throw new Error('Payload too large')
  const reader = message.body?.getReader()
  if (!reader) throw new Error('A JSON body is required')
  const decoder = new TextDecoder()
  let size = 0, text = ''
  while (true) {
    const {value, done} = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new Error('Payload too large')
    }
    text += decoder.decode(value, {stream:true})
  }
  return JSON.parse(text + decoder.decode()) as unknown
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {'X-API-Version':'1','Cache-Control':'no-store'}})
}

export async function input<T>(request: Request, schema: z.ZodType<T>) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Send application/json')
  return schema.parse(await boundedJSON(request, 2048))
}
