const numberRegex = /^\d+$/; // <- only number can exist

const checkNumber = (country, number, callback) => {
  if (country === "60") {
    const customer_phone = country.substr(1, 1) + number
    if (!customer_phone) {
      callback('Please fill in all the credentials input');
    }
    else if (
      numberRegex.test(customer_phone) &&
      customer_phone.length > 9 &&
      customer_phone.length < 12 &&
      customer_phone.substr(0, 2) === '01'
    ) {
      callback();
    }
    else {
      callback(
        "Please enter a valid phone number: Starts with '1'"
      );
    }
  }
  else {
    if (!number) {
      console.error('no number in req.body');
      callback('Please fill in all the credentials input');
    }
    else if (
      numberRegex.test(number) &&
      number.length >= 8 &&
      number.length < 15 
    ) {
      callback();
    }
    else {
      callback(
        "Please enter a valid phone number"
      );
    }
  }


};

const checkIc = (ic, callback) => {
  if (!ic) {
    console.error('no ic in req.body');
    callback('Please fill in all the credentials input');
  } else if (numberRegex.test(ic) && ic.length === 12) {
    callback();
  } else {
    console.error('wrong ic format : ', ic);
    callback('Please enter the correct IC Number format');
  }
};

module.exports = {
  checkNumber,
  checkIc,
};
