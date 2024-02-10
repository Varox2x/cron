const fs = require('fs');
const Service = require('../services/service')
const Cron = require('../../cron/cron')

class Controller {

    constructor() {
        this.service = new Service()
        this.cron = new Cron('files/cron')
    }


    handler(req, res) {
        const { url, method } = req;
        switch (`${method} ${url}`) {
            case 'POST /schedule':
                this.schedule(req, res);
                break;
            case 'POST /removeSchedule':
                this.removeSchedule(req, res);
                break;
            default:
                this.pageNotFound(res);
        }

    }


    async schedule(req, res) {

        // wykorzystuje ufid zadeklarowane w innej instancji corn'a (app.js). W tym przypadku będzie się aktywować co minute
        try {
            this.cron.createSchedule({ ufid: 'saveCurrencyUsdData', intervalTime: { timeUnit: 'm', value: 1 } })
        } catch (e) {
            console.log(e)
        }

        try {
            const currency = await this.service.getDailyRate("chf")
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(currency));
        } catch (error) {
            console.log(error)
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }

    }

    async removeSchedule(req, res) {
        // usuwam schedule typu interwał dla danego ufid
        this.cron.removeSchedule({ ufid: 'saveCurrencyUsdData', isLockInterval: true })
        try {
            const currency = await this.service.getDailyRate("chf")
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(currency));
        } catch (error) {
            console.log(error)
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }

    }


    pageNotFound(res) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('Page not found');
    }
}

module.exports = Controller;
