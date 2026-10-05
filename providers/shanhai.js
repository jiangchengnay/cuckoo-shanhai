/**
 * 山海（Unisound U2）平台 Provider —— 插件版
 * 由 Cuckoo Code 插件系统加载。hook 已内联，自包含，无外部依赖。
 */
var SHANHAI_HOOK = "\"use strict\";\n(() => {\n  // src/providers/hooks/shared/sse.ts\n  function createFrameDecoder() {\n    var buffer = \"\", scanFrom = 0;\n    return {\n      push: function(text) {\n        buffer += text;\n        var frames = [], re = /\\r?\\n\\r?\\n/g, offset = 0, m;\n        re.lastIndex = scanFrom;\n        while ((m = re.exec(buffer)) !== null) {\n          frames.push(buffer.slice(offset, m.index));\n          offset = m.index + m[0].length;\n        }\n        buffer = buffer.slice(offset);\n        scanFrom = Math.max(0, buffer.length - 3);\n        return frames;\n      },\n      finish: function() {\n        var frames = [];\n        if (buffer) frames.push(buffer);\n        buffer = \"\";\n        scanFrom = 0;\n        return frames;\n      }\n    };\n  }\n  function extractData(block) {\n    if (!block || !block.trim()) return null;\n    var data = null;\n    var lines = block.split(/\\r\\n|\\r|\\n/);\n    for (var i = 0; i < lines.length; i++) {\n      var line = lines[i];\n      if (line.indexOf(\"data:\") === 0) {\n        var d = line.slice(5).trim();\n        data = data == null ? d : data + \"\\n\" + d;\n      }\n    }\n    return data;\n  }\n  function createIdleWatcher() {\n    var lastActiveAt = Date.now();\n    var timer = null;\n    var stopped = false;\n    function readTimeout() {\n      try {\n        var v = parseInt(localStorage.getItem(\"cuckoo-xhr-idle-timeout\") || \"\", 10);\n        if (isFinite(v)) return v;\n      } catch (e) {\n      }\n      return 3e5;\n    }\n    function sessionId() {\n      try {\n        var m = String(location.href).match(/\\/chat\\/s\\/([a-f0-9-]+)/i) || String(location.href).match(/\\/chat\\/([a-zA-Z0-9_-]+)/i);\n        return m ? m[1] : null;\n      } catch (e) {\n        return null;\n      }\n    }\n    function start() {\n      var timeout = readTimeout();\n      if (timeout <= 0) return;\n      timer = setInterval(function() {\n        if (stopped) {\n          stop();\n          return;\n        }\n        if (Date.now() - lastActiveAt > timeout) {\n          lastActiveAt = Date.now();\n          try {\n            window.dispatchEvent(new CustomEvent(\"cuckoo-stream-idle\", { detail: { sessionId: sessionId() } }));\n          } catch (e) {\n          }\n        }\n      }, 5e3);\n    }\n    function touch() {\n      lastActiveAt = Date.now();\n    }\n    function stop() {\n      stopped = true;\n      if (timer) {\n        clearInterval(timer);\n        timer = null;\n      }\n    }\n    return { start, touch, stop };\n  }\n\n  // src/providers/hooks/shanhai.ts\n  function install() {\n    var MARKER = \"__cuckooShanhaiHookInstalled__\";\n    if (window[MARKER]) return;\n    window[MARKER] = true;\n    function isChat(url, method) {\n      if (!url) return false;\n      if (String(method || \"GET\").toUpperCase() !== \"POST\") return false;\n      try {\n        var u = new URL(url, document.baseURI);\n        if (u.hostname.indexOf(\"unisound.com\") === -1) return false;\n        return u.pathname.indexOf(\"/invitation/custom/chat\") >= 0;\n      } catch (e) {\n        return String(url).indexOf(\"/invitation/custom/chat\") !== -1;\n      }\n    }\n    var lastStreamAt = 0;\n    function dispatchStream(text, think, finished) {\n      var now = Date.now();\n      if (!finished && now - lastStreamAt < 80) return;\n      lastStreamAt = now;\n      try {\n        window.dispatchEvent(new CustomEvent(\"cuckoo-ai-stream\", { detail: { think: think || \"\", text: text || \"\", finished: !!finished } }));\n      } catch (e) {\n      }\n    }\n    function dispatch(text, finished) {\n      try {\n        if (finished && !(text && text.trim())) {\n          window.dispatchEvent(new CustomEvent(\"cuckoo-ai-error\", { detail: { text: \"\", status: \"error\", reason: \"empty\" } }));\n          return;\n        }\n        window.dispatchEvent(new CustomEvent(\"cuckoo-ai-response\", { detail: { text: text || \"\", finished: !!finished } }));\n      } catch (e) {\n      }\n    }\n    function observeBody(body) {\n      if (!body) return;\n      var reader = body.getReader();\n      var decoder = new TextDecoder();\n      var frameDecoder = createFrameDecoder();\n      var content = \"\";\n      var reasoning = \"\";\n      var dispatched = false;\n      var idle = createIdleWatcher();\n      idle.start();\n      function finalize() {\n        if (dispatched) return;\n        dispatched = true;\n        idle.stop();\n        var finalText = content || reasoning;\n        console.log(\"[Cuckoo Code][hook][shanhai] \\u56DE\\u590D\\u5B8C\\u6210 content=\" + content.length + \" reasoning=\" + reasoning.length);\n        dispatchStream(finalText, reasoning, true);\n        dispatch(finalText, true);\n      }\n      function handleFrame(block) {\n        var data = extractData(block);\n        if (!data) return;\n        if (data === \"[DONE]\") {\n          finalize();\n          return;\n        }\n        var json = null;\n        try {\n          json = JSON.parse(data);\n        } catch (e) {\n          return;\n        }\n        if (!json) return;\n        try {\n          var chs = json.choices;\n          if (chs && chs.length) {\n            var delta = chs[0].delta || chs[0].message || {};\n            if (typeof delta.content === \"string\" && delta.content) content += delta.content;\n            var rc = delta.reasoningContent || delta.reasoning_content;\n            if (typeof rc === \"string\" && rc) reasoning += rc;\n            dispatchStream(content, reasoning, false);\n          }\n        } catch (e) {\n        }\n      }\n      function pump() {\n        reader.read().then(function(res) {\n          if (res.done) {\n            var rest = frameDecoder.finish();\n            for (var i = 0; i < rest.length; i++) handleFrame(rest[i]);\n            if (content || reasoning) finalize();\n            return;\n          }\n          idle.touch();\n          var chunk = decoder.decode(res.value, { stream: true });\n          var frames = frameDecoder.push(chunk);\n          for (var j = 0; j < frames.length; j++) handleFrame(frames[j]);\n          pump();\n        }).catch(function() {\n        });\n      }\n      pump();\n    }\n    var origFetch = window.fetch;\n    window.fetch = function(input, init) {\n      var url = typeof input === \"string\" ? input : input && input.url;\n      var method = init && init.method || input && input.method || \"GET\";\n      var p = origFetch.apply(this, arguments);\n      try {\n        if (isChat(url, method)) {\n          p.then(function(resp) {\n            try {\n              if (resp && resp.body) {\n                console.log(\"[Cuckoo Code][hook][shanhai] \\u547D\\u4E2D chat\");\n                observeBody(resp.clone().body);\n              }\n            } catch (e) {\n            }\n          }).catch(function() {\n          });\n        }\n      } catch (e) {\n      }\n      return p;\n    };\n  }\n  install();\n})();\n";

