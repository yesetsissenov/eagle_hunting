(function () {
  var errors = [];
  var NL = "\n";
  function webglState() {
    try {
      var c = document.createElement("canvas");
      return c.getContext("webgl2") ? "webgl2 ok" : (c.getContext("webgl") ? "только webgl1" : "НЕДОСТУПЕН");
    } catch (e) { return "ошибка: " + e.message; }
  }
  function overlay() {
    var d = document.getElementById("bk-diag");
    if (!d) {
      d = document.createElement("div");
      d.id = "bk-diag";
      d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#7a1f1f;color:#fff;font:13px/1.5 -apple-system,Arial,sans-serif;padding:12px 14px;border-radius:10px;white-space:pre-wrap;word-break:break-word;max-height:45vh;overflow:auto";
      (document.body || document.documentElement).appendChild(d);
    }
    d.textContent = "Игра не запустилась. Пришлите скриншот этого окна." + NL + NL +
      "Браузер: " + navigator.userAgent + NL +
      "WebGL: " + webglState() + NL + NL +
      "Ошибки:" + NL + (errors.length ? errors.join(NL) : "(не зафиксировано — похоже, модуль не выполнился)") + NL + NL +
      "Что попробовать: в Safari — обновить без кэша: Cmd+Option+R (или Shift+клик по кнопке обновления); либо открыть в приватном окне (Cmd+Shift+N); либо открыть в Chrome; либо обновить Safari.";
  }
  window.addEventListener("error", function (e) {
    errors.push((e.message || "ошибка") + (e.filename ? " @ " + e.filename.split("/").pop() + ":" + e.lineno : ""));
    if (window.__bkFailedFast) overlay();
  });
  window.addEventListener("unhandledrejection", function (e) {
    errors.push("promise: " + (e.reason && (e.reason.message || String(e.reason))));
  });
  setTimeout(function () { if (!window.__bkOK) { window.__bkFailedFast = 1; overlay(); } }, 7000);
})();
