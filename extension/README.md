# DeepBrain Chrome 扩展 — 网页剪藏

一键保存网页和选中文字到你的 DeepBrain 知识大脑。

## 功能

- **快速保存**：点击扩展图标保存当前网页
- **右键菜单**：选中文字 → 右键 → "保存到 DeepBrain"
- **自动填充**：标题、标识、内容自动从网页获取
- **可配置**：自定义 DeepBrain API 地址和大脑名称

## 安装步骤

1. 启动 DeepBrain API 服务：
   ```bash
   deepbrain serve --port 3333
   ```

2. 打开 Chrome，访问 `chrome://extensions/`

3. 开启右上角的 **开发者模式**

4. 点击 **加载已解压的扩展程序**，选择 `extension/` 目录

5. 工具栏出现 🧠 图标——安装完成！

## 使用方法

### 快速保存（弹窗）
1. 点击工具栏的 🧠 图标
2. 根据需要调整标识、标题、类型或内容
3. 点击 **保存到大脑**

### 右键菜单
1. 在网页上选中任意文字
2. 右键 → **🧠 保存到 DeepBrain**
3. 选中的文字会作为书签保存，附带页面 URL

### 设置
点击弹窗中的 ⚙️ 设置 可以配置：
- **API 地址**：默认 `http://localhost:3333`（DeepBrain serve 端口）
- **大脑名称**：保存到哪个大脑（默认：`default`）

## 要求

- DeepBrain 服务运行中（`deepbrain serve`）
- Chrome / Chromium 内核浏览器（Edge、Brave、Arc 等均可）

## 图标

在 `extension/icons/` 目录放置图标文件：
- `icon16.png`（16×16）
- `icon48.png`（48×48）
- `icon128.png`（128×128）

没有自定义图标扩展也能正常工作。
