import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
    schema: 'prisma/schema',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: env('DATABASE_URL'),
    },
    generator: {
        client: {
            provider: 'prisma-client-js',
            previewFeatures: ['partialIndexes'],
        },
    },
})
