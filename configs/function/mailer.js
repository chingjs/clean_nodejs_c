const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
	host: "smtp.hostinger.com",
	port: 465,
	// secure: false,
	auth: {
		user: "js",
		pass: "js",
	}
});

transporter.verify(function (error, success) {
	if (error) {
		console.log(error);
	} else {
		console.log("Server is ready to take our messages");
	}
});