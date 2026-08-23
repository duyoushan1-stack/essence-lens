// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    name: 'project/ignores', // 忽略 build output 和測試覆蓋率檔案
    ignores: ['.output/**', 'coverage/**']
  },
  {
    name: 'project/rules',
    rules: {
      '@typescript-eslint/no-explicit-any': 'error', // 禁止使用 any
      'no-console': 'warn' // 先顯示警告，不直接阻擋開發
    }
  }
)
