// Android integration: the hardware back button steps back through Pace before leaving the app.
(function () {
  "use strict";
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var App = cap.Plugins && cap.Plugins.App;
  if (!App) return;
  App.addListener("backButton", function () {
    if (!(window.PaceApp && window.PaceApp.back())) App.exitApp();
  });
})();
