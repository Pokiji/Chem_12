import { substances } from '../../../lib/chem'
import { json } from '../../../lib/server/http'
export function GET() { return json({substances}) }
