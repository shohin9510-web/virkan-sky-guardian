# Работа с изменениями

- `main` должна оставаться запускаемой.
- Новые функции делайте в отдельных ветках `feature/...`.
- Исправления — в `fix/...`.
- Основной игровой код редактируется в `web/index.html`.
- Перед Pull Request выполните `node scripts/check_web.js`.
- Не добавляйте APK, AAB, keystore, пароли и Android build-папки в Git.
- После изменения версии обновляйте `VERSION`, Android `versionCode/versionName` и `CHANGELOG.md`.
