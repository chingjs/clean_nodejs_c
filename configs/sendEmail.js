const hbs = require('nodemailer-express-handlebars');
const nodemailer = require('nodemailer');
const path = require('path');

const sendEmail = (userEmail, content, template, subject) => {
  const transporter = nodemailer.createTransport({
    host: 'test.com.my',
    port: 465,
    secure: true,
    auth: {
      user: 'support@test',
      pass: process.env.MAIL_PASS,
    },
  });
  const handlebarOptions = {
    viewEngine: {
      partialsDir: path.resolve('./configs/email/'),
      defaultLayout: false,
    },
    viewPath: path.resolve('./configs/email/'),
    extname: '.handlebars',
  };

  transporter.use('compile', hbs(handlebarOptions));

  let mailOptions;
  mailOptions = {
    from: 'js.tew@antlysis.com',
    to: userEmail,
    subject: subject,
    template: template, 
    context: content,
    html: content.html,
  };

  return transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    return console.log(`Message sent email: ${info.response}`);
  });
};

module.exports = { sendEmail };
