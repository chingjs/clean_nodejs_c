require('dotenv').config();
const express = require('express');
// const async = require('async');
// const moment = require('moment');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Code = require('../../configs/tables/Code');
const Admin = require('../../configs/tables/Admin');
const Order = require('../../configs/tables/Order');
const Roles = require('../../configs/tables/Roles');
const Locker = require('../../configs/tables/Locker');
const Refund = require('../../configs/tables/Refund');
const Charges = require('../../configs/tables/Charges');
const Payment = require('../../configs/tables/Payment');
const Enquiry = require('../../configs/tables/Enquiry');
const Operator = require('../../configs/tables/Operator');
const Customer = require('../../configs/tables/Customer');
const RedeemCode = require('../../configs/tables/RedeemCode');
const ServiceType = require('../../configs/tables/ServiceTypes');
const OrderDetails = require('../../configs/tables/OrderDetails');

// const fs = require('fs');
// const path = require('path');
const { Op } = require('sequelize');
const moment = require('moment');
const sequelize = require('../../configs/sequelize');
const router = express.Router();
const { sqlDate } = require("../../configs/function/misc");


/**
  1.) LOGIN
  2.) GET SALES OVERVIEW - TODAY TOTAL SALES,ORDERS,LOCKER
  3.) GET ENQUIRY ALL
  4.) GET USER PERFORMANCE DATA
  5.) GET ALL SERVICE
  6.) GET ALL OPERATOR
  7.) UPDATE OPERATOR STATUS
*/

