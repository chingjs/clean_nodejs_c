require("dotenv").config();

const registrationMessage = otp => {
	return `Your OTP code is ${otp}`;
};

const collectMessage = oid => {
	return `Your order ${oid} delivered back to the locker. Please collect within 48 hours to avoid a late penalty.`;
};
const rescheduleMessage = (oid,date) => {
	return `Your order ${oid} has been reschedule to ${date}.`;
};

module.exports = {
	registrationMessage,
	collectMessage,
	rescheduleMessage,
};
