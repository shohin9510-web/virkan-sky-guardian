# Архитектура репозитория

## web/

`web/index.html` — канонический исходник текущего прототипа. В нём находятся HTML, CSS и JavaScript игры.

## android/

Нативная Android-обёртка на WebView. `MainActivity.java` открывает игру в полноэкранном landscape-режиме. Во время Gradle-сборки HTML синхронизируется из `web/`.

## scripts/

- `check_web.js` — синтаксически проверяет встроенный JavaScript без запуска игры.
- `sync_android_assets.py` — ручной вариант синхронизации web → Android assets для диагностики.

## .github/workflows/

- `validate-web.yml` — проверка при push / Pull Request.
- `build-android.yml` — debug APK.
- `deploy-pages.yml` — ручная публикация браузерной демо-версии через GitHub Pages.

## Следующий архитектурный этап

После стабилизации v2.x имеет смысл постепенно разделить монолитный `web/index.html` на `src/js`, `src/css` и `assets`, но делать это отдельной веткой, чтобы не ломать рабочую мобильную сборку.
