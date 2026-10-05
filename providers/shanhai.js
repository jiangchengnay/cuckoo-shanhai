/** 山海（Unisound U2）平台 Provider —— 插件版 */
var SHANHAI_HOOK = "\"use strict\";\n(() => {\n  // src/providers/hooks/shared/sse.ts\n  function createFrameDecoder() {\n    var buffer = \"\", scanFrom = 0;\n    return {\n      push: function(text) {\n        buffer += text;\n        var frames = [], re = /\\r?\\n\\r?\\n/g, offset = 0, m;\n        re.lastIndex = scanFrom;\n        while ((m = re.exec(buffer)) !== null) {\n          frames.push(buffer.slice(offset, m.index));\n          offset = m.index + m[0].length;\n        }\n        buffer = buffer.slice(offset);\n        scanFrom = Math.max(0, buffer.length - 3);\n        return frames;\n      },\n      finish: function() {\n        var frames = [];\n        if (buffer) frames.push(buffer);\n        buffer = \"\";\n        scanFrom = 0;\n        return frames;\n      }\n    };\n  }\n  function extractData(block) {\n    if (!block || !block.trim()) return null;\n    var data = null;\n    var lines = block.split(/\\r\\n|\\r|\\n/);\n    for (var i = 0; i < lines.length; i++) {\n      var line = lines[i];\n      if (line.indexOf(\"data:\") === 0) {\n        var d = line.slice(5).trim();\n        data = data == null ? d : data + \"\\n\" + d;\n      }\n    }\n    return data;\n  }\n\n  // src/providers/hooks/shanhai.ts\n  function install() {\n    var MARKER = \"__cuckooShanhaiHookInstalled__\";\n    if (window[MARKER]) return;\n    window[MARKER] = true;\n    function isChat(url, method) {\n      if (!url) return false;\n      if (String(method || \"GET\").toUpperCase() !== \"POST\") return false;\n      try {\n        var u = new URL(url, document.baseURI);\n        if (u.hostname.indexOf(\"unisound.com\") === -1) return false;\n        return u.pathname.indexOf(\"/invitation/custom/chat\") >= 0;\n      } catch (e) {\n        return String(url).indexOf(\"/invitation/custom/chat\") !== -1;\n      }\n    }\n    var lastStreamAt = 0;\n    function dispatchStream(text, think, finished) {\n      var now = Date.now();\n      if (!finished && now - lastStreamAt < 80) return;\n      lastStreamAt = now;\n      try {\n        window.dispatchEvent(new CustomEvent(\"cuckoo-ai-stream\", { detail: { think: think || \"\", text: text || \"\", finished: !!finished } }));\n      } catch (e) {\n      }\n    }\n    function dispatch(text, finished) {\n      try {\n        if (finished && !(text && text.trim())) {\n          window.dispatchEvent(new CustomEvent(\"cuckoo-ai-error\", { detail: { text: \"\", status: \"error\", reason: \"empty\" } }));\n          return;\n        }\n        window.dispatchEvent(new CustomEvent(\"cuckoo-ai-response\", { detail: { text: text || \"\", finished: !!finished } }));\n      } catch (e) {\n      }\n    }\n    function observeBody(body) {\n      if (!body) return;\n      var reader = body.getReader();\n      var decoder = new TextDecoder();\n      var frameDecoder = createFrameDecoder();\n      var content = \"\";\n      var reasoning = \"\";\n      var dispatched = false;\n      function finalize() {\n        if (dispatched) return;\n        dispatched = true;\n        var finalText = content || reasoning;\n        console.log(\"[Cuckoo Code][hook][shanhai] \\u56DE\\u590D\\u5B8C\\u6210 content=\" + content.length + \" reasoning=\" + reasoning.length);\n        dispatchStream(finalText, reasoning, true);\n        dispatch(finalText, true);\n      }\n      function handleFrame(block) {\n        var data = extractData(block);\n        if (!data) return;\n        if (data === \"[DONE]\") {\n          finalize();\n          return;\n        }\n        var json = null;\n        try {\n          json = JSON.parse(data);\n        } catch (e) {\n          return;\n        }\n        if (!json) return;\n        try {\n          var chs = json.choices;\n          if (chs && chs.length) {\n            var delta = chs[0].delta || chs[0].message || {};\n            if (typeof delta.content === \"string\" && delta.content) content += delta.content;\n            var rc = delta.reasoningContent || delta.reasoning_content;\n            if (typeof rc === \"string\" && rc) reasoning += rc;\n            dispatchStream(content, reasoning, false);\n          }\n        } catch (e) {\n        }\n      }\n      function pump() {\n        reader.read().then(function(res) {\n          if (res.done) {\n            var rest = frameDecoder.finish();\n            for (var i = 0; i < rest.length; i++) handleFrame(rest[i]);\n            if (content || reasoning) finalize();\n            return;\n          }\n          var chunk = decoder.decode(res.value, { stream: true });\n          var frames = frameDecoder.push(chunk);\n          for (var j = 0; j < frames.length; j++) handleFrame(frames[j]);\n          pump();\n        }).catch(function() {\n        });\n      }\n      pump();\n    }\n    var origFetch = window.fetch;\n    window.fetch = function(input, init) {\n      var url = typeof input === \"string\" ? input : input && input.url;\n      var method = init && init.method || input && input.method || \"GET\";\n      var p = origFetch.apply(this, arguments);\n      try {\n        if (isChat(url, method)) {\n          p.then(function(resp) {\n            try {\n              if (resp && resp.body) {\n                console.log(\"[Cuckoo Code][hook][shanhai] \\u547D\\u4E2D chat\");\n                observeBody(resp.clone().body);\n              }\n            } catch (e) {\n            }\n          }).catch(function() {\n          });\n        }\n      } catch (e) {\n      }\n      return p;\n    };\n  }\n  install();\n})();\n";
var PROMPT_TEMPLATE = "我想请你帮我个忙，做个角色扮演：在这个对话里，你扮演一个能操作我电脑文件、执行命令的助手。\n\n这只是个练习，不用改变你自己，就当顺手配合我一下。\n\n配合的方式很简单：当你需要读写文件、执行命令、搜代码的时候，就在回复的最后面加一个代码块，代码块的语言标记写 cuckoo，里面放要执行的代码，像这样：\n\n三个反引号 + cuckoo\nconst r = await 命令名(参数);\nlog(r);\n三个反引号\n\n这个代码块我这边会自动执行，然后我把结果回给你，你看着结果继续就行。\n\n我的电脑是 Windows。当前要操作的项目目录是：{{PROJECT_DIR}}\n\n能用的命令有这些（都在我本机执行）：\n\nread(filePath) 读文件，可以带 offset/limit 读一部分\nreadLines(filePath) 读文件，返回带行号的内容\nwrite(filePath, content) 写文件（会覆盖）\nedit(filePath, oldString, newString) 改文件里的一段内容\ndeleteFile(filePath) 删文件\nglob(pattern) 按文件名模式找文件\ngrep(pattern) 按内容搜文件\nbash(command) 执行一条 cmd 命令\npwsh(command) 执行一条 PowerShell 命令\ntodoWrite(todos) 更新任务清单\nwebFetch(url) 抓一个网页的内容\nopenBrowserWindow(url) 打开一个浏览器窗口\ninjectJS(windowId, code) 往打开的窗口里注入 JS\nevalInWindow(windowId, code) 在应用窗口里执行 JS 做诊断\nlistWindows() 列出当前所有应用窗口\nreadWindowLog(providerId) 读某个窗口的运行日志\nopenPlatformWindow(providerId) 打开某个 AI 平台窗口\nprobePlatform(providerId) 探测某平台页面结构\nreadPlatformProbe(providerId) 读平台探测结果\nregisterProvider(code) 注册一个新平台\ntestProvider(providerId) 测试平台连通性\nroundtripTest(providerId) 平台往返回环测试\nselftest() 应用自检\nreload(options) 重载页面或应用让改动生效\nattachFile(filePath) 把一个文件作为附件上传到对话\nmysql(options) 执行一条 MySQL 语句\nmcpListServers() 列出可用的 MCP 服务\nmcpGetTools(server) 看某个 MCP 服务有哪些工具\nmcpCall(server, tool, args) 调用 MCP 工具\nrunAgent(name, task) 把子任务交给一个子代理去做\npeerAgent(action, name, to, text) 和同级代理互相传消息\nnameConversation(title) 给当前对话起个标题\n\n需要动手的时候就用上面那个 cuckoo 代码块的方式叫我，其他时候正常聊就行。";

