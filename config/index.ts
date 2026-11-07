import path from 'node:path'
import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'jisu-jianli',
  date: '2026-10-26',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  alias: {
    '@': path.resolve(__dirname, '..', 'src')
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: 'vite',
  cache: {
    enable: false
  },
  mini: {},
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: {
      mode: 'hash'
    },
    postcss: {
      autoprefixer: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  }
})
