# Android-сборка VIRKAN

## Через GitHub Actions

1. Откройте вкладку **Actions**.
2. Выберите **Build VIRKAN Android APK**.
3. Нажмите **Run workflow**.
4. Дождитесь зелёной отметки.
5. Откройте завершённый run.
6. Внизу страницы скачайте artifact `Virkan-Sky-Guardian-v2.0-debug-apk`.
7. Распакуйте artifact — внутри будет `app-debug.apk`.

## Что происходит при сборке

1. Берётся `web/index.html`.
2. Gradle создаёт `android/app/src/main/assets/index.html`.
3. Ссылка на Three.js CDN заменяется на локальный `three.min.js`.
4. Three.js r160 скачивается на машине сборки.
5. HTML и Three.js помещаются внутрь APK.
6. Android WebView открывает `file:///android_asset/index.html`.

## Локальная сборка

Нужны Java 17, Android SDK 35 и Gradle 8.10.2+.

```bash
gradle -p android :app:assembleDebug
```

Результат:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Release / Google Play

Debug APK не предназначен для публикации в Google Play. Для release нужны:

- собственный signing keystore;
- безопасные GitHub Secrets;
- увеличение `versionCode` для каждого релиза;
- release APK или, предпочтительно, Android App Bundle (`.aab`).

Файлы ключей и пароли нельзя коммитить в GitHub.
