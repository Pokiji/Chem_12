import next from 'eslint-config-next/core-web-vitals'
import {defineConfig,globalIgnores} from 'eslint/config'
export default defineConfig([...next,globalIgnores(['.next/**','.npm-cache/**','next-env.d.ts'])])

