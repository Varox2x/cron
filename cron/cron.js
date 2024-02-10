const fs = require('fs');
const INTERVALDURATION = 30_000

const ENUM_ERROR = {
    UFID_DOESNT_EXIST: 'UFID_DOESNT_EXIST',
    RELATION_WITH_THIS_UFID_ALREADY_EXIST: 'RELATION_WITH_THIS_UFID_ALREADY_EXIST',
    INTERVAL_LOCK_WITH_THIS_UFID_ALREADY_EXIST: 'INTERVAL_LOCK_WITH_THIS_UFID_ALREADY_EXIST',
    TERM_LOCK_WITH_THIS_UFID_AND_EXECUTEDATE_ALREADY_EXIST: 'TERM_LOCK_WITH_THIS_UFID_AND_EXECUTEDATE_ALREADY_EXIST',
    INVALID_TIME_UNIT: `Invalid time unit. Please provide 'm' for minutes, 'h' for hours, or 'd' for days.`,
}

// Types of locks:
// -IntervalLock - A lock with cyclic activation.
// -TermLock - A lock activated once at a specific executeDate(timestamp)

// Types of lock formats:
// -lockObject - A lock in object format {executeTimestamp, ufid, intervalTime?}
// -lockString - A lock in string format 'executeTimestamp-ufid-intervalTime?'

class Cron {
    /**
     * @param {string} cronDir - The path where the cron locks should be stored.
     */
    constructor(cronDir) {
        if (!Cron.instance) {
            Cron.instance = this;
            /**
             * The path where the cron locks should be stored.
             */
            this.cronDir = cronDir;
            this.currentTimestamp = 0
            this.previousTimestamp = 0
            this.timestampDiff = 0
            /**
             * Stores the relationship between UFID (key) and activateFunction (value).
             */
            this.ufidFunctions = {}
            this.didReschudleOutdatedIntervalLocks = false
            this.isIntervalWorking = false
            if (this.#shouldIntervalCronStart()) {
                this.#start()
            }
        }

        return Cron.instance;
    }


    /**
     * Removes the activation schedule for the given UFID.
     * @param {object} arg - The lock object representing the file lock.
     * @param {string} arg.ufid - The unique function identifier for the lock.
     * @param {string} arg.executeDate - Activation date (provide if you're removing the schedule - TermLock)
     * @param {boolean} arg.isLockInterval - Is the schedule being removed an interval?
     */
    removeSchedule({ ufid, executeDate, isLockInterval }) {
        const allLocksObjects = this.#getLockObjectsFromDir()
        let lockObjectToRemove;
        if (!isLockInterval) {
            const executeTimestamp = this.#convertDateToTimestamp(executeDate)
            lockObjectToRemove = allLocksObjects.find(lockObject => (lockObject.ufid == ufid) && (lockObject.executeTimestamp == executeTimestamp))
        }
        if (isLockInterval) {
            lockObjectToRemove = allLocksObjects.find(lockObject => (lockObject.ufid == ufid) && lockObject.hasOwnProperty('intervalTimestamp'))
        }
        if (!lockObjectToRemove) return
        const lockStringToRemove = this.#convertLockToString(lockObjectToRemove)
        try {
            this.#deleteLockFileByString(lockStringToRemove)
        } catch {
            console.log("failed while removing lock")
        }
    }

    /** 
     * It sets up the activation schedule for the function with the provided UFID. 
     * If intervalTime is provided, the function will execute cyclically at the specified intervalTime, 
     * if we set an interval, it will be the first activation date. If not provided, the first activation date of the interval will be closest to the tick function activation.
     * It starts the cron interval if it's not already enabled. Throws an error in case of failure.
     * @param {object} object
     * @param {string} object.executeDate Activation date. (In interval case )
     * @param {string} object.ufid Unique function identifier 
     * @param {number} [object.intervalTime ] { timeUnit, value } timeUnit - provide 's' for seconds, 'm' for minutes, 'h' for hours, or 'd' for days.
     */
    createSchedule({ executeDate, ufid, intervalTime }) {
        let executeTimestamp = this.#convertDateToTimestamp(executeDate)
        try {
            if (!this.isIntervalWorking) {
                this.#start()
            }
            if (intervalTime) {
                const intervalTimestamp = this.#calculateTimestamp(intervalTime)
                this.#createIntervalLockFile({ executeTimestamp, ufid, intervalTimestamp })
            } else {
                this.#createTerm({ executeTimestamp, ufid })
            }

        } catch (e) {
            throw e
        }

    }

