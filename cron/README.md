# CRON

The module allowing for the activation of functions at specified times/at regular intervals within your application.

1. [Features](#Features)
2. [Implementation](#Implementation)
3. [Service](#Service)
4. [Mechanism](#Mechanism)

## Features

- Creating schedules for one-time activation
- Creating recurring schedules
- Deleting schedules
- Guaranteeing that a function is not executed more than a specified number of times (including when operating on multiple machines simultaneously with shared disk space)
- Automatic activation of cron (when its operation is required)
- Automatic reactivation of schedules in case of failure

## Implementation

1.  Nest a folder within your project.
2.  Creating an instance. In the constructor, provide the directory path where cron will be able to store data.

```shell
cron  =  new  Cron('files/cron')
```

## Service

**addUfidActivateFunction({ufid, activateFunction})**
It creates a mapping between UFID and the activate function. Based on this relationship,
we will be able to activate the specified function using the provided UFID.
It throws an error if this UFID is already used in any relationship.

```shell
cron.addUfidActivateFunction({
	ufid:  'theUniqueFunctionIdentificator', activateFunction: () => {
	functionToActivate()
}
})
```

> ufid - The unique function identificator
> activateFunction - The function to be invoked for a given UFID

**createSchedule({ executeDate, ufid, intervalTime })**
It sets up the activation schedule for the function with the provided UFID.
If intervalTime is provided, the function will execute cyclically at the specified intervalTime,
if we set an interval, it will be the first activation date. If not provided, the first activation date of the interval will be closest to the tick function activation. It starts the cron interval if it's not already enabled. Throws an error in case of failure.

a) term (one-time execute)
To set the one-time execution schedule for a specific function, provide the UFID of the function to be executed and execute date. If a schedule with the same date and UFID already exists, an error will be thrown.

```shell
cron.createSchedule({ ufid:  'theUniqueFunctionIdentificator', executeDate:  '2024-02-19T23:46:50' })
```

> ufid - The unique function identificator
> executeDate - date in ISO 8601 form

b) interval (recurring execution)
To set the schedule for recurring execution of a specific function, provide the UFID of the function to be executed, as well as the intervalTime (the time interval at which it should be executed). Optionally, you can also provide the executeDate (the date of the first activation of the function). If the interval with the given UFID is already active, the function will return an error.

```shell
cron.createSchedule({ ufid:  'theUniqueFunctionIdentificator', intervalTime: { timeUnit:  'm', value:  1 } })
```

> ufid - The unique function identificator
> intervalTime :  
>  -timeUnit avaible: 'm' 'h' 'd'
> -value (value for providen time unit)

**cron.removeSchedule({ ufid: 'logCurrentDate', executeDate: '2024-02-21T23:46:50', isLockInterval: false })**
Removes the activation schedule for the given UFID.

```shell
cron.removeSchedule({ ufid:  'logCurrentDate', executeDate:  '2024-02-21T23:46:50',isLockInterval: false})
```

> ufid - The unique function identificator of schedule we want to remove
> executeDate - to remove one time execution schedule provice execute date in ISO 8601 form. In case of removing an interval, do not provide.
> isLockInterval - boolean - does the schedule we want to delete have an interval type

## Mechanism

**What are locks and their types?**

The mechanism is based on locks. These are files in which data is contained. Locks are divided into two types: interval locks and term locks. Each lock contains:

- executeTimestamp: the activation date of the lock, expressed in timestamp
- ufid: the unique ID of the function to be executed

If the lock is of the interval type, it also contains information about how often it should be executed (also expressed in timestamp):

- intervalTimestamp

Locks are stored in the path defined in the constructor.

**How are todo locks collected (without skipping any locks)?**

The cron has an interval set to execute the "tick" function every 30 seconds. The tick function collects locks from the range between the previous execution time of the tick function plus 30 seconds to the current time plus 30 seconds. This is necessary because the current time may not always be 30 seconds greater than the previous execution time. This ensures that no locks are skipped.

**What is the handling of a single lock like?**

The cron collects todo locks and then iterates over them, executing the handleLockObject function for each lock. The sequence of operations in the handleLockObject function:

1.  Removes the given lock. a) If the deletion returns an error, it means that the lock no longer exists, indicating that another process has already handled it. The function is then terminated.
2.  If the lock is of the interval type, a new lock with the same data (ufid and intervaltimestamp) is created, but its executeTimestamp is set to the current date plus intervaltimestamp.
3.  Finds the function from the "ufidFunctions" for the given ufid and activates it.

**Thanks to the use of the Singleton design pattern, we have global access to the instance variables of the cron in various modules of our application.**

**When is the cron interval started?**

When an instance is created, it checks if there are any interval locks or other locks with an executeTime greater than the current time. If such files are found, the cron is started. Another way to start it is by calling the "createSchedule" function.

# Author

Hubert Rutkowski