router.post('/verifyToken', async (req, res) => {
  const { token } = req.body;
  try {
    if (!token) {
      console.error("Unauthorized");
      return res.status(401).json({ error: "Action denied, unauthorized" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // console.error("Token authorized but error : \n", err);
        return res.status(401).json({ error: "Token is invalid" });
      }
      return res.status(200).json({ data: decoded })
    });
  }
  catch (err) {
    console.error('Error when finding admin in admin login');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const foundRecord = await Admin.findOne({ where: { username, status: true } })
    if (!foundRecord) {
      return res.status(400).json({ error: 'User not found.' });
    } else {
      const foundRoles = await Roles.findAll({ where: { adminId: foundRecord.id } })
      bcrypt.compare(password, foundRecord.password, (err, result) => {
        if (err) return res.status(400).json({ error: 'Decryption Error' });

        if (!result)
          return res
            .status(400)
            .json({ error: "You've entered the wrong password" });

        jwt.sign(
          { id: foundRecord.id, name: foundRecord.username, roles: foundRoles },
          process.env.JWT_SECRET,
          { expiresIn: '12h' },
          (err, adminToken) => {
            if (err) {
              console.error(
                'Error when signing admin token in admin login'
              );
              console.error(err);
              return res.status(400).json({ error: 'Internal Error' });
            }
            const returnThis = {
              adminToken,
            };
            return res.status(200).json(returnThis);
          }
        );
      });
    }
  }
  catch (err) {
    console.error('Error when finding admin in admin login');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/getAdminUser', async (req, res) => {

  try {
    const getAdmin = await Admin.findAll({ where: { type: { [Op.ne]: 'DEV' } } })
    const getRoles = await Roles.findAll({})

    const newData = getAdmin.map((a) => {
      let location = []
      const roles = getRoles.filter(d => d.adminId === a.id)
      for (let l = 0; l < roles.length; l++) {
        if (!location.includes(roles[l].location)) {
          location.push(roles[l].location)
        }
      }
      return {
        id: a.id,
        username: a.username,
        type: a.type,
        email: a.email,
        password: a.password,
        location,
        status: a.status,
        updatedAt: a.updatedAt,
        updatedBy: a.updatedBy,
      }
    })

    return res.status(200).json({ AdminList: newData });
  }
  catch (err) {
    console.error('Error when finding the admin list.');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/createAdminUser', async (req, res) => {
  const { username, password, newpassword, email, type, currentUser, location } = req.body;
  // console.log(username, password, newpassword, email, type, currentUser, location)
  const salt = bcrypt.genSaltSync(13);
  const hash = bcrypt.hashSync(password, salt);
  if (!username || !password || !currentUser || !location.length) {
    return res.status(400).json({ error: 'Missing Input' })
  }
  if (username === 'admin') {
    return res.status(400).json({ error: 'Internal Error' })
  }
  const checkEmail = await Admin.findOne({ where: { email: email } })

  try {
    const checkRecord = await Admin.findOne({ where: { username } })
    if (!checkRecord) {
      if (email && checkEmail) {
        return res.status(400).json({ error: 'Email used by other users.' })
      }

      const newRecord = Admin.build({
        username, password: hash, email: email ? email : null, type, status: true, createdBy: currentUser
      });

      // const newRecord = Admin.build({
      //   username, password: hash, email, type, status: true, createdBy: currentUser
      // });
      await newRecord.save()
      for (let l = 0; l < location.length; l++) {
        let d = location[l];
        if (type === 'INVESTOR') {
          Roles.bulkCreate([
            { name: 'LockerStatus', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'OrderManagement', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'SalesOverview', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'EnquireManagement', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'UserPerformance', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'CreateCharges', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'ChargesManagement', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'RescheduleManagement', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'CreateDriver', category: 'customization', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'CreateItemType', category: 'customization', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'DriverManagement', category: 'customization', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'ItemTypeManagement', category: 'customization', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'MDRManagement', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'CategoryReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'ItemTypeReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'PaymentMethodReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'SalesSummaryReport', category: 'reports', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'RefundReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
          ]);
        } else if (type === 'SERVICE PROVIDER') {
          Roles.bulkCreate([
            { name: 'LockerStatus', category: 'home', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'OrderManagement', category: 'home', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'SalesOverview', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'EnquireManagement', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'UserPerformance', category: 'home', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'CreateCharges', category: 'home', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'ChargesManagement', category: 'home', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'RescheduleManagement', category: 'home', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'CreateDriver', category: 'customization', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'CreateItemType', category: 'customization', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'DriverManagement', category: 'customization', type: 'ALL', status: true, adminId: newRecord.id, location: d.location },
            { name: 'ItemTypeManagement', category: 'customization', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'MDRManagement', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'CategoryReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'ItemTypeReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'PaymentMethodReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'SalesSummaryReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
            { name: 'RefundReport', category: 'reports', type: 'ALL', status: false, adminId: newRecord.id, location: d.location },
          ]);
        }
      }
    }
    else {
      if (newpassword) {
        const newhash = bcrypt.hashSync(newpassword, salt);
        checkRecord.password = newhash
      }
      checkRecord.email = email
      checkRecord.type = type
      checkRecord.updatedBy = currentUser
      await checkRecord.save()

      const checkRoles = await Roles.destroy({ where: { adminId: checkRecord.id } })
      if (!checkRoles) {
        return res.status(400).json({ error: 'Some error while updating user.' })
      }
      for (let l = 0; l < location.length; l++) {
        let d = location[l];
        if (type === 'INVESTOR') {
          // console.log('create investor', d.location)
          Roles.bulkCreate([
            { name: 'LockerStatus', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'OrderManagement', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'SalesOverview', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'EnquireManagement', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'UserPerformance', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'CreateCharges', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'ChargesManagement', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'RescheduleManagement', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'CreateDriver', category: 'customization', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'CreateItemType', category: 'customization', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'DriverManagement', category: 'customization', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'ItemTypeManagement', category: 'customization', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'MDRManagement', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'CategoryReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'ItemTypeReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'PaymentMethodReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'SalesSummaryReport', category: 'reports', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'RefundReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
          ]);
        }
        if (type === 'SERVICE PROVIDER') {
          // console.log('service', d.location)

          Roles.bulkCreate([
            { name: 'LockerStatus', category: 'home', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'OrderManagement', category: 'home', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'SalesOverview', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'EnquireManagement', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'UserPerformance', category: 'home', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'CreateCharges', category: 'home', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'ChargesManagement', category: 'home', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'RescheduleManagement', category: 'home', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'CreateDriver', category: 'customization', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'CreateItemType', category: 'customization', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'DriverManagement', category: 'customization', type: 'ALL', status: true, adminId: checkRecord.id, location: d.location },
            { name: 'ItemTypeManagement', category: 'customization', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'MDRManagement', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'CategoryReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'ItemTypeReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'PaymentMethodReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'SalesSummaryReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
            { name: 'RefundReport', category: 'reports', type: 'ALL', status: false, adminId: checkRecord.id, location: d.location },
          ]);
        }
      }
    }
    return res.status(200).json({ message: 'Successfully' })
  }
  catch (err) {
    console.error('Error when creating Admin');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post("/removeAdminUser", async (req, res) => {
  const { id, currentUser } = req.body;

  if (!id) {
    return res.status(400).json('Missing Details ID')
  }
  try {
    const checkRecord = await Admin.findOne({
      where: { id },
    });
    if (!checkRecord) {
      return res.status(400).json({ error: "Admin not found." });
    }
    checkRecord.status = !checkRecord.status
    checkRecord.updatedBy = currentUser
    await checkRecord.save()

    return res
      .status(200)
      .json({
        data: checkRecord,
        message: 'Successfully'
      });
  }
  catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Internal Error" });
  }
});

// GET TODAY TOTAL SALES,ORDERS,LOCKER
// POST @-> /api/admin/overview
// To get all today details
router.post('/overview', async (req, res) => {
  // const { startDate, endDate } = req.body;
  let startDate = req.body.startDate ? req.body.startDate : new Date().getDate()-7
  let endDate = req.body.endDate ? req.body.endDate : new Date()
  // console.log('start', req.body)
  try {
    const orders = await Order.findAll({
      where: {
        payment: true,
        createdAt: {
          [Op.between]: [moment(startDate).startOf('day').format(), moment(endDate).endOf('day').format()],
        },
      },
      order: [['createdAt', 'ASC']],
    })
    let data = {};

    for (let i = 0; i < orders.length; i++) {
      let amount = 0;
      const order = orders[i];
      // console.log('order', order);
      const orderDate = new Date(order.createdAt).toLocaleDateString();

      const checkDetails = await OrderDetails.findAll({ where: { orderId: order.id } })
      for (let a = 0; a < checkDetails.length; a++) {
        let checkDetail = checkDetails[a]
        let total = checkDetail.price * checkDetail.qty
        amount += total
      }

      if (data[orderDate]) {
        data[orderDate].amount += amount
        data[orderDate].transactions += 1;
      } else {
        data[orderDate] = {
          date: [orderDate],
          transactions: 1,
          amount: amount
        };
      }

    }
    data = Object.keys(data).map((date) => ({
      ...data[date],
      date,
    }));
    // console.log(data)

    return res.status(200).json(data);
  }
  catch (err) {
    console.error('Error when finding all order ');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET ALL ENQUIRY DETAILS
// POST @-> /api/admin/Enquiry/getall
// To get all ENQUIRY details
router.get('/enquiry/getAll', (req, res) => {
  Enquiry.findAll()
    .then((data) => {
      return res.status(200).json(data);
    })
    .catch((err) => {
      console.error('Error when finding all enquiry type ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// EDIT ENQUIRY DETAILS
// POST @-> /api/admin/enquiry/edit
// To edit operator details
router.post('/enquiry/edit', (req, res) => {
  const { id, status } = req.body;
  Enquiry.findByPk(id)
    .then((foundRecord) => {
      if(!foundRecord){
        return res.status(400).json({error:"Enquiry not found"})
      }
      foundRecord.status = status === 'Processed' ? true : false;
      foundRecord.save().then((savedRecord) => {
        return res.status(200).json(foundRecord);
      });
    })
    .catch((err) => {
      console.error('Error when finding enquiry in edit enquiry details');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET USER PERFORMANCE DETAILS
// POST @-> /api/admin/userperformance
// To get all user details
router.get('/userReport', (req, res) => {
  Customer.findAll({
    include: {
      model: Order,
    }, order: [["createdAt", "ASC"]]
  })
    .then((data) => {
      const userReport = data.map((user) => {
        const allSpent = user.orders.filter(f => f.payment === true).map((amt) => {
          return amt.price;
        });
        const sumSpent = allSpent.reduce((a, b) => a + b, 0);
        // console.log('checkData', data[0].orders[0]); // type=== 'Wash + Iron'
        const calGarment = user.orders.filter((item) => {
          return item.serviceType == 'Garment' && item.cancel != true && item.payment === true;
        });
        const calLaundry = user.orders.filter((item) => {
          return item.serviceType == 'Laundry' && item.cancel != true && item.payment === true;
        });
        const calShoe = user.orders.filter((item) => {
          return item.serviceType == 'Shoe' && item.cancel != true && item.payment === true;
        });
        const calHousehold = user.orders.filter((item) => {
          return item.serviceType == 'Household' && item.cancel != true && item.payment === true;
        });
        const serviceList = [
          { name: 'Garment', total: calGarment.length },
          { name: 'Household', total: calHousehold.length },
          { name: 'Shoe', total: calShoe.length },
          { name: 'Laundry', total: calLaundry.length },
        ];
        const newData = {
          ...user.dataValues,
          totalGarment: calGarment.length,
          totalShoe: calShoe.length,
          totalHousehold: calHousehold.length,
          totalLaundry: calLaundry.length,

          totalSpent: sumSpent.toFixed(2),
          serviceList: serviceList.reduce(
            (max, b) => (max = max.total > b.total ? max : b),
            0
          ),
        };
        // console.log('newData', newData);
        return newData;
      });
      return res.status(200).json(userReport);
    })
    .catch((err) => {
      console.error('Error when finding all user ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET Monthly Sales By Service
// POST @-> /api/admin/service/sales
// To get monthly service sales
router.post('/service/sales', (req, res) => {
  let startDate = req.body.startDate ? req.body.startDate : new Date().getDate()-7
  let endDate = req.body.endDate ? req.body.endDate : new Date()
 
  Order.findAll({
    where: {
      payment: true,
      createdAt: {
        [Op.between]: [moment(startDate).startOf('day').format(), moment(endDate).endOf('day').format()],
      },
    },
    order: [['createdAt', 'ASC']],
  })
    .then((orders) => {
      const garment = orders.filter((type) => {
        return type.serviceType === 'Garment';
      });
      const getGarment = garment.map((item) => {
        return item.price;
      });
      const calGarment = getGarment.reduce((a, b) => a + b, 0);
      //calculation
      const household = orders.filter((type) => {
        return type.serviceType === 'Household';
      });
      const getHousehold = household.map((item) => {
        return item.price;
      });
      const calHousehold = getHousehold.reduce((a, b) => a + b, 0);

      const laundry = orders.filter((type) => {
        return type.serviceType === 'Laundry';
      });
      const getLaundry = laundry.map((item) => {
        return item.price;
      });
      const calLaundry = getLaundry.reduce((a, b) => a + b, 0);

      const shoe = orders.filter((type) => {
        return type.serviceType === 'Shoe';
      });
      const getShoe = shoe.map((item) => {
        return item.price;
      });
      const calShoe = getShoe.reduce((a, b) => a + b, 0);
      const newData = [
        {
          name: 'Garment',
          transactions: garment.length,
          amount: calGarment.toFixed(2),
        },
        {
          name: 'Household',
          transactions: household.length,
          amount: calHousehold.toFixed(2),
        },
        {
          name: 'Laundry',
          transactions: laundry.length,
          amount: calLaundry.toFixed(2),
        },
        {
          name: 'Shoe',
          transactions: shoe.length,
          amount: calShoe.toFixed(2),
        },
      ];
      // console.log('newData', newData);

      return res
        .status(200)
        .json(newData.sort((a, b) => b.transactions - a.transactions));
    })
    .catch((err) => {
      console.error('Error when finding all order ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET ALL OPERATOR
// POST @-> /api/operator/viewAll
// To view all operator details
router.post('/operator/getAll', async (req, res) => {
  const { status } = req.body;
  try {
    const allAdmin = await Admin.findAll({})
    const checkDriver = await Operator.findAll({ where: { status: 'Active' } })

    let data = []
    for (let a = 0; a < checkDriver.length; a++) {
      let driver = checkDriver[a].dataValues

      data.push({
        ...driver,
        createdBy: driver.adminId ? allAdmin.filter(ad => ad.id === driver.adminId)[0].username : '',
        updatedBy: driver.updatedBy ? allAdmin.filter(ap => ap.id === driver.updatedBy)[0].username : '',
      })
    }
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// EDIT OPERATOR DETAILS
// POST @-> /api/admin/operator/edit
// To edit operator details
router.post('/operator/edit', async (req, res) => {
  const {
    id,
    status,
    phone_number,
    full_name,
    email, adminName } = req.body;


  // Operator.findOne({
  //   where: { email, phone_number }
  // }).then((found) => { if (found) return res.status(400).json({ error: "Existing Email or phone" }) })
  const foundAdmin = await Admin.findOne({ where: { username: adminName } })
  if (!foundAdmin) {
    return res.status(400).json({ error: 'Admin not found' })
  }
  try {
    const foundOperator = await Operator.findByPk(id)
    if (!foundOperator)
      return res.status(400).json({ error: 'Operator not found' });

    foundOperator.full_name = full_name;
    foundOperator.phone_number = phone_number;
    foundOperator.email = email;
    foundOperator.status = status;
    foundOperator.updatedBy = foundAdmin.id;
    await foundOperator.save()

    return res.status(200).json({ message: 'success' });
  }
  catch (err) {
    console.error('Error when finding operator in edit operator details');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET ALL PAYMENT METHOD DETAILS
// POST @-> /api/admin/payment/getall
// To get all PAYMENT details
router.post('/payment/getAll', async (req, res) => {
  const { startDate, endDate, location, type } = req.body;
  //console.log('req', req.body)
  let stDate = ''
  let edDate = ''
  if (!startDate || !endDate) {
    stDate = new Date('2000-1-1')
    edDate = new Date()
  } else {
    stDate = startDate
    edDate = endDate
  }

  let query = {
    where: {
      createdAt: {
        [Op.between]: [moment(stDate).startOf('day').format(), moment(edDate).endOf('day').format()],
      }
    },
    order: [["createdAt", "DESC"]],
    include: [{
      model: Order,
      // where: {
      //   cancel: false,
      // },

    }],
  }

  if (type && type.length) {
    query.where.method = { [Op.in]: type }
  }

  if (location && location.length !== '') {
    query.include[0].where.location = location;
  }

  try {
    const getAllOrder = await Order.findAll()
    const getAllPayment = await Payment.findAll(query)

    // if (getAllPayment.length) {
    //   let typeData = []
    //   for (let a = 0; a < getAllPayment.length; a++) {
    //     if (!typeData.includes(getAllPayment[a].method)) {
    //       typeData.push(getAllPayment[a].method)
    //     }
    //   }
    //   let filterData = getAllPayment.map(a => {
    //     console.log(a.dataValues)
    //     return {
    //       ...a.dataValues,
    //       location: getAllOrder.filter(o => o.oid === a.oid)[0]?.location,
    //     }
    //   })
    //   return res.status(200).json({ paymentList: filterData, paymentType: typeData });
    // }
    // else {
    //   return res.status(200).json({ paymentList: [] });
    // }
    if (getAllPayment.length) {
      let typeData = [];
      let transactionIds = [];

      let filterData = getAllPayment.reduce((filtered, payment) => {
        if (!transactionIds.includes(payment.transactionId)) {
          transactionIds.push(payment.transactionId);

          filtered.push({
            ...payment.dataValues,
            location: getAllOrder.find(order => order.oid === payment.oid)?.location || null,
          });
        }
        // filtered.push({
        //   ...payment.dataValues,
        //   location: getAllOrder.find(order => order.oid === payment.oid)?.location || null,
        // });
        return filtered;
      }, []);

      filterData.forEach(payment => {
        if (!typeData.includes(payment.method)) {
          typeData.push(payment.method);
        }
      });

      // const newItem = {
      //   date: 'Total',
      //   // qty: filterData.map(s => { return parseInt(s.qty) }).reduce((a, b) => a + b, 0),
      //   // amount: filterData.map(s => { return s.amount }).reduce((a, b) => a + b, 0),
      //   // netTotal: filterData.map(s => { return s.amount }).reduce((a, b) => a + b, 0),
      // }

      // filterData.push(newItem)

      // console.log(newItem)

      return res.status(200).json({ paymentList: filterData, paymentType: typeData });
    } else {
      return res.status(200).json({ paymentList: [] });
    }

  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET ALL ORDER ITEM DETAILS
// POST @-> /api/admin/item/getall
// To get all ITEM details
router.post('/item/getAll', async (req, res) => {
  const { startDate, endDate, item, location } = req.body;
  let stDate = ''
  let edDate = ''
  if (!startDate || !endDate) {
    stDate = new Date('2000-1-1')
    edDate = new Date()
  } else {
    stDate = startDate
    edDate = endDate
  }
  let query = {
    where: {
      cancel: false,
      createdAt: {
        [Op.between]: [moment(stDate).startOf('day').format(), moment(edDate).endOf('day').format()],
      }
    }, order: [["createdAt", "DESC"]], include: { model: Order, where: { [Op.or]: [{ payment: true }, { payment: false }], cancel: false } },
  }
  if (item && item.length) {
    query.where.item = { [Op.in]: item }
  }
  if (location && location.length) {
    query.where.location = { [Op.in]: location }
  }

  try {
    const getAllItem = await OrderDetails.findAll(query)

    if (getAllItem.length) {
      let itemData = []
      let locationData = []

      for (let a = 0; a < getAllItem.length; a++) {
        if (!itemData.includes(getAllItem[a].item)) {
          itemData.push(getAllItem[a].item)
        }
        if (!locationData.includes(getAllItem[a].location)) {
          locationData.push(getAllItem[a].location)
        }
      }
      let filterData = getAllItem.map(a => {
        return {
          ...a.dataValues,
          category: a.order ? a.order.dataValues.serviceType : '',
          total: a.price * a.qty,
        }
      })
      // console.log(filterData)
      const newItem = {
        date: 'Total',
        qty: filterData.map(s => { return parseInt(s.qty) }).reduce((a, b) => a + b, 0),
        price: filterData.map(s => { return s.price }).reduce((a, b) => a + b, 0),
        total: filterData.map(s => { return s.total }).reduce((a, b) => a + b, 0),
      }

      filterData.push(newItem)
      return res.status(200).json({ itemList: filterData, itemType: itemData, locationType: locationData });
    }
    else {
      return res.status(200).json({ itemList: [] });
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET ALL CATEGORY DETAILS
// POST @-> /api/admin/category/getall
// To get all CATEGORY details
router.post('/category/getAll', async (req, res) => {
  const { startDate, endDate, category, location } = req.body;
  let stDate = ''
  let edDate = ''
  if (!startDate || !endDate) {
    stDate = new Date('2000-1-1')
    edDate = new Date()
  } else {
    stDate = startDate
    edDate = endDate
  }
  let query = {
    where: {
      [Op.or]: [{ payment: true }, { payment: false }],
      cancel: false,
      createdAt: {
        [Op.between]: [moment(stDate).startOf('day').format(), moment(edDate).endOf('day').format()],
      }
    },
    include: {
      model: OrderDetails,
      // where: {
      //   cancel: false
      // }
    },
    order: [["createdAt", "DESC"]]
  }
  if (category && category.length) {
    query.where.serviceType = { [Op.in]: category }
  }
  if (location && location.length) {
    query.where.location = { [Op.in]: location }
  }

  try {
    const getAllCategory = await Order.findAll(query);
    let returnData = [];
    let categoryData = [];
    let locationData = [];
    let cancelAmount = 0;
    let qty = 0;
    if (getAllCategory.length) {
      for (let i = 0; i < getAllCategory.length; i++) {
        const order = getAllCategory[i];


        let totalCancelAmount = 0;
        let totalCancelQty = 0;
        if (order.order_details.length) {
          totalCancelQty = order.order_details.reduce((total, detail) => {
            // console.log(detail.dataValues.cancel)
            if (detail.dataValues.cancel === true) {
              return total + detail.dataValues.qty;
            }
            return total;
          }, 0);

          totalCancelAmount = order.order_details.reduce((total, detail) => {
            // console.log(detail.dataValues.cancel)
            if (detail.dataValues.cancel === true) {
              return total + (detail.dataValues.price * detail.dataValues.qty);
            }
            return total;
          }, 0);
        }
        // console.log(totalCancelQty, totalCancelAmount);

        if (!categoryData.includes(order.serviceType)) {
          categoryData.push(order.serviceType)
        }

        if (!locationData.includes(order.location)) {
          locationData.push(order.location)
        }

        let obj = {
          ...order.dataValues,
          // refundAmount: refundTotal
          totalCancelQty: totalCancelQty,
          totalCancelAmount: totalCancelAmount,
        }

        cancelAmount += totalCancelAmount;
        qty += totalCancelQty;

        returnData.push(obj);
      }

      // console.log(cancel, qty);
      const newCategory = {
        totalCancelAmount: cancelAmount,
        totalCancelQty: qty,
        date: 'Total',
        quantity: getAllCategory.map(s => { return parseInt(s.quantity) }).reduce((a, b) => a + b, 0),
        price: (getAllCategory.map(s => { return s.price }).reduce((a, b) => a + b, 0)).toFixed(2),
      }

      returnData.push(newCategory)

      return res.status(200).json({ categoryList: returnData, categoryType: categoryData, locationType: locationData });
    }
    else {
      return res.status(200).json({ categoryList: [] });
    }

    // if (getAllCategory.length) {
    //   let categoryData = []
    //   let locationData = []

    //   for (let a = 0; a < getAllCategory.length; a++) {
    //     if (!categoryData.includes(getAllCategory[a].serviceType)) {
    //       categoryData.push(getAllCategory[a].serviceType)
    //     }
    //     if (!locationData.includes(getAllCategory[a].location)) {
    //       locationData.push(getAllCategory[a].location)
    //     }
    //   }
    //   const newCategory = {
    //     date: 'Total',
    //     quantity: getAllCategory.map(s => { return parseInt(s.quantity) }).reduce((a, b) => a + b, 0),
    //     price: (getAllCategory.map(s => { return s.price }).reduce((a, b) => a + b, 0)).toFixed(2),
    //   }

    //   getAllCategory.push(newCategory)
    //   return res.status(200).json({ categoryList: getAllCategory, categoryType: categoryData, locationType: locationData });
    // }
    // else {
    //   return res.status(200).json({ categoryList: [] });
    // }


  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/sales/getAll', async (req, res) => {
  const { startDate, endDate, type, location, name } = req.body;
  let searchType = ''
  // console.log(req.body)
  const startDateQuery = startDate ? sqlDate(startDate) : sqlDate('2000-1-1');
  const endDateQuery = endDate ? sqlDate(endDate) : sqlDate();
  if (type === 'Daily' || !type) { searchType = 'day' }
  else if (type === 'Weekly') { searchType = 'week' }
  else if (type === 'Monthly') { searchType = 'month' }
  else if (type === 'Yearly') { searchType = 'year' }

  let locationQuery = ''

  if (name === 'admin') {
    if (location && location.length) {
      const newLocation = location.map(a => `'${a}'`)
      locationQuery = `AND order_details.location in (${newLocation})`
      console.log('search', location)
    } else {
      const getAllLocation = await Locker.findAll({})
      const newLocation = getAllLocation.map(a => `'${a.location}'`)
      locationQuery = `AND order_details.location in (${newLocation})`
    }
  } else if (name !== 'admin') {
    const checkUser = await Admin.findOne({ where: { username: name } })
    if (!checkUser) {
      return res.status(400).json({ error: 'User Not found' })
    }
    const checkUserLocation = await Roles.findAll({ where: { adminId: checkUser.id } })
    const newLocation = checkUserLocation.map(a => `'${a.location}'`)
    locationQuery = `AND order_details.location in (${newLocation})`

  }

  // ???
  // WHERE("order".payment = true AND "order".cancel = false)
  try {
    const [result] = await sequelize.query(`
  SELECT  CAST(DATE_TRUNC('${searchType}', "order"."createdAt") AS DATE) AS date,
  count(DISTINCT "order".id) as orders, sum(order_details.qty) as qty,
  sum(order_details.price * order_details.qty) as subtotal,
  sum(order_details.price * order_details.qty) * 0.06 as tax,
  sum(order_details.price * order_details.qty) + sum(order_details.price * order_details.qty) * 0.06 as net,
  sum("discount"."totalDeductAmount") as discount_total,
  sum("discount"."discountAmount") as discount_code_amount,
  order_details.location as olocation
  FROM "order" 
  JOIN order_details ON "order".oid = order_details."orderNo"
  LEFT OUTER JOIN "discount" ON "discount"."orderId" = "order".id
  WHERE ("order".payment = true)
  AND "order"."createdAt" BETWEEN '${startDateQuery}' AND '${endDateQuery} 23:59'
  ${locationQuery}
  GROUP BY date, olocation
  ORDER BY date DESC
`)

    const newSales = {
      date: 'Total',
      qty: result.map(s => { return parseInt(s.qty) }).reduce((a, b) => a + b, 0),
      orders: result.map(s => { return parseInt(s.orders) }).reduce((a, b) => a + b, 0),
      subtotal: result.map(s => { return s.subtotal }).reduce((a, b) => a + b, 0),
      discount_total: result.map(s=> {return s.discount_total}).reduce((a, b) => a + b, 0),
      discount_code_amount: result.map(s=> {return s.discount_code_amount}).reduce((a, b) => a + b, 0),
      net: result.map(s => { return s.net }).reduce((a, b) => a + b, 0),
      tax: result.map(s => { return s.tax }).reduce((a, b) => a + b, 0),

    }

    result.push(newSales);
    return res.status(200).json({ salesSummaryList: result });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/resetpassword', (req, res) => {
  const { username, password } = req.body;
  Admin.findOne({ where: { username } })
    .then((foundRecord) => {
      bcrypt.genSalt(13, (err, salt) => {
        if (err) return res.status(400).json({ error: 'Encryption Error' });

        bcrypt.hash(password, salt, (err, hash) => {
          if (err) return res.status(400).json({ error: 'Encryption Error' });

          if (!foundRecord)
            return res.status(400).json({ error: 'User not found' });

          foundRecord.password = hash;

          foundRecord
            .save()
            .then(() => {
              return res.status(200).json({ password: 'success' });
            })
            .catch((err) => {
              console.error('Error when saving password \n', err);
              return res.status(400).json({ error: 'Internal Error' });
            });
        });
      });
    })
    .catch((err) => {
      console.error('Error when finding admin in edit admin password');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET ALL REFUND DETAILS
// POST @-> /api/admin/refund/getAll
// To get all REFUND details
router.post('/refund/getAll', async (req, res) => {
  // console.log(req.body)
  const { startDate, endDate, location } = req.body;
  let stDate = ''
  let edDate = ''
  if (!startDate || !endDate) {
    stDate = new Date('2000-1-1')
    edDate = new Date()
  }
  else {
    stDate = startDate
    edDate = endDate
  }

  let query = {
    where: {
      createdAt: {
        [Op.between]: [moment(stDate).startOf('day').format(), moment(edDate).endOf('day').format()],
      }
    },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Charges,
        where: {},
        include: [
          {
            model: Admin,
            where: {},
          },
          {
            model: Order,
            where: {},
          }
        ]
      },
    ],
  }

  if (location && location.length) {
    query.include[0].include[1].where.location = { [Op.in]: location };
  }

  try {
    const getAllRefund = await Refund.findAll(query);
    // console.log(getAllRefund[0].charge.order)
    if (getAllRefund.length) {
      const newItem = {
        date: 'Total',
        refundAmount: getAllRefund.map(s => { return parseFloat(s.refundAmount) }).reduce((a, b) => a + b, 0),
      }

      getAllRefund.push(newItem)
      return res.status(200).json({ refundList: getAllRefund });
    }
    else {
      return res.status(200).json({ refundList: [] });
    }
  }
  catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});


// GET ALL CODE DETAILS
// POST @-> /api/admin/code/getAll
// To get all CODE details
// router.post('/code/getAll', async (req, res) => {

//   try {
//     const getAllCode = await Code.findAll({
//       include: {
//         model: ServiceType
//       }
//     });
//     if (!getAllCode.length) {
//       console.log("No code(s)");
//       return res.status(400).json({ error: 'No discount code found' });
//     };
//     return res.status(200).json({ codeList: getAllCode });
//   }
//   catch (err) {
//     console.error(err);
//     return res.status(400).json({ error: 'Error when finding discount code' });
//   };
// });


// CREATE CODE DETAILS
// POST @-> /api/admin/code/create
// To create CODE details
// router.post('/code/create', async (req, res) => {
//   const { code, start_date, end_date, amount, type, redeem_per_user, redeem_per_day, location, service } = req.body.data;
//   try {
//     const checkCodeName = await Code.findOne({
//       where: {
//         code: code
//       }
//     });

//     if (checkCodeName) {
//       return res.status(400).json({ error: 'Code name existed, please try other name' });
//     }

//     let locationUse = false;
//     let serviceUse = false;

//     if (location !== "") {
//       locationUse = true;
//     }

//     if (service !== null) {
//       serviceUse = true;
//     }

//     const createCode = Code.build({
//       code: code,
//       start_date: start_date,
//       end_date: end_date,
//       amount: amount,
//       type: type,
//       redeem_per_user: redeem_per_user,
//       redeem_per_day: redeem_per_day,
//       locationUse: locationUse,
//       serviceUse: serviceUse,
//       location: location,
//       serviceTypeId: service
//     });

//     await createCode.save();
//     return res.status(200).json({ message: 'Successfully created' });
//   }
//   catch (err) {
//     console.error(err);
//     return res.status(400).json({ error: 'Error when finding discount code' });
//   }
// });


// EDIT CODE DETAILS
// POST @-> /api/admin/code/edit
// To edit CODE details
// router.post('/code/edit', async (req, res) => {
//   const { id, code, start_date, end_date, amount, type, redeem_per_user, redeem_per_day, location, service } = req.body.data;

//   try {
//     // const checkCodeName = await Code.findOne({
//     //   where: {
//     //     code: code
//     //   }
//     // });

//     // if (checkCodeName) {
//     //   return res.status(400).json({ error: 'Code name existed, please try other name' });
//     // }

//     let editCode = await Code.findOne({
//       where: {
//         id: id
//       }
//     });

//     if (!editCode) {
//       return res.status(400).json({ error: 'Error when finding the code id' });
//     }

//     let locationUse = false;
//     let serviceUse = false;

//     if (location !== "") {
//       locationUse = true;
//     }

//     if (service !== null) {
//       serviceUse = true;
//     }

//     editCode.code = code;
//     editCode.start_date = start_date;
//     editCode.end_date = end_date;
//     editCode.amount = amount;
//     editCode.type = type;
//     editCode.redeem_per_day = redeem_per_day;
//     editCode.redeem_per_user = redeem_per_user;
//     editCode.locationUse = locationUse;
//     editCode.serviceUse = serviceUse;
//     editCode.location = location;
//     editCode.serviceTypeId = service;

//     await editCode.save();
//     return res.status(200).json({ message: 'Successfully edited' });
//   }
//   catch (err) {
//     console.error(err);
//     return res.status(400).json({ error: 'Internal error' });
//   }
// });


// EDIT CODE DETAILS
// POST @-> /api/admin/code/edit
// To edit CODE details
// router.post('/code/delete', async (req, res) => {
//   const { id } = req.body
//   try {

//     const deleteCode = await Code.destroy({
//       where: {
//         id: id
//       }
//     });

//     if (!deleteCode) {
//       return res.status(400).json({ error: 'Error when finding the code id' });
//     }

//     return res.status(200).json({ message: 'Successfully deleted' });
//   }
//   catch (err) {
//     console.error(err);
//     return res.status(400).json({ error: 'Internal error' });
//   }
// });


// GET ALL CODE DETAILS
// POST @-> /api/admin/code/getAll
// To get all CODE details
router.post('/code/getAll', async (req, res) => {

  try {
    const getAllCode = await RedeemCode.findAll({
      order: [["updatedAt", "DESC"]]
    });
    if (!getAllCode.length) {
      console.log("No code(s)");
      return res.status(400).json({ error: 'No discount code found' });
    };
    return res.status(200).json({ codeList: getAllCode });
  }
  catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Error when finding discount code' });
  };
});


// CREATE CODE DETAILS
// POST @-> /api/admin/code/create
// To create CODE details
router.post('/code/create', async (req, res) => {
  const { code, start_date, end_date, amount, type, redeem_per_user, redeem_per_day, redeem_per_month, location, service } = req.body.data;
  try {
    const checkCodeName = await RedeemCode.findOne({
      where: {
        code: code
      }
    });

    if (checkCodeName) {
      return res.status(400).json({ error: 'Code name existed, please try other name' });
    }

    let locationUse = false;
    let serviceUse = false;

    if (location.length) {
      locationUse = true;
    }

    if (service.length) {
      serviceUse = true;
    }

    const createCode = RedeemCode.build({
      code: code,
      start_date: start_date,
      end_date: end_date,
      amount: amount,
      type: type,
      redeem_per_month: redeem_per_month,
      redeem_per_user: redeem_per_user,
      redeem_per_day: redeem_per_day,
      locationUse: locationUse,
      serviceUse: serviceUse,
      location: location,
      service: service
    });

    await createCode.save();
    return res.status(200).json({ message: 'Successfully created' });
  }
  catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Error when finding discount code' });
  }
});


// EDIT CODE DETAILS
// POST @-> /api/admin/code/edit
// To edit CODE details
router.post('/code/edit', async (req, res) => {
  const { id, code, start_date, end_date, amount, type, redeem_per_user, redeem_per_day, redeem_per_month, location, service } = req.body.data;

  try {
    
    let editCode = await RedeemCode.findOne({
      where: {
        id: id
      }
    });

    if (!editCode) {
      return res.status(400).json({ error: 'Error when finding the code id' });
    }

    if(editCode.code !== code){
      // If changing the old name into the new name
      let checkCodeName = await RedeemCode.findOne({
        where: {
          code: code
        }
      });

      if(checkCodeName){
        return res.status(400).json({ error: 'Code name existed, please try other name' });
      };
    };

    let locationUse = false;
    let serviceUse = false;

    if (location.length) {
      locationUse = true;
    }

    if (service.length) {
      serviceUse = true;
    }

    editCode.code = code;
    editCode.start_date = start_date;
    editCode.end_date = end_date;
    editCode.amount = amount;
    editCode.type = type;
    editCode.redeem_per_month = redeem_per_month;
    editCode.redeem_per_user = redeem_per_user;
    editCode.redeem_per_day = redeem_per_day;
    editCode.locationUse = locationUse;
    editCode.serviceUse = serviceUse;
    editCode.location = location;
    editCode.service = service;

    await editCode.save();
    return res.status(200).json({ message: 'Successfully edited' });
  }
  catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal error' });
  }
});


// EDIT CODE DETAILS
// POST @-> /api/admin/code/edit
// To edit CODE details
router.post('/code/delete', async (req, res) => {
  const { id } = req.body
  try {

    const deleteCode = await RedeemCode.destroy({
      where: {
        id: id
      }
    });

    if (!deleteCode) {
      return res.status(400).json({ error: 'Error when finding the code id' });
    }

    return res.status(200).json({ message: 'Successfully deleted' });
  }
  catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal error' });
  }
});

module.exports = router;
