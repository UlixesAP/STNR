# Nginx Basic Auth для `/viewer`

Инструкция по защите страницы просмотра `/viewer` и SSE `/events` с помощью HTTP Basic Auth.

1) Скопируйте конфигурацию `deploy/apache_viewer.conf` в `/etc/apache2/sites-available/viewer.conf`.

2) Установите необходимые модули и создайте файл с пользователями (пример для Debian/Ubuntu):

```bash
sudo apt update
sudo apt install apache2 apache2-utils
sudo a2enmod proxy proxy_http headers auth_basic authn_file
sudo htpasswd -c /etc/apache2/.htpasswd <username>
```

Команда `htpasswd` запросит пароль и сохранит запись `username:hashed` в `/etc/apache2/.htpasswd`.

Если `htpasswd` недоступен, можно сгенерировать хэш вручную и добавить строку `user:$apr1$...` в файл.

3) Активируйте конфигурацию сайта и перезапустите Apache:

```bash
sudo cp deploy/apache_viewer.conf /etc/apache2/sites-available/viewer.conf
sudo a2ensite viewer.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

4) Убедитесь, что `ServerName` в `apache_viewer.conf` установлен правильно и что Apache может достучаться до `127.0.0.1:3333` (наш Node сервер).

Примечания о безопасности:
- Файл `/etc/apache2/.htpasswd` содержит хэши паролей — не храните его в публичном репозитории.
- Для публичного доступа обязательно используйте HTTPS (например, Let's Encrypt) и при необходимости ограничьте доступ по IP.

