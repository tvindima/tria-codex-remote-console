# Deployment

## PWA (Vercel)

```bash
cd apps/mobile-pwa
vercel
vercel --prod
```

## Local dev

```bash
pnpm install
pnpm --filter mobile-pwa dev
```

## Build

```bash
pnpm --filter mobile-pwa build
```

## iPhone validation

1. Open public URL in Safari.
2. Add to Home Screen.
3. Launch PWA and validate all routes/states.
