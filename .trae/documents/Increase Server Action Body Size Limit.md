## Change
- Update `next.config.ts` to raise the Server Actions body size limit and optionally set allowed origins.

## Config
- `serverActions.bodySizeLimit: '25mb'`
- `serverActions.allowedOrigins: ['http://localhost:3003']`

## Effect
- Larger uploads in Server Actions no longer hit the 1MB cap.
- Requires dev server restart to take effect.