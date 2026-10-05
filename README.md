# 山海大模型（cuckoo-shanhai）

为 [Cuckoo Code](https://github.com/wangyongpeng90/cuckoo-code) 增加**山海大模型**（Unisound U2，shanhai.unisound.com）平台支持。

## 功能

- **网络拦截抓取回复**：hook 拦截 `POST /v1/invitation/custom/chat` 的 SSE 流，实时解析正文
- **输入框定位**：`textarea.chat-composer-input`
- **发送按钮定位**：`button[aria-label="发送消息"]`（自动回退 Enter）
- **会话 ID 提取**、**登录态复用**

## 平台信息

- 官网：https://shanhai.unisound.com/
- 厂商：云知声（Unisound）
- 模型：Unisound U2（原生 Agent 大模型）
- 登录：手机号 + 验证码

## 安装

插件页搜索 `cuckoo-plugin`，或：

```bash
git clone https://github.com/jiangchengnay/cuckoo-shanhai.git ~/.cuckoo/plugins/cuckoo-shanhai
```

安装后**启用**插件，重启应用，在平台选择页选「山海大模型」。

## 说明

- **需要登录**：首次使用需在窗口内用手机号+验证码登录，登录态会保存在持久会话中
- **含可执行内容**：本插件含 provider（providers/shanhai.js），启用时会提示"含可执行内容"

## 更新日志

### v0.9.0
- 首次发布：山海大模型平台支持

## 许可

MIT
