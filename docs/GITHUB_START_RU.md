# Как начать работу с VIRKAN через GitHub

## Вариант 1 — через сайт GitHub

1. В GitHub нажмите **New repository**.
2. Название: `virkan-sky-guardian`.
3. На первом этапе не добавляйте README, `.gitignore` или License — они уже находятся в проекте.
4. Создайте репозиторий.
5. Нажмите **uploading an existing file**.
6. Перетащите всё содержимое распакованной папки проекта.
7. Commit message: `VIRKAN v2.0 baseline`.
8. Нажмите **Commit changes**.

После загрузки откройте вкладку **Actions**. Workflow `Validate VIRKAN Web Source` проверит JavaScript. Workflow `Build VIRKAN Android APK` соберёт тестовый APK при push в `main` или вручную.

## Вариант 2 — Git в командной строке

```bash
git init
git add .
git commit -m "VIRKAN v2.0 baseline"
git branch -M main
git remote add origin https://github.com/USERNAME/virkan-sky-guardian.git
git push -u origin main
```

## Как вести дальнейшую разработку

Для каждой крупной функции создавайте отдельную ветку:

```bash
git checkout -b feature/new-missions
```

После изменения игры:

```bash
node scripts/check_web.js
git add .
git commit -m "Add new missions"
git push -u origin feature/new-missions
```

Затем создайте Pull Request в `main`.

## Где менять саму игру

Основной файл:

```text
web/index.html
```

Android-копию HTML вручную менять не нужно. Gradle автоматически синхронизирует её перед сборкой.
