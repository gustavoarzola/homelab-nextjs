import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Regla nueva de react-hooks v7: marca setState dentro de efectos en
      // componentes que funcionan (sincronizacion de estado con props). Se deja
      // como aviso para no reescribir componentes; revisar cuando se toquen.
      'react-hooks/set-state-in-effect': 'warn',
      // `any` es deuda tecnica conocida (p.ej. PricingDb); visible como aviso.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Los tests usan mocks de DB con `@ts-nocheck` y `any`.
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'src/db/migrations/**',
    'playwright-report/**',
    'test-results/**',
    'coverage/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])
