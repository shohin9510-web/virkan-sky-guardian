# VIRKAN: SKY GUARDIAN

Мобильный 3D-прототип супергеройской action/open-world игры. Текущая рабочая версия: **v2.1**.

Основной исходник игры находится в `web/index.html`. Android-проект расположен в `android/`, а GitHub Actions — в `.github/workflows/`.

## Разработка

1. Изменяйте `web/index.html`.
2. Проверяйте JavaScript через `node scripts/check_web.js`.
3. Создавайте Pull Request в `main`.
4. Pull Request запускает проверку JavaScript, регрессионные тесты и сборку debug APK без merge.

Полная локальная проверка: `node scripts/check_web.js && node --test scripts/*.test.cjs`.
Проверки игровой логики выполняются с настоящей Three.js и заглушкой рендерера: они не измеряют FPS на устройстве.

## Android

Android-проект рассчитан на Android 8.0+ и использует WebView. При сборке Three.js копируется локально, чтобы установленная игра могла запускаться без обязательного интернета.

## Важно

Release APK/AAB для Google Play потребует собственного signing keystore и хранения секретов в GitHub Secrets. Не добавляйте `.jks`, `.keystore` и пароли в репозиторий.
