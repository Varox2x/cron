# Zadanie rekrutacyjne

Witam, przedstawiam moją aplikację w której zaimplementowałem stworzony przeze mnie moduł cron.
Oficjalna dokumentacja do modułu znajduję się w katalogu **,cron'** .

```shell

.
├── app.js
├── cron
│   ├── cron.js		<----- moduł cron
│   └── README.md	<-----oficjalna dokumentacja
├── files
│   ├── cron
│   └── dailyCurrencyRate
│       └── usd
├── package.json
├── README.md
└── src
    ├── controllers
    │   └── controller.js
    ├── helpers
    │   ├── displayCurrentDate.js
    │   └── getCurrentDate.js
    └── services
        └── service.js


```

**Aplikacja** jest jedynie prostym prototypem stworzonym na potrzebę pokazu działania Cron'a. Służy do zapisywania informacji o danym kursie dolara. Wykorzystuje API NBP. Zawiera dwa enpointy:

/schedule

> metoda POST
> aktywuje zapisywanie się kursu dolara w lokalnych plikach co minutę

/removeSchedule

> metoda POST
> anuluje zapisywanie się kursu dolara w lokalnych plikach co minutę

W projekcie znajdują się komentarze w których przybliżyłem sposób implementacji dla tej aplikacji.

By uruchomić aplikację należy z poziomu głównego katalogu aktywować polecenie:

```shell
node app.js 8000
```

> aplikacja zostanie aktywowana na porcie 8000

**Koniecznie proszę zapoznać się z dokumentacją modułu Cron.** Aplikacja ma jedynie charakter pokazowy.

Wykonane przez - Hubert Rutkowski
