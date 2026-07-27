# Запуск сервера через pm2

Инструкция по автоматическому запуску `server.js` через `pm2` и сохранению конфигурации при перезагрузке сервера.

1) Установите pm2 глобально (рекомендуется) или как dev-зависимость:

```bash
# глобально
npm install -g pm2

# или в проект (уже добавлен в devDependencies):
npm install
npx pm2 -v
```

2) Запустите приложение с использованием `ecosystem.config.js`:

```bash
pm2 start ecosystem.config.js
# сохранить текущий список процессов для автозапуска после перезагрузки
pm2 save
```

3) Настройка автозапуска (systemd):

```bash
pm2 startup systemd
# команда выведет команду, которую нужно выполнить от root (выполните её)
pm2 save
```

4) Полезные команды pm2:

```bash
pm2 status
pm2 logs tournaments-server
pm2 restart tournaments-server
pm2 stop tournaments-server
pm2 delete tournaments-server
```

5) Логи: `ecosystem.config.js` записывает логи в `./logs/out.log` и `./logs/err.log` — создайте папку `logs` и убедитесь в правах записи:

```bash
mkdir -p logs
chown -R $(whoami) logs
```

**Для Windows (PowerShell)**:

```powershell
mkdir logs
icacls logs /grant $env:USERNAME:(OI)(CI)F /T
```

6) Примечание по безопасности: если вы используете систему с привилегиями, `pm2 startup` выдаст команду для добавления сервиса в `systemd`.
