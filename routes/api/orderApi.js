/* eslint-disable camelcase */
const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const Order = require('../../configs/tables/Order');
const Inbox = require('../../configs/tables/Inbox');
const Refund = require('../../configs/tables/Refund');
const Record = require('../../configs/tables/Record');
const Fabric = require('../../configs/tables/Fabric');
const Charges = require('../../configs/tables/Charges');
const Payment = require('../../configs/tables/Payment');
const Discount = require('../../configs/tables/Discount');
const Operator = require('../../configs/tables/Operator');
const Customer = require('../../configs/tables/Customer');
const RedeemCode = require('../../configs/tables/RedeemCode');
const Reschedule = require('../../configs/tables/Reschedule');
const ActivityLog = require('../../configs/tables/ActivityLog');
const OrderDetails = require('../../configs/tables/OrderDetails');
const ServiceTypes = require('../../configs/tables/ServiceTypes');
const LockerDetails = require('../../configs/tables/LockerDetails');

const SlackError = require('../../configs/function/slackBot');
const moment = require('moment');
const { uploadtos3 } = require('../../configs/function/aws');
const {
  makeid,
  genNewOrderNum,
  genNewTaskNum,
  deductGenNum,
  syncLockerSlot,
  sendMonthlyReport,
} = require('../../configs/function/misc');
const Bucket = process.env.BUCKETNAME;
const router = Router();
const rmClientId = process.env.rmClientID;
const rmClientSecret = process.env.rmClientSecret;
const rmStoreId = process.env.rmStoreId;
const serverPrivateKey = fs.readFileSync(
  path.join(__dirname, '..', '..', 'credentials', 'privKey.pem'),
  'utf-8'
);
const schedule = require('node-schedule');
const { Op } = require('sequelize');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const getPaymentUrl = require('../../configs/function/rm');
const {
  collectMessage,
  rescheduleMessage,
} = require('../../configs/function/dynamicController');
const { sendSMS } = require('../../configs/function/sms');
const { CustomerProfiles } = require('aws-sdk');
const { json } = require('../../configs/sequelize');
const Admin = require('../../configs/tables/Admin');
const Locker = require('../../configs/tables/Locker');
const { Console } = require('console');
/**
  1.) Create order
  2.) Get all order for 1 customer
  3.) Update order
  4.) UpdatePickUp
  5.) UpdateDelivery
  6.) UpdatePayment Status
  7.) Repayment
  8.) Cancel Order
*/

// Create Order
// POST @-> /api/order/create
// To create service
router.post('/create', (req, res) => {
  const {
    phone_number,
    pick_up_date,
    files,
    quantity,
    totalOrder,
    customerId,
    serviceType,
    serviceTypeId,
    lockerId,
    itemList,
    note,
    location,
    totalWithTax,
    codeData,
  } = req.body;

  const tempKey = [];
  if (files.length) {
    files.forEach((file, idx) => {
      const regex = /^data:image\/\w+;base64,/;
      const body = Buffer.from(file.uri.replace(regex, ''), 'base64');
      const tempId = makeid(6);
      const filetype = file.fileType;
      const Key = `/order/photo/${phone_number}/${tempId}`;
      tempKey.push(Key);
      uploadtos3(Key, body, 'base64', filetype, (status) => {
        if (status === 'failed') {
          console.log('Failed');
          console.error('S3 image upload failed.');
          return res.status(400).json({ error: 'Image Upload Failed' });
        }
      });
    });
  }

  genNewOrderNum('ORDER', (err, oid) => {
    if (err) return res.status(400).json({ error: 'Internal Error' });
    const newOrder = Order.build({
      oid,
      pick_up_date,
      files: tempKey,
      phone_number,
      quantity,
      price: totalOrder,
      location,
      customerId,
      serviceType,
      serviceTypeId,
      lockerId,
      note,
      payment: false,
      status: 'active',
      redeemCodeId: codeData ? codeData.id : null,
    });
    newOrder
      .save()
      .then((savedOrder) => {
        (async () => {
          for (let i = 0; i < itemList.length; i++) {
            const newCard = OrderDetails.build({
              location,
              orderNo: savedOrder.oid,
              phone_number,
              item: itemList[i].name,
              fabricId: itemList[i].id,
              qty: itemList[i].qty,
              price: itemList[i].price,
              orderId: savedOrder.id,
            });
            newCard.save();
          }
        })()
          .then(() => {
            if (savedOrder.redeemCodeId) {
              const title = 'test';
              const detail = 'CLEANING_SERVICES';
              const additionalData = savedOrder.oid;

              let discountAmount = 0;
              let payAmount = 0;
              if (foundCode.type === 'Flat') {
                discountAmount = totalOrder - foundCode.amount;
                payAmount = discountAmount + discountAmount * 0.06;
                payAmount = parseInt(payAmount * 100);
              } else {
                discountAmount =
                  totalOrder - totalOrder * (foundCode.amount / 100);
                payAmount = discountAmount + discountAmount * 0.06;
                payAmount = parseInt(payAmount * 100);
              }

              if (discountAmount <= 0) {
                discountAmount = totalOrder;
              }

              if (payAmount <= 0) {
                payAmount = 0;
              }
              if (payAmount != 0) {
                getPaymentUrl(
                  {
                    outletId: 'test',
                    rmClientId,
                    rmClientSecret,
                    rmStoreId,
                    serverPrivateKey,
                  },
                  { title, detail, additionalData, payAmount },
                  (err, data) => {
                    if (err)
                      return res.status(400).json({ error: err.message });
                    return res
                      .status(200)
                      .json({ url: data.url, succesOrder: data.order });
                  }
                );
              } else {
                Payment.build({
                  orderId: savedOrder.id,
                  oid: savedOrder.oid,
                  amount: payAmount,
                  method: 'CODE',
                })
                  .save()
                  .then(() => {
                    Discount.build({
                      discountCode: foundCode.code,
                      discountAmount: foundCode.amount,
                      discountType: foundCode.type,
                      redeemCodeId: foundCode.id,
                      customerId: savedOrder.customerId,
                      orderId: savedOrder.id,
                      totalDeductAmount: discountAmount,
                    })
                      .save()
                      .then((saveDiscount) => {
                        if (saveDiscount) {
                          savedOrder.payment = true;
                          savedOrder
                            .save()
                            .then((updateOrder) => {
                              if (updateOrder) {
                                return res
                                  .status(200)
                                  .json({ code: 'Paid by code' });
                              }
                            })
                            .catch((err) => {
                              console.error(
                                'Failed to update the order payment',
                                err
                              );
                              return res.status(400).json({
                                error: 'Failed to update the order payment',
                              });
                            });
                        }
                      })
                      .catch((err) => {
                        console.error(
                          'Failed to saved the order discount',
                          err
                        );
                        return res.status(400).json({
                          error: 'Failed to saved the order discount',
                        });
                      });
                  })
                  .catch((err) => {
                    console.error('Failed to saved the payment', err);
                    return res
                      .status(400)
                      .json({ error: 'Failed to saved the payment' });
                  });
              }


            } else {
              const title = 'test';
              const detail = 'CLEANING_SERVICES';
              const additionalData = savedOrder.oid;
              const payAmount = parseInt(totalWithTax * 100);
              getPaymentUrl(
                {
                  outletId: 'SmartLocker',
                  rmClientId,
                  rmClientSecret,
                  rmStoreId,
                  serverPrivateKey,
                },
                { title, detail, additionalData, payAmount },
                (err, data) => {
                  if (err) return res.status(400).json({ error: err.message });
                  return res
                    .status(200)
                    .json({ url: data.url, succesOrder: data.order });
                }
              );
            }
          })
          .catch(() => {
            deductGenNum('ORDER', () => {
              console.log('failed and deducted!');
            });
          });
      })
      .catch((err) => {
        console.error('Error to generate new unique id', err);
        console.error(err);
        return res.status(400).json({ error: 'Internal Error' });
      });
  });
});

