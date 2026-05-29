# Miami Lash Course App

Отдельный PWA-проект для закрытого онлайн-курса Hanna Kozak Lashes.

Теперь проект работает в server mode: курс, коды и админка проверяются backend-ом, а не только браузером.

Production:

```text
https://miami-lash-course-app.vercel.app/
```

## Что уже есть

- Два языка интерфейса и материалов: English / Русский.
- Вход ученицы по одноразовому коду через сервер.
- Привязка активированного кода к первому устройству/браузеру.
- Курс отдается только после успешной активации.
- Уроки, прогресс, материалы и watermark поверх видео-зоны.
- Админка с паролем.
- Редактирование уроков, описаний, шагов, обложек и материалов на двух языках.
- Создание и удаление кодов доступа.
- Export / Import данных через JSON.

## Демо-доступ

Student code:

```text
LASH-MIAMI-2026
```

Local admin password for testing:

```text
Set with ADMIN_PASSWORD. Example: hanna2026
```

## Как редактировать материалы

1. Открыть приложение.
2. Нажать `Admin Login`.
3. Ввести пароль `hanna2026`.
4. Во вкладке `Edit Content / Редактировать` выбрать язык.
5. Выбрать урок или файл.
6. Изменить название, описание, шаги или ссылку на обложку.

Локально изменения сохраняются в `data/store.json`.

На production изменения сохраняются в private GitHub repository:

```text
gtsafd/miami-lash-course-data
```

## Важно про безопасность

GitHub Pages не подходит для защищенной версии, потому что он не запускает backend. Production сейчас задеплоен на Vercel.

Сейчас уже добавлен базовый backend:

- `POST /api/redeem` активирует код.
- `GET /api/course` отдает курс только по student token.
- `POST /api/progress` сохраняет прогресс.
- `POST /api/admin/login` выдает admin token.
- `GET /api/admin/state` показывает коды и курс администратору.
- `POST /api/admin/codes` создает код.
- `DELETE /api/admin/codes/:code` удаляет код.
- `PUT /api/admin/course` сохраняет материалы курса.

Для более сильной защиты видео нужно дополнительно подключить:

- Supabase или Firebase для пользователей, кодов и материалов.
- Cloudflare Stream, Bunny Stream, Mux или Vimeo для видео.
- Signed URLs для временных ссылок на видео.
- Watermark с email/телефоном ученицы.
- Ограничение устройств и сессий.

## Быстрый локальный запуск server mode

```bash
ADMIN_PASSWORD='your-admin-password' TOKEN_SECRET='long-random-secret' node server.js
```

Потом открыть:

```text
http://127.0.0.1:5188
```

## Production Setup

Используется:

- Public app repo: `gtsafd/miami-lash-course-app`
- Private data repo: `gtsafd/miami-lash-course-data`
- Hosting: Vercel
- Production URL: `https://miami-lash-course-app.vercel.app/`

Vercel environment variables:

```text
ADMIN_PASSWORD=your-real-admin-password
TOKEN_SECRET=long-random-secret
GITHUB_TOKEN=github-token-with-repo-access
GITHUB_REPO=gtsafd/miami-lash-course-data
GITHUB_BRANCH=main
GITHUB_STORE_PATH=private/store.json
```

Redeploy manually:

```bash
vercel --prod
```

Для финальной версии с большим количеством учениц лучше Supabase/PostgreSQL вместо GitHub JSON-файла.

---

## 🎰 Бонус: виртуальное казино (отдельная страница)

Курс остаётся основным приложением на `/`. Отдельно, по своей ссылке, добавлено
демо-казино на **виртуальные фишки** (без реальных денег):

```text
/casino/
```

- Игры: слоты, кости, орёл/решка, рулетка, блэкджек.
- Полностью изолировано от курса: свой API под префиксом `/api/casino/*`
  (`lib/casino.js`) и отдельный файл данных `data/casino.json`
  (на production — `GITHUB_CASINO_STORE_PATH`, по умолчанию `private/casino.json`).
- Курс и его данные (`data/store.json`, `lib/app.js`) не затронуты.
