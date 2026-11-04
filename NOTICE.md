# Авторство и лицензии

Нефрит / Nephrite, версия 0.1.0.

Код, интерфейс и иконка приложения: © 2026 Nephrite contributors.
Лицензия: GPL-3.0-or-later. Полный текст GPLv3 находится в LICENSE.

Раскладки в src/game.ts и src/gnome-layouts.ts адаптированы из GNOME Mahjongg,
data/maps/mahjongg.map: © 2004–2025 Mahjongg Contributors, GPL-3.0-or-later.
Изменения 2026: перевод координат всех десяти раскладок в TypeScript, русские названия.
Оригинальный файл со всеми уведомлениями сохранён в public/upstream/mahjongg.map.
Источник: https://github.com/GNOME/gnome-mahjongg/blob/main/data/maps/mahjongg.map

Форма и рисунки костяшек — оригинальная тема Postmodern из GNOME Mahjongg:
© 2004–2025 Mahjongg Contributors, GPL-3.0-or-later.
Файл public/themes/postmodern.svg включён без изменений; растровый атлас
public/themes/postmodern.webp получен из него в разрешении 5504 × 352 без потерь.
Воспроизведение: scripts/render-atlas.py (ImageMagick и Pillow). Уведомления —
public/themes/postmodern.svg.license.
Источник: https://github.com/GNOME/gnome-mahjongg/blob/main/data/themes/postmodern.svg
Иконка приложения создана для этого проекта.
GNOME — товарный знак GNOME Foundation; проект независимый и не является официальным приложением GNOME.

Зависимость приложения:
- idb — © Jake Archibald и участники проекта, ISC.
  https://github.com/jakearchibald/idb
  Текст лицензии: public/licenses/idb-LICENSE.txt (копируется из установленного пакета).
  Исходники используемой версии 8.0.4: public/upstream/idb-v8.0.4.tar.gz.

Инструменты разработки и тестирования перечислены в package.json и package-lock.json.
Их лицензии сохраняются в соответствующих пакетах npm и не заменяются лицензией приложения.

Сборка содержит source.tar.gz — соответствующие исходники этой версии, включая
package-lock.json, исходные SVG/PNG, инструкции и скрипты сборки.
При распространении сборки сохраняйте этот архив и файлы лицензий.
