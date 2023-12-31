/* eslint-disable no-console */
require('dotenv').config();
const fetch = require('node-fetch');
const Admin = require('../tables/Admin');
const Otp = require('../tables/Otp');
const { Op } = require('sequelize');
const SMS = require('../tables/SMS');
const Logs = require('../tables/ActivityLog');
// const { APIUSERNAME, APIPASSWORD, NODE_ENV } = process.env;
const { APIUSERNAME, APIPASSWORD, NODE_ENV, APICOMPANY, SMSTYPE } = process.env;

const generateOtp = (callback) => {
  const max = 9999;
  const min = 1111;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`Generated OTP : ${otp}`);
  callback(otp);
};


const sendSMS = async (phone_number, message, type, callback) => {
  try {
    const phone = ['1234', '456'];

    if (type === 'Offline' && process.env.NODE_ENV !== 'test') {
  
      const searchLog = await Logs.findAll({
        where: {
          type: type,
        },
        order: [['createdAt', 'DESC']],
        limit: 3,
      });
      const timeDifference = Math.abs(
        searchLog[0].createdAt - searchLog[2].createdAt
      );
      const hoursDifference = timeDifference / (1000 * 60 * 60);
      if (hoursDifference >= 1) {
        const newLog = Logs.build({
          name: message,
          type: type,
        });

        await newLog.save();

        for (let i = 0; i < phone.length; i++) {
          const newSMS = SMS.build({ phone_number: phone[i], message, type });
          const saveSMS = await newSMS.save();
          if (saveSMS) {
            await fetch(
              `https://smshubs.net/api/sendsms.php?email=${APIUSERNAME}&key=${APIPASSWORD}&recipient=${phone[i]}&&message=${APICOMPANY}: ${message}`
            );
            callback('Sent sms');
          }
        }
      } else {
        // Time difference is less than 1 hour. Skipping log creation.
        callback();
      }
    } else if (type === 'Online' && process.env.NODE_ENV !== 'test') {
      const searchLog = await Logs.findAll({
        where: {
          type: { [Op.in]: ['Online', 'Offline'] },
        },
        order: [['createdAt', 'DESC']],
      });
      if (searchLog[0].type === 'Offline') {
        const newLog = Logs.build({
          name: message,
          type: type,
        });
        await newLog.save();
        for (let i = 0; i < phone.length; i++) {
          const newSMS = SMS.build({ phone_number: phone[i], message, type });
          const saveSMS = await newSMS.save();
          if (saveSMS) {
            await fetch(
              `https://smshubs.net/api/sendsms.php?email=${APIUSERNAME}&key=${APIPASSWORD}&recipient=${phone[i]}&&message=${APICOMPANY}: ${message}`
            );
            callback('Sent sms');
          }
        }
      }
    } else {
      const newSMS = SMS.build({ phone_number, message, type });
      const saveSMS = await newSMS.save();
      if (saveSMS) {
        await fetch(
          `https://smshubs.net/api/sendsms.php?email=${APIUSERNAME}&key=${APIPASSWORD}&recipient=${phone_number}&&message=${APICOMPANY}: ${message}`
        );
        callback();
      }
    }
  } catch (err) {
    console.error('Error when sending SMS : ');
    console.error(err);
    callback();
  }
};

module.exports = {
  generateOtp,
  sendSMS,
};
