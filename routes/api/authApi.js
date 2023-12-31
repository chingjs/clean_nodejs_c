/* eslint-disable camelcase */
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const catchSync = require('express-async-handler');
const { checkNumber } = require('../../configs/function/validate');

const Customer = require('../../configs/tables/Customer');
const Operator = require('../../configs/tables/Operator');
const Otp = require('../../configs/tables/Otp');
const { sendSMS } = require('../../configs/function/sms');
const {
  registrationMessage,
} = require('../../configs/function/dynamicController');

const generateOtp = (callback) => {
  const max = 9999;
  const min = 1111;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`Generated OTP : ${otp}`);
  callback(otp);
};
const router = express.Router();

const User = {
  Customer,
  Operator,
};

/**
    1.) Customer LOGIN 
    2.) Resend OTP
*/

// LOGIN
// POST @-> /api/auth/login
// customer login

router.post('/login', (req, res) => {
  const { phone_number, password } = req.body;

  Customer.findOne({ where: { phone_number: phone_number, verified: true } })
    .then((foundCustomer) => {
      if (!foundCustomer) {
        console.error('User phone not found after sso pass');
        console.error(req.body);
        return res
          .status(400)
          .json({
            error: 'This user is not registered. Please head to sign up page.',
          });
      } else {
        bcrypt.compare(password, foundCustomer.password, (err, result) => {
          if (err) return res.status(400).json({ error: 'Decryption Error' });

          if (!result)
            return res
              .status(400)
              .json({ error: "You've entered the wrong password" });

          jwt.sign(
            { id: foundCustomer.id },
            process.env.JWT_SECRET,
            { expiresIn: '6h' },
            (err, token) => {
              if (err) {
                console.error(
                  'Error when signing customer token in customer login'
                );
                console.error(err);
                return res.status(400).json({ error: 'Internal Error' });
              }
              const returnThis = {
                token,
                user: foundCustomer,
              };
              return res.status(200).json(returnThis);
            }
          );
        });
        // jwt.sign(
        //   { id: foundCustomer.id },
        //   process.env.JWT_SECRET,
        //   { expiresIn: '6h' },
        //   (err, token) => {
        //     if (err) {
        //       console.error(
        //         'Error when signing customer token in customer login'
        //       );
        //       console.error(err);
        //       return res.status(400).json({ error: 'Internal Error' });
        //     }
        //     const returnThis = {
        //       token,
        //       user: foundCustomer,
        //     };
        //     return res.status(200).json(returnThis);
        //   }
        // );
      }
    })
    .catch((err) => {
      console.error('Error when finding Customer in Customer login');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// RESEND OTP
// POST @-> /api/auth/resendOtp
// resend otp

router.post('/resendOtp', (req, res) => {
  const { phone } = req.body;
  const operatorId = req.body.operatorCode;
  Customer.findOne({ where: { phone_number: phone } })
    .then((foundRecord) => {
      if (!foundRecord) {
        return res
          .status(400)
          .json({
            error: "This phone number doesn't have an account. Please sign up.",
          });
      } else {
        Otp.findOne({ where: { phone_number: phone } }).then((foundOtp) => {
          if (!foundOtp) {
            generateOtp((otp) => {
              const newOtp = Otp.build({
                phone_number: phone,
                otp,
              });
              const message = registrationMessage(otp);
              const type = 'register'
              newOtp
                .save()
                .then((savedOtp) => {
                  sendSMS(savedOtp.phone_number, message, type, () =>
                    res
                      .status(200)
                      .json({ status: 200, message: 'OTP Sent!' })
                  );
                })
                .catch((err) => {
                  console.log('Error when saving otp in resendOtp');
                  console.log(err);
                  return res.status(400).json({ error: 'Internal Error' });
                });
            });
          } else {
            generateOtp((otp) => {
              foundOtp.otp = otp;
              const message = registrationMessage(otp);
              const type = 'register'
              foundOtp
                .save()
                .then((savedOtp) => {
                  sendSMS(savedOtp.phone_number, message, type, () =>
                    res
                      .status(200)
                      .json({ status: 200, message: 'OTP Sent!' })
                  );
                })
                .catch((err) => {
                  console.log('Error when saving otp in resendOtp');
                  console.log(err);
                  return res.status(400).json({ error: 'Internal Error' });
                });
            });
          }
        });
      }
    })
    .catch((err) => {
      console.log('Error when finding customer in resendOtp');
      console.log(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

module.exports = router;