    /** 
     * It creates a mapping between UFID and the activate function. Based on this relationship,
     * we will be able to activate the specified function using the provided UFID.
     * It returns an error if this UFID is already used in any relationship.
     * @param {object} relation
     * @param {string} relation.ufid The unique function identificator
     * @param {function} relation.activateFunction The function to be invoked for a given UFID
     */
    addUfidActivateFunction({ ufid, activateFunction }) {
        if (this.ufidFunctions.hasOwnProperty(ufid)) {
            throw new Error(ENUM_ERROR.RELATION_WITH_THIS_UFID_ALREADY_EXIST)
        }
        this.ufidFunctions = { ...this.ufidFunctions, [ufid]: activateFunction }
    }

    /**
     * Starts interval
     */
    #start() {
        this.isIntervalWorking = true
        setInterval(() => {
            this.#tick()
        }, INTERVALDURATION);
    }

    /**
     * check whether dir folder has any intervalLocks oraz not outdated term locks
     */
    #shouldIntervalCronStart() {
        if (this.isIntervalWorking) return false
        const allLocksObjects = this.#getLockObjectsFromDir()
        const currentTimestamp = new Date().getTime();
        return allLocksObjects.some(lockObject => (lockObject.intervalTimestamp || (currentTimestamp < lockObject.executeTimestamp)))
    }


    /**
     * It gathers interval locks whose executeTimestamp is less than currentTimeStamp and then creates new ones whose executeTimestamp is greater than currentTimestamp.
     * @param {Array.<object>} allLocksObjects  Array of locks objects
     */
    #reschudleOutdatedIntervalLocks(allLocksObjects) {
        this.didReschudleOutdatedIntervalLocks = true
        const outdatedIntervalLocksObjects = allLocksObjects.filter(lockObject => lockObject.hasOwnProperty('intervalTimestamp') && (lockObject.executeTimestamp < (this.previousTimestamp + INTERVALDURATION)))
        if (outdatedIntervalLocksObjects.length == 0) return
        const createNewExecuteTimestamp = (oldExecuteTimestamp, intervalTimestamp) => {
            const numbeActivationsThatShouldTakePlace = (this.currentTimestamp - oldExecuteTimestamp) / intervalTimestamp
            const newExecuteTimestamp = oldExecuteTimestamp + ((numbeActivationsThatShouldTakePlace + 1) * intervalTimestamp)
            if (newExecuteTimestamp < (this.currentTimestamp + INTERVALDURATION)) {
                return newExecuteTimestamp + intervalTimestamp
            }
            return newExecuteTimestamp
        }
        for (const lockObject of outdatedIntervalLocksObjects) {
            const lockString = this.#convertLockToString(lockObject)
            try {
                this.#deleteLockFileByString(lockString)
            } catch {
                continue
            }
            const { executeTimestamp, ufid, intervalTimestamp } = lockObject
            const newExecuteTimestamp = createNewExecuteTimestamp(executeTimestamp, intervalTimestamp)
            this.#createLockFileByObject({ executeTimestamp: newExecuteTimestamp, ufid, intervalTimestamp })
        }

    }

    /**
     * Returns activate function for providen ufid. If it doesn't find such a UFID, it throws an error
     * @param {string} ufid - The unique function identifier for the lock.
     * @returns {function} activate function
     */
    #getActivationFunctionByUfid(ufid) {
        const activateFunction = this.ufidFunctions[ufid]
        if (!activateFunction) {
            throw new Error(ENUM_ERROR.UFID_DOESNT_EXIST)
        }
        return activateFunction
    }

    /**
     * It activates with each interval execution
     */
    #tick() {
        this.#setPreviousTimestamp()
        this.#setCurrentTimestamp()
        if (this.previousTimestamp == 0) {
            return
        }
        const allLocksObjects = this.#getLockObjectsFromDir()
        if (!this.didReschudleOutdatedIntervalLocks) {
            this.#reschudleOutdatedIntervalLocks(allLocksObjects)
        }
        const locksObjectsTodo = this.#filterLocksObjectsTodo(allLocksObjects)
        for (const lockObject of locksObjectsTodo) {
            this.#handleLockObject(lockObject);
        }

    }

    /**
     * Handles single lock object. As a guarantee that no other process will execute activateFunction,
     *  the lockFile is removed first. If it does not exist,
     *  it means that another process has already taken care of it, then the function is aborted.
     * @param {object} lockObject - lock object
     */
    #handleLockObject(lockObject) {
        const { executeTimestamp, ufid, intervalTimestamp } = lockObject
        try {
            this.#deleteLockFileByString(this.#convertLockToString(lockObject))
        } catch (err) {
            return
        }
        if (intervalTimestamp) {
            const newExecutionTimestamp = executeTimestamp + intervalTimestamp
            this.#createLockFileByObject({ executeTimestamp: newExecutionTimestamp, ufid, intervalTimestamp })
        }
        let activateFunction;
        try {
            activateFunction = this.#getActivationFunctionByUfid(ufid)
        } catch (e) {
            console.log(e)
        }
        activateFunction()
    }

    /**
     * Filters locks objects array to lock objects to do for current tick 
     * @param {Array.<object>} locksObjects - Array of locks objects
     */
    #filterLocksObjectsTodo(locksObjects) {
        // We take the time from (previousTimestamp + intervalduration) in case the currentTimestamp is not available, so as not to miss any locks. 
        const timeStampFrom = this.previousTimestamp + INTERVALDURATION
        const timeStampTo = this.currentTimestamp + INTERVALDURATION
        return locksObjects.filter(lockObject => (lockObject.executeTimestamp > timeStampFrom) && (lockObject.executeTimestamp < timeStampTo))
    }

    /**
     * Creates lock file for term, throws error when lock with this ufid and executeTimestamp exists 
     * @param {object} lockObject - The lock object representing the file lock.
     * @param {string} lockObject.ufid - The unique function identifier for the lock.
     * @param {number} lockObject.executeTimestamp - The timestamp for the execution date.
     */
    #createTerm({ executeTimestamp, ufid }) {
        // sprawdza czy jest juz term o tym ufid i executeTimestamp jesli tak przerywa funkcje PL
        const allLocksObjects = this.#getLockObjectsFromDir()
        const isLockExist = allLocksObjects.some(lockObject => (lockObject.ufid == ufid) && (lockObject.executeTimestamp == executeTimestamp))
        if (isLockExist) throw new Error(ENUM_ERROR.TERM_LOCK_WITH_THIS_UFID_AND_EXECUTEDATE_ALREADY_EXIST)
        this.#createLockFileByObject({ executeTimestamp, ufid })
    }

    /**
     * Creates lock file for interval, throws error when lock with this ufid exists 
     * @param {object} lockObject  The lock object representing the file lock.
     * @param {string} lockObject.ufid  The unique function identifier for the lock.
     * @param {number} lockObject.executeTimestamp  The timestamp for the execution date.
     * @param {number} [lockObject.intervalTimestamp]  The timestamp for the execution date.
     */
    #createIntervalLockFile({ executeTimestamp, ufid, intervalTimestamp }) {
        //jesli nie podamy executeTimestamp to zostanie ustawiony na  INTERVALDURATION * 3 PL
        if (!executeTimestamp) {
            const currentTime = new Date().getTime();
            executeTimestamp = currentTime + INTERVALDURATION * 3
        }
        // sprawdza czy jest juz interwał o tym ufid PL
        const allLocksObjects = this.#getLockObjectsFromDir()
        const isLockExist = allLocksObjects.some(lockObject => lockObject.ufid == ufid)
        if (isLockExist) throw new Error(ENUM_ERROR.INTERVAL_LOCK_WITH_THIS_UFID_ALREADY_EXIST)
        this.#createLockFileByObject({ executeTimestamp, ufid, intervalTimestamp })
    }

    /**
     * Gets array of locks string and converts to locks Objects
     * @param {Array.<string>} stringsArray - Array of locks strings
     */
    #convertLocksToObjects(locksStrings) {
        return locksStrings.map(lockName => this.#convertLockToObject(lockName))
    }

    /**
     * Converts lock string to lock object.
     * @param {string} lockString - The lock object representing the file lock string.
     * @returns {object} The lock in object type {ufid, intervalTimestamp, executeTimestamp}
     */
    #convertLockToObject(lockString) {
        const [executeTimestamp, ufid, intervalTimestamp] = lockString.split('-');
        if (intervalTimestamp) {
            return {
                executeTimestamp: Number(executeTimestamp),
                ufid: ufid,
                intervalTimestamp: Number(intervalTimestamp)
            };
        }
        return {
            executeTimestamp: Number(executeTimestamp),
            ufid: ufid,
        };
    }

    /**
     * Converts lock object to string lock
     * @param {object} lockObject The object representing the file lock.
     * @param {string} lockObject.ufid The unique function identifier for the lock.
     * @param {number} lockObject.executeTimestamp The timestamp for the execution date.
     * @param {number} [lockObject.intervalTimestamp] The timestamp for the execution date.
     * @returns {string} The lock file string name.
     */
    #convertLockToString({ executeTimestamp, ufid, intervalTimestamp }) {
        if (intervalTimestamp) {
            return `${executeTimestamp}-${ufid}-${intervalTimestamp}`
        }
        return `${executeTimestamp}-${ufid}`
    }

    #getLockObjectsFromDir() {
        const locksStrings = fs.readdirSync(`${this.cronDir}`)
        return this.#convertLocksToObjects(locksStrings)
    }

    #setCurrentTimestamp() {
        const currentTime = new Date().getTime();
        this.currentTimestamp = currentTime;
    }

    #setPreviousTimestamp() {
        this.previousTimestamp = this.currentTimestamp
    }

    /**
     * Creates a lock file based on the provided lock object.
     * @param {object} lockObject - The lock object representing the file lock.
     * @param {string} lockObject.ufid - The unique function identifier for the lock.
     * @param {number} lockObject.executeTimestamp - The timestamp for the execution date.
     * @param {number} [lockObject.intervalTimestamp] - The timestamp for the execution date.
     */
    #createLockFileByObject(lockObject) {
        const lockString = this.#convertLockToString(lockObject)
        const fileDir = `${this.cronDir}/${lockString}`
        fs.promises.writeFile(fileDir, `:D`).catch(err => console.log(err))
    }

    /**
     * @param {string} lockString file lock name
     */
    #deleteLockFileByString(lockString) {
        const fileDir = `${this.cronDir}/${lockString}`
        fs.unlinkSync(fileDir);
    }

    #convertDateToTimestamp(date) {
        const dateForm = new Date(date)
        return dateForm.getTime();
    }


    /**
    * Returns a timestamp for the provided time value.
    */
    #calculateTimestamp({ timeUnit, value }) {

        const ENUM_TIMEUNIT = {
            MINUTES: "m",
            HOURS: "h",
            DAYS: "d",
        }
        if (!Object.values(ENUM_TIMEUNIT).includes(timeUnit)) {
            throw new Error(ENUM_ERROR.INVALID_TIME_UNIT);
        }

        switch (timeUnit) {
            case ENUM_TIMEUNIT.MINUTES:
                return value * 60000;
            case ENUM_TIMEUNIT.HOURS:
                return value * 3600000;
            case ENUM_TIMEUNIT.DAYS:
                return value * 86400000;
            default:
                throw new Error(ENUM_ERROR.INVALID_TIME_UNIT);
        }
    }
}



module.exports = Cron;