// GET ALL ORDER DETAILS
// POST @-> /api/order/
// To get all order details by customer
router.post('/getAll', async (req, res) => {
  const { startDate, endDate, status, location, name } = req.body;
  let stDate = '';
  let edDate = '';
  if (!startDate || !endDate) {
    stDate = new Date('2000-1-1');
    edDate = new Date();
  } else {
    stDate = startDate;
    edDate = endDate;
  }
  let query = {
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: RedeemCode,
      },
      {
        model: ServiceTypes,
      },
    ],
  };

  if (status === 'all') {
    query.where = {
      cancel: false,
      createdAt: {
        [Op.between]: [
          moment(stDate).startOf('day').format(),
          moment(edDate).endOf('day').format(),
        ],
      },
    };
  } else {
    query.where = {
      cancel: false,
      status: status,
      createdAt: {
        [Op.between]: [
          moment(stDate).startOf('day').format(),
          moment(edDate).endOf('day').format(),
        ],
      },
    };
  }

  if (location && location.length) {
    query.where.location = location;
  }

  Order.findAll(query)
    .then((data) => {
      if (data.length) {
        Operator.findAll().then((foundOperator) => {
          (async () => {
            let returnData = [];
            for (let i = 0; i < data.length; i++) {
              const order = data[i];
              const getDetails = await OrderDetails.findAll({
                where: { orderId: order.id },
              });
              const getCustomer = await Customer.findOne({
                where: { phone_number: order.phone_number },
              });

              let refundTotal = 0;
              if (order.paymentId === 'refund') {
                const getCharge = await Charges.findAll({
                  where: {
                    orderId: order.id,
                    action: 'refund',
                  },
                  include: { model: Refund },
                });

                for (let i = 0; i < getCharge.length; i++) {
                  let charge = getCharge[i];
                  for (let k = 0; k < charge.refunds.length; k++) {
                    let refund = charge.refunds[k];
                    refundTotal += parseFloat(refund.refundAmount);
                  }
                }
              }

              let totalCancelQty = 0;
              let totalCancelAmount = 0;
              if (getDetails.length) {
                totalCancelQty = getDetails.reduce((total, detail) => {
                  if (detail.dataValues.cancel === true) {
                    return total + detail.dataValues.qty;
                  }
                  return total;
                }, 0);

                totalCancelAmount = getDetails.reduce((total, detail) => {
                  if (detail.dataValues.cancel === true) {
                    return (
                      total + detail.dataValues.price * detail.dataValues.qty
                    );
                  }
                  return total;
                }, 0);
              }

              let codeAmount = 0;
              if (order.redeemCode) {
                if (order.redeemCode.type === 'Flat') {
                  codeAmount = order.redeemCode.amount;
                } else {
                  let orderAmount = getDetails.reduce(
                    (total, order) => total + order.price * order.qty,
                    0
                  );
                  orderAmount = parseFloat(orderAmount).toFixed(2);
                  codeAmount = (orderAmount * order.redeemCode.amount) / 100;
                }
              }
              const getPrice = getDetails
                .map((a) => {
                  return a.price * a.qty;
                })
                .reduce((a, b) => a + b, 0);
              let obj = {
                ...order.dataValues,
                name: getCustomer ? getCustomer.dataValues.full_name : '',
                pickupRecord: foundOperator.filter(
                  (operator) => operator.oid === order.pick_up_driver
                )[0]?.full_name,
                deliveryRecord: foundOperator.filter(
                  (operator) => operator.oid === order.delivery_driver
                )[0]?.full_name,
                images: [],
                refund: refundTotal,
                codeAmount: codeAmount,
                itemQuantity: 0,
                subtotal: parseFloat(getPrice),
                price: parseFloat(getPrice + getPrice * 0.06),
                totalCancelQty: totalCancelQty,
                totalCancelAmount: totalCancelAmount,
              };

              if (order?.files?.length) {
                for (let j = 0; j < order.files.length; j++) {
                  const Key = order.files[j];
                  const getParam = {
                    Bucket,
                    Key,
                  };
                  const url = await Promise.resolve(
                    s3.getSignedUrlPromise('getObject', getParam)
                  );
                  obj.images.push(url);
                }
                returnData.push(obj);
              } else {
                returnData.push(obj);
              }
            }
            return returnData;
          })().then((jsonData) => {
            return res.status(200).json(jsonData);
          });
        });
      } else {
        return res.status(200).json([]);
      }
    })
    .catch((err) => {
      console.error('Error when finding all order ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// UPDATE DEPOSIT TIME
// POST @-> /api/order/details/updateDeposit
// To UPDATE PICK UP TIME
router.post('/details/updateDeposit', (req, res) => {
  const { orderId } = req.body;
  console.log('updating deposit time', req.body);
  Order.findOne({ where: { oid: orderId } })
    .then((foundOrder) => {
      if (!foundOrder)
        return res.status(400).json({ error: 'Order not found' });
      const today = new Date();
      foundOrder.deposit_time = today;
      foundOrder
        .save()
        .then((savedDeposit) => {
          const newInbox = Inbox.build({
            phone_number: savedDeposit.phone_number,
            title: `Laundry Notification - You have an active order #${savedDeposit.oid}!`,
            message:
              'Your order is on the list now. We will update you again when the order has pick up for cleaning. Thank you ',
          });
          newInbox.save();
          return res.status(200).json('updated deposit time');
        })
        .catch((err) => {
          console.error('Error when updating order details in db');
          console.error(err);
          return res.status(400).json;
        });
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// EDIT PICK UP ORDER DETAILS
// POST @-> /api/order/details/updatePickUpOrder
// To edit pick up order details
router.post('/details/updatePickUpOrder', (req, res) => {
  const { orderId, operatorId, collectLockerId } = req.body;
  Order.findOne({ where: { oid: orderId } })
    .then((foundOrder) => {
      genNewTaskNum('TASK', (err, tid) => {
        if (err) return res.status(400).json({ error: 'Internal Error' });

        if (!foundOrder) {
          return res.status(400).json({ error: 'Order not found' });
        } else {
          if (!foundOrder.pick_up_driver) {
            foundOrder.pick_up_driver = operatorId;

            foundOrder.save().then((savedOrder) => {
              const newTask = Record.build({
                tid,
                operatorId: savedOrder.pick_up_driver,
                orderId: savedOrder.oid,
                location: savedOrder.location,
                lockerId: collectLockerId
                  ? collectLockerId
                  : savedOrder.lockerId,
                status:
                  savedOrder.pick_up_time === null ? 'Pick Up' : 'Drop Off',
              });
              newTask
                .save()
                .then((savedTask) => {
                  return res.status(200).json(savedTask);
                })
                .catch((err) => {
                  deductGenNum('TASK', (err) => {
                    console.log('failed and deducted!');
                  });
                  console.error('Error when updating order details in db');
                  console.error(err);
                  return res.status(400).json;
                });
            });
          } else {
            foundOrder.pick_up_driver = operatorId;
            foundOrder.save().then((updatedOrder) => {
              Record.findOne({
                where: { orderId: updatedOrder.oid, completed: false },
              }).then((foundRecord) => {
                foundRecord.operatorId = updatedOrder.pick_up_driver;
                foundRecord
                  .save()
                  .then((foundOrder) => {
                    return res.status(200).json(foundOrder);
                  })
                  .catch((err) => {
                    console.error('Error when finding this task');
                    console.error(err);
                    return res.status(400).json({ error: 'Internal Error' });
                  });
              });
            });
          }
        }
      });
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// EDIT DELIVERY ORDER DETAILS
// POST @-> /api/order/details/updateDeliveryOrder
// To edit delivery order details
router.post('/details/updateDeliveryOrder', (req, res) => {
  const { orderId, operatorId, collectLockerId } = req.body;
  Order.findOne({ where: { oid: orderId } })
    .then((foundRecord) => {
      genNewTaskNum('TASK', (err, tid) => {
        if (err) return res.status(400).json({ error: 'Internal Error' });
        if (!foundRecord)
          return res.status(400).json({ error: 'Order not found' });
        if (!foundRecord.delivery_driver) {
          foundRecord.delivery_driver = operatorId;
          if (collectLockerId) {
            foundRecord.collectLockerId = collectLockerId;
          }
          foundRecord.save().then((savedOrder) => {
            const newTask = Record.build({
              tid,
              operatorId: savedOrder.delivery_driver,
              orderId: savedOrder.oid,
              location: savedOrder.location,
              lockerId: savedOrder.collectLockerId,
              status: savedOrder.pick_up_time === null ? 'Pick Up' : 'Drop Off',
            });
            newTask
              .save()
              .then((savedTask) => {
                return res.status(200).json(savedTask);
              })
              .catch((err) => {
                deductGenNum('TASK', (err) => {
                  console.log('failed and deducted!');
                });

                console.error('Error when updating order details in db');
                console.error(err);
                return res.status(400).json;
              });
          });
        } else {
          LockerDetails.findOne({
            where: {
              location: foundRecord.location,
              name: foundRecord.collectLockerId,
            },
          })
            .then((lockerData) => {
              if (!lockerData)
                res.status(400).json({ error: 'locker not found!' });

              lockerData.booking = false;
              lockerData.save().then((saved) => {
                foundRecord.delivery_driver = operatorId;
                if (collectLockerId) {
                  foundRecord.collectLockerId = collectLockerId;
                }
                foundRecord.save().then((updatedOrder) => {
                  Record.findOne({
                    where: { orderId: updatedOrder.oid, completed: false },
                  }).then((foundTask) => {
                    foundTask.operatorId = operatorId;
                    foundTask.lockerId = foundRecord.collectLockerId;
                    foundTask
                      .save()
                      .then((foundOrder) => {
                        return res.status(200).json('Updated to new operator');
                      })
                      .catch((err) => {
                        console.error('Error when finding this task');
                        console.error(err);
                        return res
                          .status(400)
                          .json({ error: 'Internal Error' });
                      });
                  });
                });
              });
            })
            .catch((err) => {
              console.log('locker', err);
              res.status(200).json();
            });
        }
      });
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// UPDATE PICK UP TIME
// POST @-> /api/order/details/updatePickUp
// To UPDATE PICK UP TIME
router.post('/details/updatePickUp', (req, res) => {
  const { id } = req.body;
  Record.findOne({ where: { tid: id } })
    .then((foundRecord) => {
      if (!foundRecord) {
        return res.status(400).json({ error: 'Task not found' });
      } else {
        foundRecord.completed = true;
        foundRecord.save().then((savedRecord) => {
          const oid = savedRecord.orderId;

          Order.findOne({ where: { oid } }).then((foundOrder) => {
            if (!foundOrder)
              return res.status(400).json({ error: 'Order not found' });
            const today = new Date();
            foundOrder.pick_up_time = today;
            foundOrder
              .save()
              .then((savedPickUp) => {
                const newInbox = Inbox.build({
                  phone_number: foundOrder.dataValues.phone_number,
                  title: `Laundry Notification - Your Order #${oid} arranged for cleaning process!`,
                  message:
                    'Your order is on the way for processing now. We will update you again when the clothes are done cleaning. Thank you) ',
                });
                newInbox.save();
                return res.status(200).json({ taskId: foundRecord.id });
              })
              .catch((err) => {
                console.error('Error when updating order details in db');
                console.error(err);
                return res.status(400).json;
              });
          });
        });
      }
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// UPDATE DELIVER TIME - DRIVER
// POST @-> /api/order/details/updateDelivery
// To UPDATE DELIVERY TIME
router.post('/details/updateDelivery', (req, res) => {
  const { id } = req.body;
  Record.findOne({ where: { tid: id } })
    .then((foundRecord) => {
      if (!foundRecord)
        return res.status(400).json({ error: 'Task not found' });
      foundRecord.completed = true;
      foundRecord.save().then((savedRecord) => {
        const oid = savedRecord.orderId;
        Order.findOne({ where: { oid } }).then((foundOrder) => {
          if (!foundOrder)
            return res.status(400).json({ error: 'Order not found' });
          const today = new Date();
          foundOrder.delivered_time = today;
          foundOrder.delivered_to_locker = true;
          foundOrder
            .save()
            .then(() => {
              const newInbox = Inbox.build({
                phone_number: foundOrder.dataValues.phone_number,
                title: `Laundry Notification - Your Order #${oid} is ready to collect!`,
                message:
                  'Please collect the items at Locker. Thank you. ) ',
              });
              newInbox.save().then(() => {
                const message = collectMessage(oid);
                const type = 'collect';
                console.log('order', oid, foundOrder.dataValues.phone_number);
                sendSMS(foundOrder.dataValues.phone_number, message, type, () =>
                  res.status(200).json({ taskId: foundRecord.id })
                );
              });
            })
            .catch((err) => {
              console.error('Error when updating order details in db');
              console.error(err);
              return res.status(400).json;
            });
        });
      });
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// EDIT ORDER DETAILS
// POST @-> /api/order/details/update
// To edit order details
router.post('/details/updatePayment', (req, res) => {
  const { data } = req.body;
  const id = data.order.additionalData;
  const transactionId = data.transactionId;
  Order.findOne({ where: { oid: id } })
    .then((foundRecord) => {
      if (!foundRecord)
        return res.status(400).json({ error: 'Order not found' });
      foundRecord.payment = true;
      foundRecord.paymentId = transactionId;
      foundRecord.paymenttype = data.method;

      if (foundRecord.redeemCodeId) {
        RedeemCode.findOne({
          where: { id: foundRecord.redeemCodeId },
        })
          .then((foundCode) => {
            if (!foundCode) {
              console.log('Code not found');
              return res.status(400).json;
            }

            let discountAmount = 0;
               if (foundCode.type === 'Flat') {
              discountAmount = foundRecord.amount - foundCode.amount;
            } else {
              discountAmount =
                foundRecord.amount -
                foundRecord.amount * (foundCode.amount / 100);
            }

            if (discountAmount <= 0) {
              discountAmount = foundRecord.amount;
            }

            const newPayment = Payment.build({
              transactionId,
              orderId: foundRecord.id,
              oid: id,
              amount: data.order.amount,
              method: data.method,
            });

            const newDiscount = Discount.build({
              discountCode: foundCode.code,
              discountAmount: foundCode.amount,
              discountType: foundCode.type,
              redeemCodeId: foundCode.id,
              customerId: foundRecord.customerId,
              orderId: foundRecord.id,
              totalDeductAmount: discountAmount,
            });

            foundRecord
              .save()
              .then(() => {
                newPayment
                  .save()
                  .then((savePayment) => {
                    if (savePayment) {
                      newDiscount
                        .save()
                        .then((saveDiscount) => {
                          if (saveDiscount) {
                            return res
                              .status(200)
                              .json('success update payment true');
                          }
                        })
                        .catch((err) => {
                          console.error(
                            'Failed to saved the order discount',
                            err
                          );
                          return res.status(400).json({
                            error: 'Failed to saved the order discount',
                          });
                        });
                    }
                  })
                  .catch((err) => {
                    console.error('Error when save the payment in db');
                    console.error(err);
                    return res.status(400).json;
                  });
              })
              .catch((err) => {
                console.error('Error when updating order in db');
                console.error(err);
                return res.status(400).json;
              });
          })
          .catch((err) => {
            console.error('Error when finding the code in db');
            console.error(err);
            return res.status(400).json;
          });
      } else {
        const newPayment = Payment.build({
          transactionId,
          orderId: foundRecord.id,
          oid: id,
          amount: data.order.amount,
          method: data.method,
        });

        foundRecord
          .save()
          .then(() => {
            newPayment.save().then((savePayment) => {
              if (savePayment) {
                return res.status(200).json('success update payment true');
              }
            });
          })
          .catch((err) => {
            console.error('Error when updating order details in db');
            console.error(err);
            return res.status(400).json;
          });
      }
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// Make payment again
// POST @-> /api/order/makePayment
// To repayment
router.post('/makePayment', (req, res) => {
  const { price, orderId, additionalData } = req.body;
  const title = 'test';
  const detail = 'CLEANING_SERVICES';

  Order.findOne({ where: { oid: orderId } }).then((data) => {
    const payAmount = parseFloat(price.toFixed(0));
    console.log('repay = ', payAmount);
    getPaymentUrl(
      {
        outletId: 'SmartLocker',
        rmClientId,
        rmClientSecret,
        rmStoreId,
        serverPrivateKey,
      },
      { title, detail, additionalData, payAmount, orderId },
      (err, data) => {
        if (err) return res.status(400).json({ error: err.message });
        return res.status(200).json({ url: data.url });
      }
    );
  });
});

// UPDATE ORDER CANCEL = TRUE
// POST @-> /api/order/cancel
// To CANCEL ORDER
router.post('/cancel', (req, res) => {
  const { id } = req.body;
  Order.findOne({ where: { oid: id } })
    .then((foundOrder) => {
      if (!foundOrder) {
        return res.status(400).json({ error: 'Order not found' });
      } else {
        foundOrder.cancel = true;
        foundOrder
          .save()
          .then((savedRecord) => {
            return res.status(200).json(savedRecord);
          })
          .catch((err) => {
            console.error('Error when updating order details in db');
            console.error(err);
            return res.status(400).json;
          });
      }
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// UPDATE ORDER COMPLETE = TRUE
// POST @-> /api/order/cancel
// To UPDATE COMPLETE ORDER
router.post('/updateComplete', (req, res) => {
  const { id } = req.body;

  Order.findOne({ where: { oid: id } })
    .then((foundOrder) => {
      if (!foundOrder) {
        return res.status(400).json({ error: 'Order not found' });
      }
      foundOrder.status = 'completed';
      foundOrder.collectedDate = new Date();
      foundOrder
        .save()
        .then((saveOrder) => {
          if (saveOrder) {
            return res.status(200).json(saveOrder);
          }
        })
        .catch((err) => {
          console.error('Error when updating order details in db');
          console.error(err);
          return res.status(400).json;
        });
    })
    .catch((err) => {
      console.error('Error when finding this order');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET ORDER DETAIL TO TABLE
// POST @-> /api/order/getOrderDetails
// To GET ORDER DETAIL TO TABLe
router.post('/getOrderDetails', async (req, res) => {
  const { oid } = req.body;
  try {
    const foundOrder = await OrderDetails.findAll({
      where: {
        orderNo: oid,
      },
    });

    const checkDiscount = await Order.findOne({
      where: {
        oid: oid,
      },
      include: {
        model: RedeemCode,
      },
    });

    let discountAmount = 0;
    if (checkDiscount.redeemCode) {
      if (checkDiscount.redeemCode.type === 'Flat') {
        discountAmount = checkDiscount.redeemCode.amount;
      } else {
        discountAmount =
          checkDiscount.price * (checkDiscount.redeemCode.amount / 100);
      }
    }

    let totalCancelQty = 0;
    let totalCancelAmount = 0;
    if (foundOrder.length) {
      totalCancelQty = foundOrder.reduce((total, detail) => {
        if (detail.dataValues.cancel === true) {
          return total + detail.dataValues.qty;
        }
        return total;
      }, 0);

      totalCancelAmount = foundOrder.reduce((total, detail) => {
        if (detail.dataValues.cancel === true) {
          return total + detail.dataValues.price * detail.dataValues.qty;
        }
        return total;
      }, 0);
      //
    }

    if (!foundOrder) {
      return res.status(400).json({ error: 'Order not found' });
    } else {
      return res.status(200).json({ foundOrder, discountAmount });
    }
  } catch (error) {
    console.error('Error when finding this order');
    console.error(error);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET ORDER ID TO LIST
// POST @-> /api/order/getList
// To GET ORDER DETAIL TO TABLE
router.post('/getList', async (req, res) => {
  const { status, name, location } = req.body;
  let query = { where: { status: status, cancel: false, location: {} } };
  if (location && location.length) {
    query.where.location = { [Op.in]: location };
  }
  if (name === 'admin') {
    query.where = { status: status, cancel: false };
  }
  try {
    const foundOrder = await Order.findAll(query);

    if (!foundOrder) {
      return res.status(400).json({ error: 'Order not found' });
    } else {
      return res.status(200).json(foundOrder);
    }
  } catch (err) {
    console.error('Error when finding this order');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/getChargesOrderList', async (req, res) => {
  const { location, name } = req.body;

  let query = { where: { status: 'active', cancel: false, location: {} } };
  if (location && location.length) {
    query.where.location = { [Op.in]: location };
  }
  if (name === 'admin') {
    query.where = { status: 'active', cancel: false };
  }
  try {
    const allItem = await OrderDetails.findAll({
      where: {
        cancel: false,
      },
    });
    const allCategory = await ServiceTypes.findAll({});
    const allFabric = await Fabric.findAll({});
    const foundOrder = await Order.findAll(query);

    return res.status(200).json({
      order: foundOrder,
      item: allItem,
      fabric: allFabric,
      category: allCategory,
    });
  } catch (err) {
    console.error('Error when finding this order');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// POST @-> /api/order/charges
router.post('/charges', async (req, res) => {
  const {
    action,
    orderNo,
    reason,
    chargeName,
    amount,
    newItem,
    oldItem,
    qty,
    adminName,
    removeItem,
  } = req.body;
  if (!action || !orderNo || !reason) {
    return res.status(400).json({ error: 'Missing Details' });
  }
  console.log(req.body);

  try {
    const foundAdmin = await Admin.findOne({ where: { username: adminName } });
    if (!foundAdmin) {
      return res.status(400).json({ error: 'Admin not found' });
    }
    const foundOrder = await Order.findOne({
      where: { oid: orderNo, cancel: false },
    });
    if (!foundOrder) {
      return res.status(400).json({ error: 'Order not found' });
    }

    if (action === 'add') {
      const newCard = OrderDetails.build({
        location: foundOrder.location,
        orderNo: foundOrder.oid,
        phone_number: foundOrder.phone_number,
        item: chargeName,
        qty: 1,
        price: amount,
        orderId: foundOrder.id,
      });
      await newCard.save();
      const checkOldItem = await OrderDetails.findAll({
        where: { orderNo: foundOrder.oid },
      });
      const totalNewPrice = checkOldItem
        .map((item) => {
          return item.qty * item.price;
        })
        .reduce((a, b) => a + b, 0);
      const newCharges = Charges.build({
        action,
        reason,
        item: chargeName,
        qty: 1,
        amount,
        orderId: foundOrder.id,
        oid: foundOrder.oid,
        adminId: foundAdmin.id,
      });
      foundOrder.price = totalNewPrice;
      foundOrder.quantity = checkOldItem
        .map((item) => {
          return item.qty;
        })
        .reduce((a, b) => a + b, 0);
      foundOrder.payment = false;
      await foundOrder.save();
      await newCharges.save();
      return res
        .status(200)
        .json({ message: 'Added extra charges to the order.' });
    } else if (action === 'addnew') {
      const checkFabric = await Fabric.findOne({ where: { id: newItem } });
      const newCard = OrderDetails.build({
        location: foundOrder.location,
        orderNo: foundOrder.oid,
        phone_number: foundOrder.phone_number,
        item: checkFabric.name,
        fabricId: checkFabric.id,
        qty,
        price: checkFabric.price,
        orderId: foundOrder.id,
      });
      await newCard.save();
      const checkOldItem = await OrderDetails.findAll({
        where: { orderNo: foundOrder.oid },
      });
      const totalNewPrice = checkOldItem
        .map((item) => {
          return item.qty * item.price;
        })
        .reduce((a, b) => a + b, 0);

      const newCharges = Charges.build({
        action,
        reason,
        item: checkFabric.name,
        qty,
        amount: checkFabric.price * qty,
        orderId: foundOrder.id,
        oid: foundOrder.oid,
        adminId: foundAdmin.id,
      });
      foundOrder.price = totalNewPrice;
      foundOrder.quantity = checkOldItem
        .map((item) => {
          return item.qty;
        })
        .reduce((a, b) => a + b, 0);
      foundOrder.payment = false;

      await foundOrder.save();
      await newCharges.save();
      return res.status(200).json({ message: 'Added new item to the order.' });
    } else if (action === 'changeitem') {
      const checkOldItem = await OrderDetails.findOne({
        where: { item: oldItem, orderNo: foundOrder.oid },
      });
      const checkFabric = await Fabric.findOne({ where: { id: newItem } });
      if (!checkOldItem || !checkFabric) {
        return res.status(400).json({ error: 'Error getting order details.' });
      }
      const newCharges = Charges.build({
        action,
        reason,
        olditem: checkOldItem.item,
        oldprice: checkOldItem.price * checkOldItem.qty,
        qty,
        item: checkFabric.name,
        amount: checkFabric.price * qty,
        orderId: foundOrder.id,
        oid: foundOrder.oid,
        adminId: foundAdmin.id,
      });

      checkOldItem.item = checkFabric.name;
      checkOldItem.fabricId = checkFabric.id;
      checkOldItem.qty = qty;
      checkOldItem.price = checkFabric.price;
      await checkOldItem.save();
      const checkItem = await OrderDetails.findAll({
        where: { orderNo: foundOrder.oid },
      });
      const totalNewPrice = checkItem
        .map((item) => {
          return item.qty * item.price;
        })
        .reduce((a, b) => a + b, 0);
      foundOrder.price = totalNewPrice;
      foundOrder.quantity = checkItem
        .map((item) => {
          return item.qty;
        })
        .reduce((a, b) => a + b, 0);
      foundOrder.payment = false;

      await foundOrder.save();
      await newCharges.save();
      return res
        .status(200)
        .json({ message: 'Updated new item to the order.' });
    } else if (action === 'foc') {
      foundOrder.paymentId = 'foc';
      foundOrder.payment = true;
      await foundOrder.save();

      const newCharges = Charges.build({
        action,
        reason,
        orderId: foundOrder.id,
        oid: foundOrder.oid,
        adminId: foundAdmin.id,
      });
      await newCharges.save();
      return res.status(200).json({ message: 'Added FOC to the order.' });
    } else if (action === 'refund') {
      console.log('Original price', foundOrder.price);
      console.log('Refund price', amount);
      const newAmount = parseFloat((foundOrder.price - amount).toFixed(2));

      let refundAmount = 0;
      let data = {};
      if (foundOrder.paymentId === 'refund') {
        const getCharge = await Charges.findOne({
          where: {
            orderId: foundOrder.id,
            action: 'refund',
          },
          order: [['createdAt', 'DESC']],
        });

        const chargeValue = parseFloat(getCharge.amount).toFixed(2);
        if (chargeValue < amount) {
          console.log('failed');
          return res.status(400).json({
            error: `Please enter the correct amount within RM${getCharge.amount}`,
          });
        }

        refundAmount = (chargeValue - amount).toFixed(2);
        data = {
          action,
          reason,
          orderId: foundOrder.id,
          oid: foundOrder.oid,
          adminId: foundAdmin.id,
          amount: refundAmount,
        };
      } else {
        data = {
          action,
          reason,
          orderId: foundOrder.id,
          oid: foundOrder.oid,
          adminId: foundAdmin.id,
          amount: newAmount,
        };
      }
      const newCharges = Charges.build(data);
      await newCharges.save();

      foundOrder.paymentId = 'refund';
      await foundOrder.save();

      const newRefund = Refund.build({
        chargeId: newCharges.id,
        refundAmount: amount,
        location: foundOrder.location,
      });

      await newRefund.save();
      return res.status(200).json({ message: 'Added refund to the order.' });
    } else if (action === 'cancel') {
      foundOrder.cancel = true;

      const newCharges = Charges.build({
        action,
        reason,
        orderId: foundOrder.id,
        oid: foundOrder.oid,
        adminId: foundAdmin.id,
      });

      const locker = foundOrder.lockerId
        ? foundOrder.lockerId
        : foundOrder.collectLockerId;
      const foundLocker = await LockerDetails.findOne({
        where: { location: foundOrder.location, name: locker },
      });

      foundLocker.booking = false;
      foundLocker.reserved = false;
      await foundOrder.save();
      await newCharges.save();
      await foundLocker.save();

      return res
        .status(200)
        .json({ message: 'Updated cancel status to the order.' });
    } else if (action === 'removeItem') {
      // Issues on this, get item fabric ID instead of getting unique UUID if got multiple item with same category/fabric.
      console.log('Remove Item: ', removeItem);
      const fabricId = removeItem;
   
      const orderPayment = await OrderDetails.findAll({
        where: {
          orderNo: foundOrder.oid,
          orderId: foundOrder.id,
          fabricId: fabricId,
          cancel: false,
        },
      });

      const payment = await Payment.findAll({
        where: {
          orderId: foundOrder.id,
        },
      });

      // If didnt pay then remove item, RM0 case
      if (!payment.length) {
        if (!orderPayment.length) {
          return res
            .status(400)
            .json({ error: 'Error when getting order details' });
        }

        let orderDetailAmount = orderPayment.reduce((total, order) => {
          return total + order.price * order.qty;
        }, 0);

        let orderAmount = foundOrder.price;

        orderDetailAmount = parseFloat(orderDetailAmount).toFixed(2);
        orderAmount = parseFloat(orderAmount).toFixed(2);

        if (orderDetailAmount === orderAmount) {
          foundOrder.payment = true;
          await foundOrder.save();
        }

        for (let i = 0; i < orderPayment.length; i++) {
          orderPayment[i].cancel = true;
          await orderPayment[i].save();
        }
      } else {
        if (orderPayment.length) {
          let paymentAmount = payment.reduce(
            (total, payment) => total + payment.amount / 100,
            0
          );
          let orderAmount = orderPayment.reduce(
            (total, order) => total + order.price * order.qty,
            0
          );
          paymentAmount = parseFloat(paymentAmount).toFixed(2);
          orderAmount = parseFloat(orderAmount).toFixed(2);

          if (paymentAmount < orderAmount) {
            foundOrder.payment = false;
            await foundOrder.save();
          } else {
            foundOrder.payment = true;
            await foundOrder.save();
          }

          for (let i = 0; i < orderPayment.length; i++) {
            orderPayment[i].cancel = true;
            await orderPayment[i].save();
          }
        } else {
          return res
            .status(400)
            .json({ error: 'Error when getting order details' });
        }
      }

      const newCharges = Charges.build({
        action,
        reason,
        orderId: foundOrder.id,
        oid: foundOrder.oid,
        adminId: foundAdmin.id,
      });
      await newCharges.save();

      return res
        .status(200)
        .json({ message: 'Removed the item from the order.' });
    }
  } catch (err) {
    console.error('Error when create charges this order');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET CHARGES DETAIL
// POST @-> /api/order/getCharges
// To GET CHARGES DETAIL TO TABLE
router.post('/getCharges', async (req, res) => {
  const { location, name } = req.body;
  let data = [];
  let query = {};

  if (location && location.length) {
    query = { where: { location: {} } };
    query.where.location = { [Op.in]: location };
  }
  try {
    const allAdmin = await Admin.findAll();
    const allOrder = await Order.findAll(query);
    const allCharges = await Charges.findAll({
      order: [['createdAt', 'DESC']],
    });

    for (let a = 0; a < allCharges.length; a++) {
      let charges = allCharges[a].dataValues;
      let orderLocation = allOrder.filter((o) => o.oid === charges.oid)[0]
        ?.location;

      for (let l = 0; l < location.length; l++) {
        let userLocation = location[l];
   
        if (orderLocation === userLocation) {
          data.push({
            ...charges,
            location: orderLocation ? orderLocation : '',
            createdBy: allAdmin.filter((ad) => ad.id === charges.adminId)[0]
              ?.username,
            updatedBy: charges.updatedBy
              ? allAdmin.filter((u) => u.id === charges.updatedBy)[0].username
              : '-',
          });
        }
      }

      if (name === 'admin' && location.length === 0) {
        data.push({
          ...charges,
          location: orderLocation ? orderLocation : '',
          createdBy: allAdmin.filter((ad) => ad.id === charges.adminId)[0]
            ?.username,
          updatedBy: charges.updatedBy
            ? allAdmin.filter((u) => u.id === charges.updatedBy)[0].username
            : '-',
        });
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Error when finding the charges.');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/reschedule', async (req, res) => {
  const { orderId, currentDate, newDate, reason, driverId, adminName } =
    req.body;
  if (!orderId || !newDate || !reason) {
    return res.status(400).json({ error: 'Missing Input' });
  }
  const foundAdmin = await Admin.findOne({ where: { username: adminName } });
  if (!foundAdmin) {
    return res.status(400).json({ error: 'Admin not found' });
  }
  if (driverId) {
    const checkDriver = await Operator.findOne({
      where: { oid: driverId, status: 'Active' },
    });
    if (!checkDriver) {
      return res.status(400).json({ error: 'Driver not found' });
    }
  }

  try {
    const checkOrder = await Order.findOne({
      where: { oid: orderId, cancel: false },
    });
    if (!checkOrder) {
      return res.status(400).json({ error: 'Order not found' });
    }
    const checkDeliveryTask = await Record.findOne({
      where: { orderId: checkOrder.oid, status: 'Drop Off' },
    });
    const checkCollectTask = await Record.findOne({
      where: { orderId: checkOrder.oid, status: 'Collect', completed: false },
    });
    if (checkCollectTask) {
      return res
        .status(400)
        .json({ error: 'Please complete the Collect Order first.' });
    }

    checkOrder.pick_up_date = newDate;

    if (driverId && checkDeliveryTask.completed) {
      checkOrder.delivery_driver = null;
      checkOrder.delivered_time = null;
      await checkOrder.save();
      try {
        genNewTaskNum('TASK', async (err, tid) => {
          const newTask = Record.build({
            tid,
            operatorId: driverId,
            orderId: checkOrder.oid,
            location: checkOrder.location,
            lockerId: checkOrder.collectLockerId,
            status: 'Collect',
            adminId: foundAdmin.id,
          });
          await newTask.save();
          const newTaskReschedule = Reschedule.build({
            olddate: currentDate,
            reason,
            newdate: newDate,
            orderId: checkOrder.id,
            recordId: newTask ? newTask.id : null,
            adminId: foundAdmin.id,
          });
          await newTaskReschedule.save();
        });
      } catch (err) {
        deductGenNum('TASK', (err) => {
          console.log('failed and deducted!');
        });
      }
    } else if (driverId && !checkDeliveryTask.completed) {
      return res
        .status(400)
        .json({ error: 'Please complete the order delivery first.' });
    } else {
      const newReschedule = Reschedule.build({
        olddate: currentDate,
        reason,
        newdate: newDate,
        orderId: checkOrder.id,
        adminId: foundAdmin.id,
      });
      await newReschedule.save();
      await checkOrder.save();
    }
    const newInbox = Inbox.build({
      phone_number: checkOrder.phone_number,
      title: `Notification - Your order #${checkOrder.oid} has been rescheduled!`,
      message: `Your collection date has been rescheduled to ${moment(
        newDate
      ).format(
        'YYYY/MM/DD'
      )}. We will update you again when the order is ready for collect. Thank you. :) `,
    });

    await newInbox.save();

    const message = rescheduleMessage(
      checkOrder.oid,
      moment(newDate).format('DD-MM-YYYY')
    );
    const type = 'Reschedule';
    sendSMS(checkOrder.phone_number, message, type, () =>
      res
        .status(200)
        .json({ message: 'Updated new collection date to the order.' })
    );
  } catch (err) {
    console.error('Error when finding this order');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET RESCHEDULE DETAIL
// POST @-> /api/order/getCharges
// To GET CHARGES DETAIL TO TABLE
router.post('/getReschedule', async (req, res) => {
  const { location, name } = req.body;
  let query = {};

  if (location && location.length) {
    query = { where: { location: {} } };
    query.where.location = { [Op.in]: location };
  }

  const getReschedule = await Reschedule.findAll({
    include: { model: Order, Record },
  });
  const allOrder = await Order.findAll(query);
  const allAdmin = await Admin.findAll();
  const getAllDriver = await Operator.findAll();
  let allData = [];
  try {
    for (e = 0; e < getReschedule.length; e++) {
      let data = getReschedule[e].dataValues;
      let orderLocation = allOrder.filter((o) => o.id === data.orderId)[0]
        ?.location;

      const checkTask = await Record.findOne({ where: { id: data.recordId } });

      for (let l = 0; l < location.length; l++) {
        let userLocation = location[l];
        if (orderLocation === userLocation) {
          const newData = {
            ...data,
            oid: data.order.oid,
            location: data.order.location,
            phone_number: data.order.phone_number,
            taskId: checkTask ? checkTask.tid : '-',
            driverName: checkTask
              ? getAllDriver.filter((a) => a.oid === checkTask.operatorId)[0]
                .full_name
              : '-',
            collectLockerId: checkTask ? checkTask.lockerId : '-',
            createdBy: allAdmin.filter((ad) => ad.id === data.adminId)[0]
              ?.username,
          };
          allData.push(newData);
        }
      }
      if (name === 'admin' && location.length === 0) {
        const newData = {
          ...data,
          oid: data.order.oid,
          location: data.order.location,
          phone_number: data.order.phone_number,
          taskId: checkTask ? checkTask.tid : '-',
          driverName: checkTask
            ? getAllDriver.filter((a) => a.oid === checkTask.operatorId)[0]
              .full_name
            : '-',
          collectLockerId: checkTask ? checkTask.lockerId : '-',
          createdBy: allAdmin.filter((ad) => ad.id === data.adminId)[0]
            ?.username,
        };
        allData.push(newData);
      }
    }

    return res.status(200).json(allData);
  } catch (err) {
    console.error('Error when finding the reschedule.');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// CHECK DISCOUNT CODE IS VALID & CONDITIONS
router.post('/checkDiscountCode', async (req, res) => {
  const { code, userId, serviceType, location } = req.body;
  try {
    const checkCode = await RedeemCode.findOne({
      where: {
        code: code,
      },
      include: [
        {
          model: Discount,
        },
      ],
    });

    let todayStart = new Date().setHours(0, 0, 0, 0);
    let todayEnd = new Date().setHours(23, 59, 59, 999);

  
    if (!checkCode) {
      return res.status(400).json({ error: 'Invalid Code' });
    } else if (
      new Date() <= new Date(checkCode.start_date).setHours(0, 0, 0, 0) ||
      new Date() >= new Date(checkCode.end_date).setHours(23, 59, 59, 999)
    ) {
      return res.status(400).json({ error: 'Code was expired' });
    } else if (
      checkCode.discounts.filter(
        (discount) =>
          new Date(discount.createdAt) >= new Date(todayStart) &&
          new Date(discount.createdAt) <= new Date(todayEnd)
      ).length >= checkCode.redeem_per_day &&
      checkCode.redeem_per_day !== 0
    ) {
      return res.status(400).json({ error: 'Code was fully redeemed' });
    } else if (
      checkCode.redeem_per_user !== 0 &&
      checkCode.discounts.filter((discount) => discount.customerId === userId)
        .length >= checkCode.redeem_per_user
    ) {
      return res.status(400).json({ error: 'Code was fully redeemed' });
    } else if (
      checkCode.redeem_per_month !== 0 &&
      checkCode.discounts.filter((discount) => discount.customerId).length >=
      checkCode.redeem_per_month
    ) {
      return res.status(400).json({ error: 'Code was fully redeemed' });
    } else if (
      checkCode.redeem_per_day !== 0 &&
      checkCode.discounts.filter((discount) => discount.customerId).length >=
      checkCode.redeem_per_day
    ) {

      return res.status(400).json({ error: 'Code was fully redeemed' });
    } else if (checkCode.locationUse && checkCode.serviceUse) {
      const checkLocation = checkCode.location.includes(location);
      const checkService = checkCode.service.includes(serviceType);

      if (!checkLocation || !checkService) {
        return res
          .status(400)
          .json({ error: 'Code cannot be used in this location' });
      }
    } else if (checkCode.locationUse) {
      const checkLocation = checkCode.location.includes(location);
      if (!checkLocation) {
        return res
          .status(400)
          .json({ error: 'Code cannot be used in this location' });
      }
    } else if (checkCode.serviceUse) {
      const checkService = checkCode.service.includes(serviceType);
      if (!checkService) {
        return res
          .status(400)
          .json({ error: 'Code cannot be used in this category' });
      }
    }

    return res.status(200).json({ discountData: checkCode });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Internal error' });
  }
});


{
  process.env.scheduler === 'yes'
    ? schedule.scheduleJob('*/5 * * * *', async (fireDate) => {
      console.log(
        'CHECK AND REMOVE UNPAID ORDER: ',
        new Date(fireDate).toLocaleString('en-GB')
      );
      const halfHrBefore = new Date(new Date().getTime() - 30 * 60000);
      try {
        let todayDate = new Date().getDate();
        /**
update order to cancel true
  */
        const query = {
          payment: false,
          createdAt: { [Op.lt]: halfHrBefore },
          deposit_time: null,
          cancel: false,
        };
        const allLockers = await Locker.findAll();
        const foundDocs = await Order.findAll({
          where: query,
        });
        for (a = 0; a < foundDocs.length; a++) {
          const getLocker = await LockerDetails.findOne({
            where: {
              name: foundDocs[a].lockerId,
              location: foundDocs[a].location,
            },
          });
          if (getLocker) {
            getLocker.reserved = false;
            getLocker.booking = false;
            foundDocs[a].cancel = true;

            await foundDocs[a].save();
            await getLocker.save();
          } else {
            console.log('Cant found Locker to update.');
          }
        }
        const checkLog = await ActivityLog.findOne({
          where: {
            type: 'MonthlyReport',
            createdAt: {
              [Op.between]: [
                moment(new Date()).startOf('month').format(),
                moment(new Date()).endOf('month').format(),
              ],
            },
          },
        });
        if (todayDate === 1 && !checkLog) {
          sendMonthlyReport();
        } else {
          console.log('no need sent monthly');
        }
      } catch (error) {
        console.error('ERROR IN SCHEDULER');
        console.error(error);
      }
    })
    : '';
}

process.env.scheduler === 'yes'
  ? schedule.scheduleJob('*/5 * * * *', async () => {
    try {
      console.log('sync and check locker');
      const allLockers = await Locker.findAll({
        where: { status: true, deviceId: { [Op.eq]: null } },
      });
      for (let a = 0; a < allLockers.length; a++) {
        syncLockerSlot(allLockers[a].id, (status) => {
          if (status === 'updated') {
            SlackError(
              `${allLockers[a].name} locker is online.`,
              'Success',
              () => {
                const message = `The ${allLockers[a].name} locker is online.`;
                sendSMS('', message, 'Online', (status) => {
                  console.log(status);
                });
              }
            );
          } else {
            SlackError(
              `Cannot sync the locker, the ${allLockers[a].name} locker is offline.`,
              'Error',
              () => {
                const message = `The ${allLockers[a].name} locker is offline.`;
                sendSMS('', message, 'Offline', (status) => {
                  console.log(status);
                });
              }
            );
          }
        });
      }
    } catch (error) {
      console.error('ERROR IN SCHEDULER');
      console.error(error);
    }
  })
  : '';

module.exports = router;
