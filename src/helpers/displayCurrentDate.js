function displayCurrentDate() {
    const currentDate = new Date();
    console.log(`Aktualna data to: ${currentDate.toISOString()}`);
}

module.exports = displayCurrentDate;
