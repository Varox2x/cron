const http = require('http');
const Controller = require('./src/controllers/controller');
const Service = require('./src/services/service');
const Cron = require('./cron/cron');
const displayCurrentDate = require('./src/helpers/displayCurrentDate.js');


class Server {
    constructor() {
        this.server = http.createServer(this.handleRequest.bind(this));
        this.PORT = this.normalizePort(process.argv[2] || '8000');
        this.controller = new Controller();
        this.service = new Service();
        // podaje ścieżke do katalogu w którym zapisywane będą locki crona
        this.cron = new Cron('files/cron')
        this.se
    }

    normalizePort(val) {
        const port = parseInt(val, 10);

        if (isNaN(port)) {
            return val;
        }

        if (port >= 0) {
            return port;
        }

        return false;
    }

    handleRequest(req, res) {
        this.controller.handler(req, res);
    }



    start() {
        this.server.listen(this.PORT, async () => {

            console.log(`Server is running at port: ${this.PORT}`);


            // utworzenie relacji ufid - funkcja 
            try {
                this.cron.addUfidActivateFunction({
                    ufid: 'logCurrentDate', activateFunction: () => {
                        displayCurrentDate()
                    }
                })
            } catch (e) {
                console.log(e)
            }


            // funkcja może być aktywowana z innej instancji cron'a 
            try {
                this.cron.addUfidActivateFunction({
                    ufid: 'saveCurrencyUsdData', activateFunction: () => {
                        this.service.saveDailyCurrencyRateData('usd')
                    }
                })
            } catch (e) {
                console.log(e)
            }



            // tworzę schedule typu interval, co oznacza że funkcja powiązana z ufid: logCurrentDate będzie się wykonywać cyklicznie co minutę
            try {
                this.cron.createSchedule({ ufid: 'logCurrentDate', intervalTime: { timeUnit: 'm', value: 1 } })
            } catch (e) {
                console.log(e)
            }

            // tworzę schedule term co oznacza że funkcja wykona się tylko raz o danym terminie. 
            try {
                this.cron.createSchedule({ ufid: 'logCurrentDate', executeDate: '2024-02-19T23:46:50' })
            } catch (e) {
                console.log(e)
            }
            // mogę wykorzystać to samo ufid to stworzenia schedule typu term w innym terminie
            try {
                this.cron.createSchedule({ ufid: 'logCurrentDate', executeDate: '2024-02-21T23:46:50' })
            } catch (e) {
                console.log(e)
            }

            // zwrócony zostanie błąd ponieważ jest już działający interwał z tym ufid (ufid może powtarzać się tylko w przypadku schedule typu term)
            try {
                this.cron.createSchedule({ ufid: 'logCurrentDate', intervalTime: { timeUnit: 'm', value: 1 } })
            } catch (e) {
                console.log(e)
            }

            //usuwam termin aktywacji dla danego ufid
            this.cron.removeSchedule({ ufid: 'logCurrentDate', executeDate: '2024-02-21T23:46:50', isLockInterval: false })



        });
    }
}

const server = new Server();
server.start();
