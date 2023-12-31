const Sequence = require('../tables/Sequence');
const Locker = require('../tables/Locker');
const Order = require('../tables/Order');
const ActivityLog = require('../tables/ActivityLog');
const LockerDetails = require('../tables/LockerDetails');
const fetch = require('node-fetch');
require('dotenv').config();
const { sendEmail } = require('../sendEmail');
const { Op } = require('sequelize');
const encoded = Buffer.from(
  `${process.env.lockerClientId}:${process.env.lockerClientSecret}`
).toString('base64');
const moment = require('moment');
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${encoded}`,
};

const makeid = (length) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const sqlDate = (d) => {
  const date = d ? new Date(d) : new Date();
  const year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();

  if (month.toString().length < 2) month = `0${month}`;
  if (day.toString().length < 2) day = `0${day}`;

  return `${year}-${month}-${day}`;
};

const generateIdShort = (length) => {
  let result = '';
  const characters = '01234567890123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const genNewCustomerNum = (type, callback) => {
  Sequence.findOne({ where: { type } })
    .then((foundSequence) => {
      if (!foundSequence) callback('Wrong parameter value provided.');

      Sequence.update(
        { currentSequence: foundSequence.currentSequence + 1 },
        { where: { type, updatedAt: foundSequence.updatedAt } }
      )
        .then((updated) => {
          if (updated[0] === 1) {
            const prefix = 'CUS';
            const maxLength = 8;
            const currentSequence = foundSequence.currentSequence;
            const currentSequenceLength = currentSequence.toString().length;
            let trackingNumber = '';
            for (let i = maxLength - currentSequenceLength; i > 0; i--) {
              trackingNumber += '0';
            }
            const trackingId = `${prefix}${trackingNumber}${currentSequence}`;
            callback(null, trackingId);
          } else {
            console.log('Tracking ID Recursion');
            genNewCustomerNum(type, callback);
          }
        })
        .catch((err) => {
          console.error('Error when updating tracking ID sequence');
          console.error(err);
          callback('Internal Error');
        });
    })
    .catch((err) => {
      console.error('Error when finding sequence in new tracking format');
      console.error(err);
      callback('Internal Error');
    });
};

const genNewOrderNum = (type, callback) => {
  Sequence.findOne({ where: { type } })
    .then((foundSequence) => {
      if (!foundSequence) callback('Wrong parameter value provided.');

      Sequence.update(
        { currentSequence: foundSequence.currentSequence + 1 },
        { where: { type, updatedAt: foundSequence.updatedAt } }
      )
        .then((updated) => {
          if (updated[0] === 1) {
            const prefix = 'MC';
            const maxLength = 8;
            const currentSequence = foundSequence.currentSequence;
            const currentSequenceLength = currentSequence.toString().length;
            let trackingNumber = '';
            for (let i = maxLength - currentSequenceLength; i > 0; i--) {
              trackingNumber += '0';
            }
            const trackingId = `${prefix}${trackingNumber}${currentSequence}`;
            callback(null, trackingId);
          } else {
            console.log('Tracking ID Recursion');
            genNewOrderNum(type, callback);
          }
        })
        .catch((err) => {
          console.error('Error when updating tracking ID sequence');
          console.error(err);
          callback('Internal Error');
        });
    })
    .catch((err) => {
      console.error('Error when finding sequence in new tracking format');
      console.error(err);
      callback('Internal Error');
    });
};

const genNewOperatorNum = (type, callback) => {
  Sequence.findOne({ where: { type } })
    .then((foundSequence) => {
      if (!foundSequence) callback('Wrong parameter value provided.');

      Sequence.update(
        { currentSequence: foundSequence.currentSequence + 1 },
        { where: { type, updatedAt: foundSequence.updatedAt } }
      )
        .then((updated) => {
          if (updated[0] === 1) {
            const prefix = 'DR';
            const maxLength = 8;
            const currentSequence = foundSequence.currentSequence;
            const currentSequenceLength = currentSequence.toString().length;
            let trackingNumber = '';
            for (let i = maxLength - currentSequenceLength; i > 0; i--) {
              trackingNumber += '0';
            }
            const trackingId = `${prefix}${trackingNumber}${currentSequence}`;
            callback(null, trackingId);
          } else {
            console.log('Tracking ID Recursion');
            genNewOperatorNum(type, callback);
          }
        })
        .catch((err) => {
          console.error('Error when updating tracking ID sequence');
          console.error(err);
          callback('Internal Error');
        });
    })
    .catch((err) => {
      console.error('Error when finding sequence in new tracking format');
      console.error(err);
      callback('Internal Error');
    });
};

const genNewTaskNum = (type, callback) => {
  Sequence.findOne({ where: { type } })
    .then((foundSequence) => {
      if (!foundSequence) callback('Wrong parameter value provided.');

      Sequence.update(
        { currentSequence: foundSequence.currentSequence + 1 },
        { where: { type, updatedAt: foundSequence.updatedAt } }
      )
        .then((updated) => {
          if (updated[0] === 1) {
            const prefix = 'TA';
            const maxLength = 8;
            const currentSequence = foundSequence.currentSequence;
            const currentSequenceLength = currentSequence.toString().length;
            let trackingNumber = '';
            for (let i = maxLength - currentSequenceLength; i > 0; i--) {
              trackingNumber += '0';
            }
            const trackingId = `${prefix}${trackingNumber}${currentSequence}`;
            callback(null, trackingId);
          } else {
            console.log('Tracking ID Recursion');
            genNewTaskNum(type, callback);
          }
        })
        .catch((err) => {
          console.error('Error when updating tracking ID sequence');
          console.error(err);
          callback('Internal Error');
        });
    })
    .catch((err) => {
      console.error('Error when finding sequence in new tracking format');
      console.error(err);
      callback('Internal Error');
    });
};

const deductGenNum = (type, callback) => {
  Sequence.findOne({ where: { type } })
    .then((foundSequence) => {
      if (!foundSequence) callback('Wrong parameter value provided.');

      Sequence.update(
        { currentSequence: foundSequence.currentSequence - 1 },
        { where: { type } }
      )
        .then((updated) => {
          console.log('deducted 1');
        })
        .catch((err) => {
          console.error('Error when updating tracking ID sequence');
          console.error(err);
          callback('Internal Error');
        });
    })
    .catch((err) => {
      console.error('Error when finding sequence in new tracking format');
      console.error(err);
      callback('Internal Error');
    });
};

const syncLockerSlot = async (lockerId, callback) => {
  Locker.findOne({ where: { id: lockerId } }).then((found) => {
    if (found && !found.deviceId) {
      // check old locker
      fetch(`${found.url}/lockers/GetAll`, {
        headers,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.length) {
            LockerDetails.findAll({ where: { lockerId: found.id } })
              .then((foundlocations) => {
                let slotObject = {};
                data.map((e) => (slotObject[e.name] = e));
                if (foundlocations.length) {
                  for (let i = 0; i < foundlocations.length; i++) {
                    const slotName = foundlocations[i].name;
                    (foundlocations[i].lock = slotObject[slotName].lock),
                      (foundlocations[i].empty = slotObject[slotName].empty),
                      foundlocations[i].save();
                  }
                  callback('updated');
                }
              })
              .catch((error) => {
                console.log('error update', error);
                callback('failed');
              });
          } else {
            console.log('Locker is offline');
            callback('failed');
          }
        })
        .catch((err) => {
          console.log('url not found');
          callback('failed');
        });
    } else if (found && found.deviceId) {
      //check new locker
      LockerDetails.findAll({ where: { lockerId: found.id } })
        .then(async (foundLocker) => {
          if (!foundLocker.length) {
            for (let i = 0; i < 14; i++) {
              const newSlot = LockerDetails.build({
                name: 'Locker_' + (i + 1),
                address: i,
                lock: true,
                empty: true,
                location: found.city,
                lockerId,
              });
              newSlot.save().then((saveSlot) => {});
            }
            callback('updated');
          } else if (foundLocker.length) {
            console.log('found url', found.deviceId);
            const requestPromise = await fetch(`${found.url}/locker1/getAll`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: { ID: found.deviceId },
            });

            if (requestPromise) {
              callback('updated');
            } else {
              callback('failed');
            }
          }
        })
        .catch((error) => {
          console.log('error update', error);
          callback('failed');
        });
    } else {
      callback('failed');
      console.log('lockerID not found');
    }
  });
};

const sendMonthlyReport = async () => {
  const date = new Date();

  const month = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  try {
    const orders = await Order.findAll({
      where: {
        payment: true,
        cancel: false,
        createdAt: {
          [Op.between]: [
            moment(
              new Date(`${date.getFullYear()}-${month[date.getMonth() - 1]}-1`)
            )
              .startOf('month')
              .format(),
            moment(
              new Date(`${date.getFullYear()}-${month[date.getMonth() - 1]}-1`)
            )
              .endOf('month')
              .format(),
          ],
        },
      },
    });

    let hqOrder = orders.filter((o) => o.location === 'HQ');
    let hqAmount = hqOrder
      .map((h) => h.price)
      .reduce((a, b) => a + b, 0)
      .toFixed(2);
    let LYOrder = orders.filter((l) => l.location === 'Le Yuan');
    let LYAmount = LYOrder.map((h) => h.price)
      .reduce((a, b) => a + b, 0)
      .toFixed(2);
    let CameliaOrder = orders.filter((c) => c.location === 'Camellia');
    let CameliaAmount = CameliaOrder.map((h) => h.price)
      .reduce((a, b) => a + b, 0)
      .toFixed(2);

    let hqCharges = hqAmount * 0.08 > 50 ? (hqAmount * 0.08).toFixed(2) : 50;
    let LYCharges = LYAmount * 0.08 > 50 ? (LYAmount * 0.08).toFixed(2) : 50;
    let CameliaCharges =
      CameliaAmount * 0.08 > 50 ? (CameliaAmount * 0.08).toFixed(2) : 50;
    // console.log('hq orders', hqOrder.length);
    // console.log('ly orders', LYOrder.length);
    // console.log('cam orders', CameliaOrder.length);

    let html = `
    <style>
    table, th, td {
  border:1px solid black;
  text-align:center;
     }

    </style>
     <div> 
     <table style="width:85%">
  <tr>
  <td>Locker</td>
  <td>Total Orders</td>
  <td>Total Amount</td>
  <td>Charges</td>
  </tr>
  <tr>
    <td>Desa Pandan (HQ)</td>
    <td>${hqOrder.length}</td>
    <td>RM ${hqAmount}</td>
    <td>RM ${hqCharges}</td>
   </tr>
  <tr>
  <td>Residence</td>
  <td>${LYOrder.length}</td>
  <td>RM ${LYAmount}</td>
  <td>RM ${LYCharges}</td>
