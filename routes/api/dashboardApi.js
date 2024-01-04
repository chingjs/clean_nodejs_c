/* eslint-disable camelcase */

const { Router } = require('express');
const { Op } = require('sequelize');
const Code = require('../../configs/tables/Code');
const Order = require('../../configs/tables/Order');
const Inbox = require('../../configs/tables/Inbox');
const Payment = require('../../configs/tables/Payment');
const Bucket = process.env.BUCKETNAME;
const router = Router();
const AWS = require('aws-sdk');
const OrderDetails = require('../../configs/tables/OrderDetails');
const RedeemCode = require('../../configs/tables/RedeemCode');
const s3 = new AWS.S3();
/**
  1.) Get Past Order
  2.) Get Current Order
  3.) Get Collect Order
  4.) Get Payment Order
  5.) Get Deposit Order
  6.) Get Inbox 
  7.) Update Inbox Read true
  8.) Get Total Unread 
*/

// GET PAST ORDER DETAILS
// POST @-> /api/dashboard/getpastorder
// To get all past order details
router.post('/getPastOrder', async (req, res) => {
  const { customerId } = req.body;
  try {
    const data = await Order.findAll({
      where: { customerId: customerId, status: 'completed', cancel: false },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: RedeemCode
        },
        {
          model: OrderDetails
        }
      ]
    })
    const newData = data.map((data) => {
      let orderDetail = data.order_details;
      let orderDetailTrueAmount = orderDetail.reduce((sum, item) => {
        if (item.cancel) {
          return sum + (item.price * item.qty);
        }
        return sum;
      }, 0);

      let orderDetailTrueQuantity = orderDetail.reduce((sum, item) => {
        if (item.cancel) {
          return sum + item.qty;
        }
        return sum;
      }, 0);

      let discountAmount = 0;
      if(data.redeemCode){
        if (data.redeemCode.type === 'Flat') {
          discountAmount = data.redeemCode.amount;
        }
        else {
          discountAmount = (data.price * (data.redeemCode.amount / 100));
        }
      }


      return {
        createdAt: data.createdAt,
        oid: data.oid,
        serviceType: data.serviceType,
        price: data.price,
        createdTime: data.createdTime,
        lockerId: data.lockerId,
        quantity: data.quantity,
        collectLockerId: data.collectLockerId,
        location: data.location,
        note: data.note,
        pick_up_date: data.pick_up_date,
        process_done_time: data.process_done_time,
        delivered_time: data.delivered_time,
        pick_up_time: data.pick_up_time,
        orderDetailAmount: orderDetailTrueAmount,
        orderDetailQuantity: orderDetailTrueQuantity,
        discountAmount: discountAmount,
        status: data.status,
        collectedDate: data.collectedDate
      };
    });

    return res.status(200).json({ pastOrder: newData });
  }
  catch (err) {
    console.error('Error when finding past order ');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET CURRENT ORDER DETAILS
// POST @-> /api/dashboard/getcurrentorder
// To get all current order details
router.post('/getCurrentOrder', (req, res) => {
  const { customerId } = req.body;

  Order.findAll({
    where: {
      customerId: customerId,
      deposit_time: { [Op.ne]: null },
      // cancel: false,
      delivered_time: {
        [Op.eq]: null,
      },
      payment: {
        [Op.eq]: true,
      },
      [Op.not]: { status: 'completed' },
    },
    include: {
      model: RedeemCode
    },
    order: [['createdAt', 'DESC']],

  })
    .then((data) => {
      (async () => {
        let returnData = [];

        for (let i = 0; i < data.length; i++) {
          const order = data[i];

          let discountAmount = 0;
          if (order.redeemCode) {
            if (order.redeemCode.type === 'Flat') {
              discountAmount = order.redeemCode.amount;
            }
            else {
              discountAmount = (order.price * (order.redeemCode.amount / 100));
            }
          }

          let obj = {
            ...order.dataValues,
            images: [],
            discountAmount: discountAmount,
          };
          for (let j = 0; j < order.files.length; j++) {
            const Key = order.files[j];
            const getParam = {
              Bucket,
              Key
            }
            const url = await Promise.resolve(s3.getSignedUrlPromise("getObject", getParam));
            obj.images.push(url)
          }
          returnData.push(obj)
        }

        return returnData
      })()
        .then((savedData) => {
          return res.status(200).json({ currentOrder: savedData });
        })
    })
    .catch((err) => {
      console.error('Error when finding all current order ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
})

// GET COLLECT ORDER DETAILS
// POST @-> /api/dashboard/getcollectorder
// To get all collect order details
router.post('/getCollectOrder', (req, res) => {
  const { customerId } = req.body;

  Order.findAll({
    where: {
      customerId: customerId,
      delivered_time: {
        [Op.ne]: null,
      },
      // cancel: false,
      [Op.not]: { status: 'completed' },
    },
    order: [['createdAt', 'DESC']]
  })
    .then((data) => {
      const newData = data.map((data) => ({
        orderId: data.oid,
        serviceType: data.serviceType,
        price: data.price,
        createdTime: data.createdTime,
        lockerId: data.lockerId,
        collectLockerId: data.collectLockerId,
        quantity: data.quantity,
        location: data.location,
        note: data.note,
        collectDate: data.pick_up_date,
        process_done_time: data.process_done_time,
        delivered_time: data.delivered_time,
        pickup_time: data.pick_up_time,

        status: data.status,
      }));
      return res.status(200).json({ collectOrder: newData });
    })
    .catch((err) => {
      console.error('Error when finding all collect order ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET PAYMENT ORDER DETAILS
// POST @-> /api/dashboard/getpaymentorder
// To get all payment order details
router.post('/getPaymentOrder', async (req, res) => {
  const { customerId } = req.body;
  let paymentOrder = []
  try {
    const payments = await Payment.findAll({})
    const data = await Order.findAll({
      where: {
        customerId: customerId,
        cancel: false,
        payment: {
          [Op.eq]: false,
        },
      },
      include: [
        {
          model: OrderDetails
        },
        {
          model: RedeemCode
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // console.log(data);
    for (let a = 0; a < data.length; a++) {
      let order = data[a]
      const allPaid = payments.filter(p => p.oid === order.oid)
      const totalPaid = allPaid
        .map(a => { return a.amount }).reduce((a, b) => a + b, 0)


      let totalAmountCancelled = 0;
      totalAmountCancelled = order.order_details
        .filter(item => item.cancel === true)
        .map(item => item.price * item.qty)
        .reduce((a, b) => a + b, 0);

       let discountAmount = 0;
      if (order.redeemCode) {
           if (order.redeemCode.type === 'Flat') {
          discountAmount = order.redeemCode.amount;
           }
        else {
          discountAmount = (order.price * (order.redeemCode.amount / 100));
           }
      }

       paymentOrder.push({
        orderId: order.oid,
        serviceType: order.serviceType,
        price: (((order.price - discountAmount) + (order.price - discountAmount) * 0.06) * 100).toFixed(2) - totalPaid - ((totalAmountCancelled + totalAmountCancelled * 0.06) * 100).toFixed(2),
        createdTime: order.createdTime,
        createdAt: order.createdAt,
        lockerId: order.lockerId,
        collectLockerId: order.collectLockerId,
        quantity: order.quantity,
        location: order.location,
        note: order.note,
        payment: order.payment,
        deposit_time: order.deposit_time,
        paymentId: order.paymentId,
        collectDate: order.pick_up_date,
        process_done_time: order.process_done_time,
        delivered_time: order.delivered_time,
        pickup_time: order.pick_up_time,
        status: order.status,
      })
    }
    return res.status(200).json({ paymentOrder });
  }
  catch (err) {
    console.error('Error when finding all payment order ');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});
// GET DEPOSIT ORDER DETAILS
// POST @-> /api/dashboard/getdepositorder
// To get all deposit order details
router.post('/getDepositOrder', (req, res) => {
  const { customerId } = req.body;

  Order.findAll({
    where: {
      customerId: customerId,
      cancel: false,
      payment: {
        [Op.ne]: false,
      },
      deposit_time: { [Op.eq]: null },
    },
    order: [['createdAt', 'DESC']]
  })
    .then((data) => {
      const newData = data.map((data) => ({
        orderId: data.oid,
        serviceType: data.serviceType,
        price: data.price,
        createdTime: data.createdTime,
        lockerId: data.lockerId,
        collectLockerId: data.collectLockerId,
        quantity: data.quantity,
        location: data.location,
        note: data.note,
        payment: data.payment,
        paymentId: data.paymentId,
        collectDate: data.pick_up_date,
        process_done_time: data.process_done_time,
        delivered_time: data.delivered_time,
        pickup_time: data.pick_up_time,

        status: data.status,
      }));
      return res.status(200).json({ depositOrder: newData });
    })
    .catch((err) => {
      console.error('Error when finding all deposit order ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET ALL INBOX DETAILS
// POST @-> /api/dashboard/getAllInbox
// To get all inbox details
router.post('/getAllInbox', (req, res) => {
  const { phone_number } = req.body;

  Inbox.findAll({
    where: {
      phone_number,
    },
    order: [['read'], ['createdAt', 'DESC']],
  })
    .then((data) => {
      return res.status(200).json({ inbox: data });
    })
    .catch((err) => {
      console.error('Error when finding all inbox details ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// UPDATE READ TRUE
// POST @-> /api/dashboard/updateInbox
// To update Inbox
router.post('/updateInbox', (req, res) => {
  const { id } = req.body;

  Inbox.findOne({ where: { id } })
    .then((foundInbox) => {
      if (!foundInbox) {
        return res
          .status(200)
          .json({ error: 'Inbox not found, please try again.' });
      } else {
        foundInbox.read = true;
        foundInbox.save().then((savedRecord) => {
          return res.status(200).json('updated inbox');
        });
      }
    })
    .catch(() => {
      res.status(400).json({ error: 'Server Error' });
    });
});

// GET TOTAL UNREAD
// POST @-> /api/dashboard/getUnread
// To get total unread
router.post('/getUnread', (req, res) => {
  const { phone_number } = req.body;

  Inbox.findAll({
    where: {
      phone_number,
      read: false,
    },
    order: [['createdAt', 'DESC']]
  })
    .then((data) => {
      return res.status(200).json({ unread: data });
    })
    .catch((err) => {
      console.error('Error when find total unread ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

module.exports = router;