module.exports = {
  id: 'shanhai',
  name: '山海大模型',
  useIntercept: true,
  homeUrl: 'https://shanhai.unisound.com/',
  sessionUrlBase: 'https://shanhai.unisound.com/',

  findInput: function () {
    var sels = ['textarea.chat-composer-input', 'textarea[placeholder]', 'textarea', 'div[contenteditable="true"]', '[role="textbox"]'];
    for (var i = 0; i < sels.length; i++) {
      try { var el = document.querySelector(sels[i]); if (this.isElementVisible(el)) return el; } catch (e) {}
    }
    return null;
  },

  findSendButton: function () {
    var sels = ['button[aria-label="发送消息"]', 'button[aria-label*="发送"]', 'button[aria-label*="send"]', 'button.send-button', 'button[type="submit"]'];
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
    var sels = ['[class*="topAvatarButton"]', '[class*="userName"]', '[class*="nickname"]'];
    for (var i = 0; i < sels.length; i++) {
      try { var el = document.querySelector(sels[i]); if (el) { var t = (el.textContent || "").trim(); if (t && t.length <= 24) return t; } } catch (e) {}
    }
    return "";
  },

  getHookSource: function () { return SHANHAI_HOOK; },

  triggerSend: function (input) {
    try {
      if (input && input.focus) input.focus();
      var btn = this.findSendButton();
      if (btn && !btn.disabled && !/disabled/.test(btn.className || "")) { btn.click(); return true; }
      var o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, isComposing: false };
      input.dispatchEvent(new KeyboardEvent('keydown', o));
      input.dispatchEvent(new KeyboardEvent('keypress', o));
      input.dispatchEvent(new KeyboardEvent('keyup', o));
      return true;
    } catch (e) { return false; }
  },
};