</tr>
  <tr>
  <td>Serviced Suites</td>
  <td>${CameliaOrder.length}</td>
  <td>RM ${CameliaAmount}</td>
  <td>RM ${CameliaCharges}</td>
 </tr>
</table>
<br/>
    <p>Total charges for this month are RM ${(
      parseFloat(hqCharges) +
      parseFloat(LYCharges) +
      parseFloat(CameliaCharges)
    ).toFixed(2)}. </p> </div>`;

    let message = `Total amount for this month is RM ${hqOrder.length}`;
    console.log('sending email');
    sendEmail(
      ['js.tew@antlysis.com', 'hzchin@antlysis.com'],
      {
        name: 'Antlysis',
        csEmail: 'js.tew@antlysis.com',
        message: message,
        html: html,
      },
      'support',
      `[test] ${month[date.getMonth() - 1]}'s Sales Report`
    );

    const newLog = ActivityLog.build({
      type: 'MonthlyReport',
      name: 'Sales Report',
    });
    await newLog.save();
  } catch (err) {
    console.error('Error to save new record', err);
    console.error(err);
  }
};



module.exports = {
  makeid,
  generateIdShort,
  genNewCustomerNum,
  genNewOrderNum,
  genNewOperatorNum,
  genNewTaskNum,
  deductGenNum,
  syncLockerSlot,
  sqlDate,
  sendMonthlyReport,
};
