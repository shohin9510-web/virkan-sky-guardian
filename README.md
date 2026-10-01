# VIRKAN: SKY GUARDIAN

Мобильный 3D-прототип супергеройской action/open-world игры. Текущая рабочая версия: **v2.0**.

Основной исходник игры находится в `web/index.html`. Android-проект расположен в `android/`, а GitHub Actions — в `.github/workflows/`.

## Разработка

1. Изменяйте `web/index.html`.
2. Проверяйте JavaScript через `node scripts/check_web.js`.
3. Создавайте Pull Request в `main`.
4. После merge GitHub Actions проверит веб-версию и соберёт debug APK.

## Android

Android-проект рассчитан на Android 8.0+ и использует WebView. При сборке Three.js копируется локально, чтобы установленная игра могла запускаться без обязательного интернета.

## Важно

Release APK/AAB для Google Play потребует собственного signing keystore и хранения секретов в GitHub Secrets. Не добавляйте `.jks`, `.keystore` и пароли в репозиторий.
