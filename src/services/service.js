const fs = require('fs');
const fsPromises = require('fs').promises
const Cron = require('../../cron/cron')
const getCurrentDate = require('../helpers/getCurrentDate')

class Service {
    constructor() {
        this.cron = new Cron('files/cron')
    }

    async getDailyRate(currencyCode) {
        if (!currencyCode) {
            throw 'No currency code given'
        }
        return fetch(`http://api.nbp.pl/api/exchangerates/rates/a/${currencyCode}/`)
            .then(async (response) => {
                const data = await response.json()
                return data.rates?.[0] ?? {};
            })
    }

    async saveDailyCurrencyRateData(currencyCode = "usd") {
        const currencyData = await this.getDailyRate(currencyCode)
        const currentDate = getCurrentDate()
        if (currencyData?.effectiveDate) {
            await fs.promises.mkdir(`files/dailyCurrencyRate/${currencyCode}`, { recursive: true }).catch(console.error);
            await fsPromises.writeFile(`files/dailyCurrencyRate/${currencyCode}/${currentDate}.txt`, JSON.stringify(currencyData))
        }
    }


}

module.exports = Service;
