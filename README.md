# 极速简历 · 可运行 H5 工程

由 QMuse 作品「极速简历」的前端快照还原重建，可直接在浏览器中运行。

- 原作品：https://www.qmuse.cn/miniapp/6262728972510091
- appId：6262728972510091（版本 V10）
- 快照与修复日期：2026-10-26
- 技术栈：Taro 4.3.1 + React 18 + TypeScript + Less，H5 构建（Vite）

## 快速开始

需要 Node.js 18+（实测 v24.16.0）。

### 预览生产构建

```bash
npm install
npm run build:h5
npm run serve:h5
```

浏览器打开 http://127.0.0.1:10087/ 即可。

`dist/` 中已经包含构建产物，若只想预览，可跳过前两条命令，直接：

```bash
npm run serve:h5
```

静态服务器默认使用 `10087`，端口冲突时可用
`PORT=10088 npm run serve:h5` 指定其他端口。

### 开发模式

```bash
npm run dev:h5
```

`dev:h5` 自带开发服务器（默认 http://localhost:10086/，端口被占用时自动顺延，
以终端打印的地址为准），修改源码后自动热更新，**不需要**再运行 `serve:h5`。

> **两个命令不要同时运行。** `dev:h5` 使用内存构建并会清空 `dist/`，
> 此时 `serve:h5` 找不到任何文件，浏览器只会显示 `Not found`。
> 需要预览生产包时，先停掉 dev，再依次执行 `build:h5` 和 `serve:h5`。

## 页面

使用 hash 路由：

| 页面 | 地址 |
| --- | --- |
| 首页 / 模板选择 | `#/pages/index/index` |
| 编辑表单 | `#/pages/form/index` |
| 预览 | `#/pages/preview/index` |
| 导出 | `#/pages/export/index` |

## 已修复的 Bug

`src/pages/export/index.tsx` 中，PNG 导出成功后的保存提示把
`confirmText` 写成了 5 个汉字的 `保存到相册`。Taro 的 `showModal`
限制按钮文案最多 4 个汉字，超限时接口直接失败，导致弹窗不出现、
文件也无法下载。

```diff
-        confirmText: '保存到相册',
+        confirmText: '保存',
```

修复后实测：弹窗正常出现，点击「保存」可下载 1588×2246 的 PNG
（438,276 字节）；PDF 导出正常（1 页 A4）。构建共转换 678 个模块，
运行期间无控制台异常。

## 目录说明

```
src/                 40 个原始源码文件（已修复）
config/index.ts      Taro 构建配置
scripts/serve.js     零依赖静态预览服务器（默认端口 10087）
dist/                预构建的 H5 产物
screenshots/         首页、表单、预览、导出页截图
package.json         依赖与脚本
package-lock.json    锁定依赖版本
tsconfig.json        TypeScript 配置
```

## 说明与限制

- `src/index.html` 是构建模板（含 EJS 占位符），**不能直接在浏览器打开**；
  可运行的是构建后的 `dist/index.html`，请通过 `npm run serve:h5` 访问。
- 本工程是根据浏览器可见的前端快照还原的，`package.json`、`config/index.ts`、
  `tsconfig.json`、`src/index.html` 等构建文件按 Taro 4 官方模板补齐，
  不是原 QMuse 工程文件。
- 依赖未打包（`node_modules/` 体积过大），执行 `npm install` 安装。
- 头像上传/裁剪依赖真实的小程序文件选择能力；H5 端只能验证界面与流程。
- 保存到相册、相机等原生能力需在支付宝/微信小程序真机环境验证；
  当前工程只配置了 H5 构建，小程序构建还需补充 `project.config.json`
  及各平台配置。
- 快照不包含登录态、Cookie 或账号信息。