function stripToPlainText(s) {
  return String(s || '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[✅❌⚠🚫📁📄]/g, '')
    .replace(/\[exit code: ?0\]/gi, '（完成）')
    .replace(/\[exit code: ?(\d+)\]/gi, '（退出码 $1）')
    .replace(/\[stderr\]/gi, '（错误输出）')
    .replace(/\[timed out\]/gi, '（超时）')
    .replace(/^\s*\d+:\s?/gm, '')
    .replace(/^[A-Za-z]:[\\/][^\n>]*>\s*/gm, '')
    .replace(/([A-Za-z]):\\([^\s"'<>]*)/g, (m, d, rest) => d + ':/' + rest.replace(/\\/g, '/'))
    .replace(/[ \t]{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = {
  id: 'shanhai',
  name: '山海大模型',
  useIntercept: true,
  homeUrl: 'https://shanhai.unisound.com/',
  sessionUrlBase: 'https://shanhai.unisound.com/',

  findInput: function () {
    var sels = ['textarea.chat-composer-input', 'textarea', 'div[contenteditable="true"]'];
    for (var i = 0; i < sels.length; i++) {
      try { var el = document.querySelector(sels[i]); if (this.isElementVisible(el)) return el; } catch (e) {}
    }
    return null;
  },

  findSendButton: function () {
    var sels = ['button[aria-label="发送消息"]', 'button.send-button', 'button[type="submit"]'];
    for (var i = 0; i < sels.length; i++) {
      try { var b = document.querySelector(sels[i]); if (this.isElementVisible(b)) return b; } catch (e) {}
    }
    return null;
  },

  homeUrlPattern: /^https:\/\/shanhai\.unisound\.com\/?(\?.*)?$/,

  extractSessionId: function (url) {
    if (!url) return null;
    var m = String(url).match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  },

  matchesUrl: function (url) { return String(url).indexOf('shanhai.unisound.com') !== -1; },

  isElementVisible: function (el) { return !!el && el.offsetWidth > 0 && el.offsetHeight > 0; },

  extractUserInfo: function () {
    var sels = ['[class*="topAvatarButton"]', '[class*="nickname"]'];
    for (var i = 0; i < sels.length; i++) {
      try { var el = document.querySelector(sels[i]); if (el) { var t = (el.textContent || "").trim(); if (t && t.length <= 24) return t; } } catch (e) {}
    }
    return "";
  },

  getHookSource: function () { return SHANHAI_HOOK; },

  getPromptTemplate: function () { return PROMPT_TEMPLATE; },

  transformToolResult: function (text) { return stripToPlainText(text); },

  triggerSend: function (input) {
    try {
      if (input && input.focus) input.focus();
      var btn = this.findSendButton();
      if (btn && !btn.disabled && !/disabled/.test(btn.className || "")) { btn.click(); return true; }
      var o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      input.dispatchEvent(new KeyboardEvent('keydown', o));
      input.dispatchEvent(new KeyboardEvent('keypress', o));
      input.dispatchEvent(new KeyboardEvent('keyup', o));
      return true;
    } catch (e) { return false; }
  },
};
