import { json } from '../../../lib/server/http'

// Guest discoveries belong to the active browser profile.
export function GET() { return json({storage:'browser-local', discoveries:[]}) }
