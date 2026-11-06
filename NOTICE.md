# Авторство и лицензии

Нефрит / Nephrite, версия 0.1.0.

Код, интерфейс и иконка приложения: © 2026 Nephrite contributors.
Лицензия: GPL-3.0-or-later. Полный текст GPLv3 находится в LICENSE.

Раскладка «Черепаха» в src/turtle.ts адаптирована из Jarajara:
© 2026 John Morris, MIT. Дополнения адаптации: © 2026 Nephrite contributors, MIT.
Источник: https://github.com/johnmorrisdotca/jarajara/blob/a5a8928eedfcc35d8f1fc8bc9328f0486a62baf6/src/layouts.ts
Изменения: выделена только Turtle, координаты переведены из половин костяшки
в шаги целой костяшки, добавлены стабильные идентификаторы без сортировки.
Полный текст MIT: public/licenses/jarajara-LICENSE.txt.
Шесть компактных раскладок в src/game.ts созданы для этого проекта.
Раскладки и исходный файл карт GNOME в эту версию не входят.

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

Тема «Нефритовая»: public/themes/nephrite.svg и nephrite.webp,
а также её генератор scripts/generate-nephrite-atlas.py:
© 2026 Nephrite contributors, MIT.
Корпуса построены программно из прямоугольной лицевой панели и объёма 8 × 8;
рисунки созданы для проекта. Генератор не читает и не встраивает Postmodern.
Сохранён геометрический формат: ячейки 64 × 88, лицевая панель 56 × 80,
скос 45°, 43 столбца, две строки состояний, прежний порядок рисунков.
Материалы, обводка и подсветка корпуса нарисованы заново.
Полный текст MIT: public/licenses/nephrite-theme-LICENSE.txt.
Растровый атлас 5504 × 352 без потерь: scripts/render-atlas.py.
Лицензия MIT этой темы не меняет GPL-лицензию приложения и темы Postmodern.
